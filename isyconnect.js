"use strict";
process.title = 'isyconnect';

const http = require('http');
const https = require('https');
const webSocketClient = require('websocket').client;
const url = require('url');
// const webSocketServer = require('websocket').server;

const DEBUGcurl = false;
const DEBUGmsg = true;

// user must provide this information for the connector to work
// the userid is obtained from your login screen
// host is the IP address of your local ISY hub

const userid = 1;
const isyhost = "http://192.168.11.31";
const username = "admin";
const password = "ag86Nuke";
const serverhost = "https://housepanel.net:3080";
// const serverhost2 = "http://localhost:3080";
const serverhost2 = null;

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
        myport = 443;
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
                    _curl(serverhost, headers, msg, "POST", function(err, res, data) {
                        if ( DEBUGmsg ) {
                            console.log( (ddbg()), data);
                        }
                    });

                    // dual push if defined
                    if ( serverhost2 ) {
                        _curl(serverhost2, headers, msg, "POST", function(err, res, data) {
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

// set up the hub
var hub = {
    userid: userid,
    host: isyhost,
    hubtype: "ISY",
};
hub.hubaccess = username + ":" + password;
hub.hubendpt = isyhost + "/rest";

// set up the socket
setupISYSocket(hub);
