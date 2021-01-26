"use strict";
process.title = 'isyconnect';

const http = require('http');
const https = require('https');
const webSocketClient = require('websocket').client;
const webSocketServer = require('websocket').server;
const url = require('url');
const fs = require('fs');
// const xml2js = require('xml2js').parseString;

const SOCKPORT = 8182;
const DEBUGcurl = false;
const DEBUGmsg = false;

// user must provide this information for the connector to work
// the userid is obtained from your login screen
// host is the IP address of your local ISY hub

const userid = 1;
const isyhost = "http://192.168.11.31";
const username = "admin";
const password = "ag86Nuke";
const serverhost = "https://housepanel.net:3080";
// const serverhost = null;
const serverhost2 = "http://192.168.11.11:3080";
// const serverhost2 = null;

function ddbg() {
    var d = new Date();
    var dstr = d.toLocaleDateString() + "  " + d.toLocaleTimeString() + " ";
    return "ISY msg: " + dstr + ": ";
}

function _curl(host, headers, nvpstr, calltype, callback) {
    const myURL = url.parse(host);
    if ( !calltype ) {
        calltype = "GET";
    }

    // add query string if given separately
    var formbuff;
    if ( nvpstr && typeof nvpstr === "string" ) {
        if ( calltype==="GET" ) {
            host = host + "?" + nvpstr;
            nvpstr = null;
        } else {
            formbuff = Buffer.from(nvpstr);
        }
    } else if ( nvpstr && typeof nvpstr === "object" ) {
        formbuff = Buffer.from(JSON.stringify(nvpstr));
    } 
    
    if ( formbuff ) {
        if ( !headers ) {
            headers = {};
        }
        headers['Content-Length'] = Buffer.byteLength(formbuff);
    }

    var myport = myURL.port;
    if ( !myport ) {
        if ( myURL.protocol === "https:" ) {
            myport = 443;
        } else {
            myport = 80;
        }
    }

    const opts = {
        hostname: myURL.hostname,
        port: myport,
        path: myURL.path,
        method: calltype,
    };
    if ( headers ) {
        opts.headers = headers;
    }
    if ( myURL.auth ) {
        opts.auth = myURL.auth;
    }
    // get the request
    var totalbody = "";
    if ( myURL.protocol === "https:" ) {
        var req = https.request(opts, curlResponse);
    } else {
        req = http.request(opts, curlResponse);
    }
    // put any form data
    if ( formbuff ) {
        req.write(formbuff);
    }
    
    req.on("error", (e) => {
        if ( callback ) {
            if ( typeof e === "object" && e.message ) {
                var errmsg = e.message;
            } else {
                errmsg = "error - unknonwn error in _curl";
            }
            callback(errmsg, null, null);
        } else {
            console.log((ddbg()), "error with _curl host: ", host, " error: ", e);
        }
    });
    
    req.end();

    // callback from the access_token request
    function curlResponse(res) {
        res.setEncoding('utf8');
        res.on("data", (body) => {
            totalbody+= body;
        });
        res.on("end", ()=> {
            if ( callback ) {
                callback(null, res, totalbody);
            }
            if ( DEBUGcurl ) {
                console.log((ddbg()), "end of _curl message. totalbody: ", totalbody);
            }
        });
    }

}

function setupISYSocket(hub) {

    // make websocket connection to any ISY hub
    // unlike ST and HE below, communication from ISY happens over a real webSocket
    var wshost;

    if ( hub && hub.hubtype==="ISY" && hub.hubendpt && hub.hubaccess ) { 
        var hubhost = hub.hubendpt;
        if ( hubhost.startsWith("https://") ) {
            wshost = "wss://" + hubhost.substr(8);
        } else if ( hubhost.startsWith("http://") ) {
            wshost = "ws://" + hubhost.substr(7);
        }
        wshost = wshost + "/subscribe";
    } else {
        console.log( (ddbg()), "Invalid ISY hub attempted to setup socket. hub: ", hub);
        return;
    }

    // set up socket for ISY hub if one is there
    if ( wshost ) {
        var wsclient = new webSocketClient();
        var buff = Buffer.from(hub.hubaccess);
        var base64 = buff.toString('base64');
        var origin = "com.universal-devices.websockets.isy";
        var header = {"Authorization": "Basic " + base64, "Sec-WebSocket-Protocol": "ISYSUB",  
                    "Sec-WebSocket-Version": "13", "Origin": "com.universal-devices.websockets.isy"};

        wsclient.on("connectFailed", function(err) {
            console.log( (ddbg()), "Connection failure to ISY socket: ", err.toString(), " wshost: ", wshost, " header: ", header);
        });

        wsclient.on("connect", function(connection) {
            console.log( (ddbg()), "Success connecting to ISY socket. Listening for messages...");

            // handle incoming state messages from ISY
            // this will be ignored if the node isn't in our list
            connection.on("message", function(msg) {
                if ( msg.type==="utf8" ) {
                    var headers = {
                        'Content-Type': "application/json"
                    };

                    if ( DEBUGmsg ) {
                        console.log( (ddbg()), "raw data: ", msg);
                    }

                    if ( serverhost ) {
                        _curl(serverhost, headers, msg, "POST", function(err, res, data) {
                            if ( DEBUGmsg ) {
                                console.log( (ddbg()), "data: ", data);
                            }
                        });
                    }

                    // dual push if defined
                    if ( serverhost2 ) {
                        _curl(serverhost2, headers, msg, "POST", function(err, res, data) {
                            if ( DEBUGmsg ) {
                                console.log( (ddbg()), "data2: ", data);
                            }
                        });
                    }

                }
            });
        
            connection.on("error", function(err) {
                console.log( (ddbg()), "Connection error to ISY socket: ", err.toString());
            });
        
            connection.on("close", function() {
                console.log( (ddbg()), "Connection closed to ISY socket");
            });
        
        });

        wsclient.connect(wshost, "ISYSUB", origin, header);
    }

}

