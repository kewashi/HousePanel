"use strict";
process.title = 'hpconnect';

const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const webSocketClient = require('websocket').client;
const url = require('url');
const fs = require('fs');
const xml2js = require('xml2js').parseString;
const UTIL = require('util');

const DEBUGcurl = false;
const DEBUGpush = false;
const DEBUGgroovypush = true;
const DEBUGisypush = false;
const DEBUGisy = false;

// user must provide their email and password used for their hpserver account for the connector to work
// this is used to identify and confirm that the user is allowed to push data to the server
// isyhost is the IP address of your local ISY hub

function ddbg() {
    var d = new Date();
    var dstr = d.toLocaleDateString() + "  " + d.toLocaleTimeString() + " : ";
    return dstr;
}

function is_array(obj) {
    if ( typeof obj === "object" ) {
        return Array.isArray(obj);
    } else {
        return false;
    }
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function count(obj) {
    if ( typeof obj === "object" )  {
        return Object.keys(obj).length;
    } else {
        return 0;
    }
}

function jsonshow(obj) {
    return UTIL.inspect(obj, false, null, false);
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
            if ( typeof e === "object" && e.message ) {
                var errmsg = e.message;
            } else {
                errmsg = e;
            }
            reject(errmsg);
            if ( callback && typeof callback === "function" ) {
                callback(500, errmsg);
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
                if ( callback && typeof callback === "function"  ) {
                    if ( statusCode === 200 ) {
                        callback(statusCode, totalbody);
                        resolve(totalbody);
                    } else {
                        callback(statusCode, statusMsg);
                    }
                } else {
                    if ( statusCode === 200 ) {
                        resolve(totalbody);
                    } else {
                        reject(statusCode + " " + statusMsg);
                    }
                }
                if ( DEBUGcurl ) {
                    console.log((ddbg()), "end of curl message. status: ", statusCode, statusMsg, " body: ", totalbody);
                }
            });
        }
    });
    return promise;
}

function pushServer(msg, callback) {
    var headers = {
        'Content-Type': "application/json"
    };

    if ( serverhost && serverhost.startsWith("http") ) {
        _curl(serverhost, headers, msg, "POST")
        .then( data => {
            if ( DEBUGpush ) {
                console.log( (ddbg()),"msg: ", msg, "data: ", data);
            }
            if ( callback && typeof callback==="function" ) {
                callback(data);
            }
        });
    }

    // dual push if defined
    // if ( serverhost2 && serverhost2.startsWith("http") ) {
    //     _curl(serverhost2, headers, msg, "POST")
    //     .then(data => {
    //         if ( DEBUGpush ) {
    //             console.log( (ddbg()), "data2: ", data);
    //         }
    //     });
    // }

}

function setupISYSocket() {

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

    if ( hub && isyhost && hub.hubtype==="ISY" && hub.hubendpt && hub.hubaccess ) { 
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
    // convert XML to json here on the connector side
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
                    
                    xml2js(msg.utf8Data, function(err, result) {
                        if ( err || !result ) { return; }

                        msg.email = email;
                        msg.password = password;
                        msg.jsondata = result.Event;
                        delete msg.utf8Data;
                        if ( DEBUGisypush) {
                            console.log( (ddbg()), " ISY: ", jsonshow(msg.jsondata));
                        }

                        // check for signal to refresh the server or push message to server
                        if ( result.Event && result.Event.eventInfo && typeof result.Event.eventInfo === "object" )
                        {
                            var einfo = result.Event.eventInfo[0];
                            if ( einfo && einfo.id && einfo.r && einfo.f && einfo.s && einfo.id[0]===isyReset && einfo.s[0]==="22" ) {
                                console.log( (ddbg()), "Refreshing ISY items");
                                getIsyDevices();
                            }
                        }

                        pushServer(msg, function(data) {
                            if ( data!=="success" && data!=="200 OK" ) {
                                console.log((ddbg()), "error - ", data);
                            }
                        });

                    });

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
// this is not needed for legacy ST groovy app since the new ST app will cause push to impact legacy too
// but if you only have legacy setup you can use it by setting the port to this value in the app
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
            // req.body.email = email;
            // req.body.password = password;
            // var msg = {type: "groovy", msgtype: req.body.msgtype, email: email, password: password, jsondata: req.body};
            if ( DEBUGgroovypush) {
                console.log( (ddbg()), " Groovy: ", jsonshow(req.body));
            }
            pushServer(req.body);
        }
        res.json("200 OK");
        res.end();
    });

}

