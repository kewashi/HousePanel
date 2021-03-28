"use strict";
process.title = 'hpconnect';

const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const webSocketClient = require('websocket').client;
const url = require('url');
const fs = require('fs');

const DEBUGcurl = false;
const DEBUGmsg = false;

// user must provide their email and password used for their hpserver account for the connector to work
// this is used to identify and confirm that the user is allowed to push data to the server
// isyhost is the IP address of your local ISY hub

function ddbg() {
    var d = new Date();
    var dstr = d.toLocaleDateString() + "  " + d.toLocaleTimeString() + " : ";
    return dstr;
}

// this curl function uses promises so it can be chained with .then() like any other promise
function _curl(host, headers, nvpstr, calltype, callback) {
    var promise = new Promise(function(resolve, reject) {
        const myURL = url.parse(host);

        // add query string if given separately
        var formbuff;
        if ( typeof nvpstr === "string" || typeof nvpstr === "number" ) {
            if ( calltype==="GET" ) {
                if ( nvpstr!=="" ) { host = host + "?" + nvpstr; }
            } else {
                formbuff = Buffer.from(nvpstr);
            }
        } else if ( typeof nvpstr === "object" ) {
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
            reject(e);
            if ( callback && typeof callback === "function" ) {
                if ( typeof e === "object" && e.message ) {
                    var errmsg = e.message;
                } else {
                    errmsg = e;
                }
                callback(errmsg, null);
            }
        });
        
        req.end();

        // callback from the access_token request
        function curlResponse(res) {
            res.setEncoding('utf8');
            var statusCode = res.statusCode;
            var statusMsg = res.statusMessage;
            res.on("data", (body) => {
                totalbody+= body;
            });
            res.on("end", ()=> {
                resolve(totalbody);
                if ( callback && typeof callback === "function"  ) {
                    callback(statusCode, totalbody);
                }
                if ( DEBUGcurl ) {
                    console.log((ddbg()), "end of _curl message. status: ", statusCode, statusMsg, " body: ", totalbody);
                }
            });
        }
    });
    return promise;
}

function pushServer(msg) {
    var headers = {
        'Content-Type': "application/json"
    };

    if ( serverhost && serverhost.startsWith("http") ) {
        _curl(serverhost, headers, msg, "POST")
        .then( data => {
            if ( DEBUGmsg ) {
                console.log( (ddbg()), "data: ", data);
            }
        });
    }

    // dual push if defined
    if ( serverhost2 && serverhost2.startsWith("http") ) {
        _curl(serverhost2, headers, msg, "POST")
        .then(data => {
            if ( DEBUGmsg ) {
                console.log( (ddbg()), "data2: ", data);
            }
        });
    }

}

function setupISYSocket(hub) {

    // make websocket connection to any ISY hub
    // unlike ST and HE below, communication from ISY happens over a real webSocket
    var wshost;

    // set up the hub
    var hub = {
        host: isyhost,
        hubtype: "ISY",
    };
    hub.hubaccess = username + ":" + isyPassword;
    hub.hubendpt = isyhost + "/rest";

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
            // but we have to include a new special field telling hpserver who we are
            connection.on("message", function(msg) {
                if ( msg.type==="utf8" ) {
                    msg.email = email;
                    msg.password = password;
                    pushServer(msg);
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

// this is a mini version of the main app loop in hpserver
// it listens only for POST calls and forwards them on to the main server
// this runs locally and acts as an intermediary for legacy Groovy hubs
// each user who wants to support Groovy hubs like Hubitat has to use this
// because subscriptions to things is done in Groovy and the Groovy app can't post direclty
// to hpserver because we don't know user and because I can't find a way to sent a https post from groovy
function setupGroovyListener() {

    try {
        // the Node.js app loop - can be invoked by client or back end
        var app = express();
        app.use(express.json());
        // app.use(express.urlencoded());
        var dir = path.join(__dirname, '');
        app.use(express.static(dir));

        // list on the port
        var groovyServer = http.createServer(app);
        groovyServer.listen(groovyPort, function () {
            console.log( (ddbg()), "HousePanel connector service is running on port: ", groovyPort);
        });
        
    } catch (e) {
        console.log( (ddbg()), "HousePanel connector service could not be started on port: ", groovyPort);
        app = null;
        return;
    }
    
    // handle POST messages coming from local Groovy hubs
    app.post("*", function (req, res) {

        // forward the message along if it is initialize or an update type
        // but we have to include a new special field telling hpserver who we are
        // actually we don't really need this because hubid will be unique to this user
        // but I provide it anyway just to be sure
        if ( req.path==="/" && (req.body['msgtype'] === "initialize" || req.body['msgtype'] === "update") ) {
            req.body.email = email;
            req.body.password = password;
            pushServer(req.body);
        }
        res.json("200 OK");
        res.end();
    });

}

var isgood = true;
try {
    var userinfo = JSON.parse(fs.readFileSync("hpconnect.cfg","utf8"));
    var isyhost = userinfo.isyhost;
    var username = userinfo.username;
    var isyPassword = userinfo.isyPassword;
    var email = userinfo.email;
    var password = userinfo.password;
    var serverhost = userinfo.serverhost;
    var serverhost2 = userinfo.serverhost2;
    var groovyPort = parseInt(userinfo.groovyPort);
} catch(e) {
    console.log(e);
    isgood = false;
}

// set up the socket
if ( isgood ) {
    setupISYSocket();
    setupGroovyListener();
}