// setup socket between server and all user browsers
// this allows clients to send ISY commands back to local hub
// a similar routine in hpserer.js handles commands from legacy ST and HE hubs
function setupBrowserSocket(hub) {
    var wsServer;
    var secinfo;

    var buff = Buffer.from(hub.hubaccess);
    var base64 = buff.toString('base64');
    var isyheader = {"Authorization": "Basic " + base64};

    // create the HTTP server for handling sockets
    // support insecure and secure sockets to deal with ISY which is insecure
    if ( fs.existsSync("housepanel_server.key") && fs.existsSync("housepanel_server.crt") && fs.existsSync("housepanel_server.ca") ) {
        var key = fs.readFileSync("housepanel_server.key");
        var crt = fs.readFileSync("housepanel_server.crt");
        var cabundle = fs.readFileSync("housepanel_server.ca");
        var credentials = {key: key, cert: crt, ca: cabundle};
        var server = https.createServer(credentials, function() {});
        secinfo = "Secure";
    } else {
        server = http.createServer(function() {});
        secinfo = "Insecure";
    }

    // set up server for a two way socket communication with the browser
    if ( server ) {
        // create the webSocket server
        wsServer = new webSocketServer({httpServer: server});
        server.listen(SOCKPORT, function() {
            console.log( (ddbg()), secinfo, " webSocket Server for isyconnect is listening on port: ", SOCKPORT);
        });
    } else {
        console.log( (ddbg()), "webSocket could not be established for isyconnect on port: ", SOCKPORT);
    }

    // This function handles new connections, messages from connections, and closed connections
    if ( wsServer ) {
        wsServer.on('request', function(wsrequest) {
            console.log( (ddbg()), 'Requesting websocket isy connection: ', wsrequest.requestedProtocols );
            if ( wsrequest.requestedProtocols[0] === "housepanel" ) {
                wsrequest.accept("housepanel", wsrequest.origin); 
            }
        });

        wsServer.on('connect', function(connection) {
            var browserurl = "";

            console.log( (ddbg()), 'Connecting isy websocket. Address: ', connection.socket.remoteAddress );

            // shut down any existing connections to same remote host
            browserurl = connection.socket.remoteAddress;

            // wait for message from browser telling us what user id this is
            connection.on("message", function(msg) {
                if ( msg.type==="utf8" ) {
                    if ( DEBUGmsg ) {
                        console.log( (ddbg()), "host: ", browserurl, " msg: ", msg.utf8Data);
                    }

                    // make the ISY host call
                    if ( msg.utf8Data ) {
                        var host = hub.hubendpt + msg.utf8Data;
                        _curl(host, isyheader, false, "GET", function(err, res, body) {
                            if ( err ) {
                                console.log("err: ", err, " body: ", body);
                            }
                        });
                    }

                }
    
            });
        
            // user disconnected - remove all clients that match this socket
            connection.on('close', function(reason, description) {
                var host = connection.socket.remoteAddress;
                console.log( (ddbg()), "Peer: ", host, " disconnected. for: ", reason, " desc: ", description);
            });

        });
    }
    
    // unused function from hpserver to respond to ISY calls
    // function getNodeResponse(err, res, body) {
    //     if ( err ) {
    //         console.log( (ddbg()), "error calling ISY node: ", err);
    //     } else {
    
    //         var rres;
    //         xml2js(body, function(xmlerr, result) {
    //             rres = result.RestResponse.status[0];
    //             if ( DEBUGmsg ) {
    //                 console.log( (ddbg()), "status: ", res, " full response: ", UTIL.inspect(result, false, null, false));
    //             }
    //         });
    //     }
    // }
}


// set up the hub
var hub = {
    userid: userid,
    host: isyhost,
    hubtype: "ISY",
};
hub.hubaccess = username + ":" + password;
hub.hubendpt = isyhost + "/rest";

// set up the socket
setupBrowserSocket(hub);
setupISYSocket(hub);