// use a locally hosted function to get data from ISY hub
// that we push to the server since server can't see the local hub
    // function for loading ISY hub devices
function getIsyDevices() {
    var headers = {
        'Content-Type': "application/json"
    };
    var hub = {
        hubid: "isy01",
        hubhost: isyhost,
        hubtype: "ISY",
        hubname: "ISY",
        clientid: username,
        clientsecret: isyPassword,
        hubaccess: username + ":" + isyPassword,
        hubendpt: isyhost + "/rest",
        hubrefresh: isyConnect,
        useraccess: username + ":" + isyPassword,
        userendpt: isyhost + "/rest",
        hubtimer: "0"
    };

    var hubAccess  = hub.hubaccess;
    var hubEndpt = hub.hubendpt;
    var userid;

    // send data to create the hub which returns the userid and hubid
    var msg = {msgtype: "isyhub", email: email, hub: hub};

    _curl(serverhost, headers, msg, "POST")
    .then( body => {

        if ( !body || (typeof body === "string" && body.startsWith("error")) ) {
            console.log( (ddbg()), body);
            return;
        }
        
        var hubrow = JSON.parse(body);
        userid = hubrow.userid;
        var hubindex = hubrow.id;
        hub.id = hubrow.id;
        hub.userid = hubrow.userid;
        hub.hubid = hubrow.hubid;

        if ( DEBUGisy ) {
            console.log( (ddbg()), ">>>> hub: ", hub);
        }

        var buff = Buffer.from(hubAccess);
        var base64 = buff.toString('base64');
        var stheader = {"Authorization": "Basic " + base64};
        var pvariables = {name: "ISY Variables"};

        // use this object to keep track of which things are done
        var done = {"Int" : false, "State" : false, "Nodes": false, "Progs": false, "Vars": false };

        if ( DEBUGisy ) {
            console.log("endpoint = ", hubEndpt, " stheader = ", stheader, " hubAccess: ", hubAccess);
        }

        // _curl(hubEndpt + "/vars/getxyz/1", stheader, null, "GET", getIntVars)
        // .catch(reason => {
        //     console.log(reason);
        // })

        // get all the variables to put into a single tile
        _curl(hubEndpt + "/vars/get/1", stheader, null, "GET", getIntVars);
        _curl(hubEndpt + "/vars/get/2", stheader, null, "GET", getStateVars);

        // also get programs - each going into its own unique tile
        _curl(hubEndpt + "/programs?subfolders=true", stheader, null, "GET", getAllProgs);

        // now get all the nodes - each going into its own unique tile
        _curl(hubEndpt + "/nodes", stheader, null, "GET", getAllNodes);

        // handle setting the variable tile
        // the four calls to curl above all land here to check if everything is done
        function checkDone( stage ) {

            // mark this stage done if passed in as a parameter
            if ( stage ) {
                done[ stage ] = true;
            }

            // check for finishing all the vars stages
            if ( !done["Vars"] && (done["Int"] && done["State"]) ) {

                // Now that we have all the isy variables and names, create a mapping of ids to names
                var msg = {msgtype: "isynode", userid: userid, name: "ISY Variables", hubid: hubindex, deviceid: "vars", hint: "ISY_variable", msgvalue: pvariables};
                pushServer(msg, function(data) {
                    if ( DEBUGisy ) {
                        console.log( (ddbg()), "updated vars: ", msg, " return: ", data);
                    }
                    done["Vars"] = true;
                    checkDone();
                });
            }

            if ( done["Vars"] && done["Progs"] && done["Nodes"] ) {
                // updateOptions(userid, reload, reloadpath);
                // var msg = {msgtype: "isynode", userid: userid, name: name, hubid: hubindex, deviceid: id, hint: hint, msgvalue: pvalue};
                var msg = {msgtype: "isydone", userid: userid, hubid: hubindex, msgvalue: done};
                pushServer(msg, function(data) {
                    console.log( (ddbg()), "done reading ISY hub: ", msg, " return: ", data);
                });
            }

        }
        
        function getIntVars(err, body) {
            if ( err && err!==200 ) {
                console.log( (ddbg()), "error retrieving ISY Int variables: ", err, body);
                checkDone("Int");
            } else {
                getISY_Vars(body, "Int");
            }
        }
        
        function getStateVars(err, body) {
            if ( err && err!==200 ) {
                console.log( (ddbg()), "error retrieving ISY State variables: ", err, body);
                checkDone("State");
            } else {
                getISY_Vars(body, "State");
            }
        }

        function getISY_Vars(body, vartype) {
            // make a single tile with all the variables in it
            var vartypes = ["", "Int", "State"];

            xml2js(body, function(err, result) {
                if ( !result || !result.vars ) {
                    checkDone(vartype);
                    return;
                }

                var varobj = result.vars.var;
                if ( typeof varobj!=="object" ) {
                    checkDone(vartype);
                    return;
                }

                // convert single variable object into an array of variable objects
                if ( !is_array(varobj) ) {
                    varobj = [varobj];
                }
                    
                varobj.forEach(function( obj) {
                    try {
                        var varid = obj["$"]["id"];
                        var vartypeid = parseInt(obj["$"]["type"]);
                    } catch (e) {
                        varid = 0;
                        vartypeid = 0;
                    }
                    if ( varid > 0 && vartype === vartypes[vartypeid] ) {
                        var prec = parseInt(obj.prec[0]);
                        var val10 = obj.val[0];
                        if ( !isNaN(prec) && prec !== 0 ) {
                            val10 = parseFloat(val10) / Math.pow(10, prec);
                        }
                        pvariables[vartype+"_"+varid] = val10.toString();
                        pvariables["prec_"+vartype+"_"+varid] = prec.toString();
                    }
                });
                checkDone(vartype);
            });

        }

        // get programs and setup program tiles much like how Piston tiles are done in ST and HE
        function getAllProgs(err, body) {
            if ( err && err!==200 ) {
                console.log( (ddbg()), "error retrieving ISY programs: ", err, body);
                checkDone("Progs");
            } else {

                // have to use the full parsing function here
                xml2js(body, function(xmlerr, result) {
                    var thetype = "isy";
                    if ( result ) {
                        try {
                            var programlist = result.programs.program;
                            if ( typeof programlist!=="object" ) {
                                checkDone("Progs");
                                return;
                            }

                            // // convert single variable object into an array of variable objects
                            if ( !is_array(programlist) ) {
                                programlist = [programlist];
                            }

                            // now lets get all the master program nodes
                            // and create a tile for any program that is not a folder
                            // TODO: recurse into folders and get programs there too
                            var pvalue;
                            var numprogs = programlist.length;
                            var progcount = 0;
                            if ( numprogs === 0 ) {
                                checkDone("Progs");
                                return;
                            }

                            programlist.forEach(function(prog) {
                                var proginfo = prog["$"];
                                var isfolder = proginfo.folder;

                                // if we have a folder don't add it - but flag the count to keep track of load status
                                if ( isfolder==="true" ) {
                                    progcount++;
                                    if ( progcount >= numprogs ) {
                                        checkDone("Progs");
                                    }

                                // create tile for programs that are not folders
                                } else {
                                    var progid = "prog_" + proginfo.id;

                                    // set the program name. Add Program if it isn't there
                                    // this will help make program names unique from tiles
                                    var progname;
                                    if ( is_array(prog.name) ) {
                                        progname = prog.name[0];
                                    } else {
                                        progname = prog.name;
                                    }
                                    if ( progname.toLowerCase().indexOf("program") === -1 ) {
                                        progname = "Program " + progname;
                                    }

                                    // var progcommands = "run|runThen|runElse|stop|enable|disable";
                                    // var progarr = progcommands.split("|");
                                    var progarr = ["run","runThen","runElse","stop","enable","disable"];
                                    pvalue = {name: progname};
                                    progarr.forEach(function(command) {
                                        pvalue[command] = command;
                                    });
                                    for ( var key in prog ) {
                                        if ( key!=="$" && key!=="name" ) {
                                            var val = prog[key];
                                            if ( is_array(val) ) {
                                                pvalue[key] = val[0];
                                            } else {
                                                pvalue[key] = val;
                                            }
                                        }
                                    }
                                    pvalue.status = proginfo.status;

                                    // get the enabled and runat states
                                    pvalue.enabled  = proginfo.enabled;
                                    pvalue.runAtStartup = proginfo.runAtStartup;
                                    var msg = {msgtype: "isynode", userid: userid, name: progname, hubid: hubindex, deviceid: progid, hint: "ISY_program", msgvalue: pvalue};
                                    pushServer(msg, function(data) {
                                        if ( DEBUGisy ) {
                                            console.log( (ddbg()), "done reading ISY programs: ", msg, " return: ", data);
                                        }
                                        checkDone("Progs");
                                    });
                                }
                            });
                        } catch (e) {
                            console.log( (ddbg()), "error - failed loading ISY programs. ", e);
                            checkDone("Progs");
                        }
                    }
                });
            }

        }

        function getAllNodes(err, body) {
            if ( err && err!==200 ) {
                console.log( (ddbg()), "error retrieving ISY nodes: ", err, body);
                checkDone("Nodes");
            } else {

                // note - changed to use xml2js
                xml2js(body, function(xmlerr, result) {
                    if ( !result ) {
                        checkDone("Nodes");
                        return;
                    }

                    // set our flags for handling asyncronous update status
                    var newdevices = {nodecount: 0, groupcount: 0, statuscount: 0, ranstatus: false};
                    var thenodes = result.nodes["node"];
                    var groups = result.nodes["group"];
                    var numnodes = count(thenodes);
                    var numgroups = count(groups);

                    // we run this after every node is updated to see if all are done
                    // and if all are updated then we get status details of each
                    // removing any that failed to update for whatever reason
                    function checkNodesDone() {
                        if ( newdevices.nodecount >= numnodes && !newdevices.ranstatus ) {
                            if ( DEBUGisy ) {
                                console.log( (ddbg()), "done reading first pass... getting details");
                            }
                            getNodesStatus();
                        }

                        // if we have read in all nodes and all groups, refresh the screen
                        if ( newdevices.ranstatus &&
                             newdevices.nodecount >= numnodes && 
                             newdevices.groupcount >= numgroups &&
                             newdevices.statuscount >= numnodes ) {
                            if ( DEBUGisy ) {
                                console.log( (ddbg()), "done reading all nodes. done: ", newdevices);
                            }
                            checkDone("Nodes");
                        }
                    }

                    for ( var obj in thenodes ) {
                        var node = thenodes[obj];
                        var id = node["address"][0].toString();
                        var hint = node["type"][0].toString();
    
                        // set hint to nothing if default of zeros is provided
                        if ( hint ) {
                            hint.replace( /\./g, "_" );
                            hint = "ISY " + hint;
                        }
    
                        var name = node["name"][0];
                        var pvalue = {"name": name};
                        if ( !name ) {
                            name = pvalue["name"];
                        }

                        var msg = {msgtype: "isynode", userid: userid, name: name, hubid: hubindex, deviceid: id, hint: hint, msgvalue: pvalue};
                        newdevices[id] = msg;
                        if ( DEBUGisy ) {
                            console.log( (ddbg()), "done reading initial ISY node info: ", msg);
                        }
                        newdevices.nodecount++;
                        checkNodesDone();
                    }

                    // now that we have all the nodes identified, get the details
                    // this makes a second write to the database for each node
                    function getNodesStatus() {
                        
                        newdevices.ranstatus = true;

                        _curl(hubEndpt + "/status", stheader, null, "GET")
                        .then( body => {
                            if ( !body ) {
                                console.log( (ddbg()), "error - node detail request returned nothing");
                                checkNodesDone();
                                return;
                            }
                            
                            xml2js(body, function(xmlerr, result) {
                                // console.log(">>>> node details: ", result);
                                try {
                                    if ( result ) {
                                        var nodes = result.nodes.node;
                                        if ( nodes && is_array(nodes) ) {
                                            nodes.forEach(function(node) {
                                                // var nodename = node["name"][0];
                                                var nodeid = node["$"]["id"];
                                                var props = node["property"];

                                                var msg = newdevices[nodeid];
                                                var pvalue = msg.msgvalue;

                                                // if there are props set values
                                                // otherwise just flag that we tried by incrementing the count
                                                if ( props && pvalue ) {

                                                    props.forEach(function(aprop) {
                                                        var obj = aprop['$'];
                                                        // map ISY logic to the HousePanel logic based on SmartThings and Hubitat
                                                        var subid = mapIsy(obj.id, obj.uom);
                                                        if ( obj.uom ) {
                                                            pvalue["uom_" + subid] = obj.uom;
                                                        }
                                                        pvalue = translateIsy(obj.id, obj.uom, subid, pvalue, obj.value, obj.formatted);
                                                    });

                                                    msg.msgvalue = pvalue;
                                                    pushServer(msg, function(data) {
                                                        if ( DEBUGisy ) {
                                                            console.log( (ddbg()), "ISY node: ", msg, " return: ", data);
                                                        }
                                                        newdevices.statuscount++;
                                                        checkNodesDone();
                                                    });
                                                } else {
                                                    newdevices.statuscount++;
                                                    checkNodesDone();
                                                }
                                            });
                                        } else {
                                            console.log( (ddbg()), "error - ", e);
                                            checkNodesDone();
                                            // throw "Something went wrong reading status from ISY";
                                        }
                                    } else {
                                        console.log( (ddbg()), "error - empty result returned in node detail");
                                        newdevices.statuscount = numnodes;
                                        checkNodesDone();
                                    }
                                } catch(e) { 
                                    console.log( (ddbg()), "error - ", e);
                                    newdevices.statuscount = numnodes;
                                    checkNodesDone();
                                }
                            });
                        });
                    }

                    // now get groups
                    if ( groups ) {
                        for ( var obj in groups ) {
                            var node = groups[obj];
                            var id = node["address"][0].toString();
                            var hint = "ISY_scene";
                            var name = node["name"][0];
            
                            // set the base tile to include name and items to turn scene on and off
                            var pvalue = {"name": name, "DON": "DON", "DOF":"DOF"};
                            var members = node.members[0];
            
                            // load up pvalue with links
                            if ( members && is_array(members.link) ) {
                                for ( var sceneitem in members.link ) {
                                    pvalue["scene_"+sceneitem] = members.link[sceneitem]["_"];
                                }
                            }
                            if ( !name ) {
                                name = pvalue["name"];
                            }
                            var msg = {msgtype: "isynode", userid: userid, name: name, hubid: hubindex, deviceid: id, hint: "ISY_scene", msgvalue: pvalue};
                            pushServer(msg, function(data) {
                                if ( DEBUGisy ) {
                                    console.log( (ddbg()), "ISY scene: ", msg, " return: ", data);
                                }
                                newdevices.groupcount++;
                                checkNodesDone();
                            });
                        }
                    } else {
                        numgroups = 0;
                        checkNodesDone();
                    }

            
                });
            }
        }
        // ------ end of getAllNodes

    });

}

function mapIsy(isyid, uom) {
    const idmap = {"ST": "switch", "OL": "onlevel", "SETLVL": "level", "BATLVL": "battery", "CV": "voltage", "TPW": "power",
                   "CLISPH": "heatingSetpoint", "CLISPC": "coolingSetpoint", "CLIHUM": "humidity", "LUMIN": "illuminance", 
                   "CLIMD": "thermostatMode", "CLIHCS": "thermostatState", "CLIFS": "thermostatFanMode",
                   "CLIFRS": "thermostatOperatingState", "CLISMD": "thermostatHold", "CLITEMP":"temperature"};
    var id = isyid;
    if ( uom==="17" && isyid==="ST" ) {
        id = "temperature";
    } else if ( idmap[isyid] ) {
        id = idmap[isyid];
    }
    return id;
}

function translateIsy(objid, uom, subid, value, val, formatted) {

    // convert levels for Insteon range
    if ( uom && uom==="100" ) {
        val = Math.floor(parseInt(val) * 100 / 255);
    }
    val = val.toString();

    if ( typeof formatted === "undefined" ) {
        formatted = "";
    }

    // set the HP equivalent subid for this type of node field
    // if maps are not present then the native ISY subid will show up
    var newvalue = clone(value);

    // handle special cases
    switch (objid) {

        case "ST":
            if ( (uom==="51" || uom==="100") ) {
                // newvalue["level"]= val;  // formatted.substr(0, formatted.length-1);
                if ( val!=="0" && val!=="100") {
                    newvalue["level"] = val;
                }
                if ( val==="0" ) {
                    val = "DOF";
                } else if ( val==="100" ) {
                    val = "DON";
                } else {
                    newvalue["level"] = val;
                    val = "DON";
                }
                newvalue[subid] = val;

            } else if (uom==="78") {
                val = (formatted==="Off" || val==="0") ? "DOF" : "DON";
                newvalue[subid] = val;

            } else if ( uom==="17" && subid==="temperature" ) {
                if ( typeof formatted==="undefined" || formatted==="" ) {
                    formatted = val + "°F";
                }
                newvalue[subid]= formatted;

            } else {
                val = (formatted==="Off" || val==="0" ? "DOF" : "DON");
                newvalue[subid] = val;
            }
            break;

        // handle situation where DOF and DON are sent as the command
        case "DOF":
        case "DON":
                if ( newvalue.switch ) {
                    newvalue.switch = objid;
                }
                newvalue[subid] = val;
                break;

        case "OL":
            if ( formatted && formatted==="On" ) {
                val = "100";
            } else if ( formatted && formatted==="Off" ) {
                val = "0";
            } else if ( formatted && formatted.substr(-1) === "%" ) {
                val = formatted.substr(0, formatted.length-1);
                if ( isNaN(parseInt(val)) ) {
                    val = "0";
                }
            } else {
                if ( isNaN(parseInt(val)) ) {
                    val = "0";
                }
            }
            newvalue[subid] = val;
            newvalue["level"] = val;
            break;

        case "CLISPC":
        case "CLISPH":
            if ( uom==="17" && (typeof formatted === "undefined" || formatted==="") ) {
                formatted = val + "°F";
            } else if ( (typeof formatted === "undefined" || formatted==="") ) {
                formatted = val;
            }
            newvalue[subid] = formatted;
            break;

        case "RR":
            var index = parseInt(val);
            if ( uom==="25" && !isNaN(index) && index<=31 ) {
                const RRindex = ["9.0 min", "8.0 min", "7.0 min", "6.0 min", "5.0 min", "4.5 min", "4.0 min", "3.5 min",
                                 "3.0 min", "2.5 min", "2.0 min", "1.5 min", "1.0 min", "47.0 sec", "43.0 sec", "38.5 sec",
                                 "34.0 sec", "32.0 sec", "30.0 sec", "28.0 sec", "26.0 sec", "23.5 sec", "21.5 sec", "19.0 sec",
                                 "8.5 sec", "6.5 sec", "4.5 sec", "2.0 sec", "0.5 sec", "0.3 sec", "0.2 sec", "0.1 sec"];
                val = RRindex[index];
            }
            newvalue[subid] = val;
            break;

        case "CLIFRS":
            var index = parseInt(val);
            const CLHindex = ["Off", "On", "On High", "On Medium", "Circulation", "Humidity Circ", "R/L Circ", "U/D Circ", "Quiet"];
            if ( uom==="80" && !isNaN(index) && index < CLHindex.length ) {
                val = CLHindex[index];
            }
            newvalue[subid] = val;
            break;

        case "CLIHCS":
            var index = parseInt(val);
            const CLFindex = ["Idle", "Heating", "Cooling", "Off"];
            if ( uom==="25" && !isNaN(index) && index < CLFindex.length ) {
                val = CLFindex[index];
            }
            newvalue[subid] = val;
            break;
        
        default:
            newvalue[subid] = formatted ? formatted : val;
            if ( newvalue[subid].substr(-1)==="F" || newvalue[subid].substr(-1)==="C" ) {
                newvalue[subid] = parseInt(newvalue[subid].substr(0, newvalue[subid].length-2)).toString();
            }
            break;
    }
    return newvalue;
}


var isgood = true;
try {
    var userinfo = JSON.parse(fs.readFileSync("/home/pi/hpserver/hpconnect.cfg","utf8"));
    var isyhost = userinfo.isyhost;
    var username = userinfo.username;
    var isyPassword = userinfo.isyPassword;
    var isyConnect = userinfo.isyConnect;
    var isyReset = userinfo.isyReset;
    var email = userinfo.email;
    var password = userinfo.password;
    var serverhost = userinfo.serverhost;
    // var serverhost2 = userinfo.serverhost2;
    var groovyPort = parseInt(userinfo.groovyPort);
} catch(e) {
    console.log(e);
    isgood = false;
}

// set up the socket
if ( isgood ) {
    setupISYSocket();
    setupGroovyListener();
    getIsyDevices();    
}
