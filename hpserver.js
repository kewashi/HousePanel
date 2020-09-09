"use strict";
process.title = 'hpserver';

// debug options
const DEBUG1 = false;               // basic debug info - file loading, hub loading
const DEBUGisy = false;             // ISY node return details
const DEBUG2 = false;               // authorization flow and ISY programs
const DEBUG2Ford = false;           // used to debug url encoding and decoding of secret
const DEBUG3 = false;               // passwords
const DEBUG4 = false;               // index, filters, options
const DEBUG5 = false;               // hub node detail
const DEBUG6 = false;               // tile position moves
const DEBUG7 = false;               // hub responses
const DEBUGvar = false;             // ISY variables
const DEBUG8 = false;               // API calls
const DEBUG9 =  false;              // ISY callbacks
const DEBUG10 = false;              // sibling tag
const DEBUG11 = false;              // rules
const DEBUG12 = false;              // hub push updates
const DEBUG13 = false;              // URL callbacks
const DEBUG14 = false;              // tile link details
const DEBUG15 = false;              // allthings and options dump
const DEBUG16 = false;              // customtiles writing
const DEBUG17 = false;              // push client
const DEBUG18 = false;              // ST, HE, and Ford messages in callHub -> getHubResponse
const DEBUG19 = false;              // ST and HE callback from Groovy

// various control options
const MQTTPOLY = false;             // subscribe to and log polyglot via MQTT
const MQTTHP = false;               // subscribe to and log HP via MQTT
const IGNOREPW = false;             // set this to true to accept any text as a valid password
const DONATE = true;                // set this to true to enable donation section
const ENABLERULES = true;           // set this to false to neuter all rules

// websocket and http servers
var webSocketServer = require('websocket').server;
var webSocketClient = require('websocket').client;
var path = require('path');
var http = require('http');
var https = require('https');
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
// var parser = require('fast-xml-parser');
var xml2js = require('xml2js').parseString;
var crypto = require('crypto');
const UTIL = require('util');
const mqtt = require('mqtt');
const os = require('os');
var cookieParser = require('cookie-parser');
const request = require('request');

// const SmartApp   = require('@smartthings/smartapp');

const defaultrooms = {
    "Kitchen": "clock|kitchen|sink|pantry|dinette" ,
    "Family": "clock|family|mud|fireplace|casual|thermostat",
    "Living": "clock|living|dining|entry|front door|foyer",
    "Office": "clock|office|computer|desk|work",
    "Bedroom": "clock|bedroom|kid|kids|bathroom|closet|master|guest",
    "Outside": "clock|garage|yard|outside|porch|patio|driveway|weather",
    "Music": "clock|sonos|music|tv|television|alexa|echo|stereo|bose|samsung|pioneer"
};

// load supporting modules
var utils = require("./utils");
const { urlencoded } = require('body-parser');

// global variables are all part of GLB object plus clients and allthings
var GLB = {};

// list of currently connected clients (users)
var clients = [];
// array of all tiles in all hubs
var allthings = {};

// server variables
var app;
var applistening = false;

function setCookie(res, thevar, theval, days) {
    var options = {SameSite: "lax"};
    if ( !days ) {
        days = 365;
    }
    options.maxAge = days*24*3600*1000;
    res.cookie(thevar, theval, options);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// get user from cookie
function getUserName(cookies) {
    var uname = "";

    if ( is_object(cookies) && typeof cookies.uname!=="undefined"  ) {
        uname = decodeUser(cookies.uname);
        if ( !uname ) { uname = "default"; }
        GLB.options["config"]["uname"] = uname;
    }
    return uname;
}

// this function gets the user name that matches the hash
function decodeUser(unamehash) {

    var uname = false;
    if ( GLB.options.config && array_key_exists("pword", GLB.options.config) ) {
        for ( var thisuname in GLB.options.config.pword ) {
            var codeuser = pw_hash(thisuname);
            if ( unamehash === codeuser) {
                uname = thisuname;
                break;
            }
        }
    }
    return uname;
}

function getTypes() {
    var thingtypes = [
        "actuator", "button", "routine","switch", "switchlevel", "bulb", "momentary", "contact",
        "motion", "lock", "thermostat", "temperature", "music", "audio", "valve",
        "door", "illuminance", "smoke", "water", "isy",
        "weather", "presence", "mode", "shm", "hsm", "piston", "other",
        "clock", "blank", "image", "frame", "video", "custom", "control", "power", "ford"
    ];
    thingtypes.sort();
    return thingtypes;
}

// get the active user and skin
function getSkin(uname) {
    var skin;
    var pwords;
    if ( typeof GLB.options!=="undefined" && GLB.options["config"] && GLB.options["config"]["pword"] ) {
        pwords = GLB.options["config"]["pword"];
    }

    if ( !pwords || utils.count(pwords)===0 ) {
        skin = "skin-housepanel";
    } else if ( uname && array_key_exists(uname, pwords) && is_array(pwords[uname]) ) {
        skin = pwords[uname][1] || "skin-housepanel";
    } else if ( array_key_exists(skin, GLB.options.config) ) {
        skin = GLB.options.config["skin"];
    } else {
        skin = "skin-housepanel";
    }
    return skin;
}

// read in customtiles ignoring the comments
// updated this to properly treat /*   */ comment blocks
function readCustomCss(skin) {
    var fname = skin + "/customtiles.css";
    var contents = fs.readFileSync(fname, 'utf8');
    return contents;
}

// call to write Custom Css Back to customtiles.css
function writeCustomCss(skin, str) {

    if ( typeof str === "undefined" ) {
        console.log( (ddbg()), "error - attempted to write null to customtiles");
        str = "";
    }

    // make sure we have a string
    if ( typeof str !== "string" ) {
        str = str.toString();
    }

    // proceed only if there is a main css file in this skin folder
    if ( skin && fs.existsSync(skin + "/housepanel.css") ) {
        var d = new Date();
        var today = d.toLocaleString();
        var fixstr = "";
        var opts = "w";

        // preserve the header info and update it with date
        var ipos = str.indexOf("*---*/");
        if ( ipos=== -1 ) {
            fixstr += "/* HousePanel Generated Tile Customization File */\n";
            if ( str.length ) {
                fixstr += "/* Updated: " + today + " *---*/\n";
            } else {
                fixstr += "/* Created: " + today + " *---*/\n";
            }
            fixstr += "/* ********************************************* */\n";
            fixstr += "/* ****** DO NOT EDIT THIS FILE DIRECTLY  ****** */\n";
            fixstr += "/* ****** EDITS MADE MAY BE REPLACED      ****** */\n";
            fixstr += "/* ****** WHENEVER TILE EDITOR IS USED    ****** */\n";
            fixstr += "/* ********************************************* */\n";
        } else {
            fixstr += "/* HousePanel Generated Tile Customization File */\n";
            fixstr += "/* Updated: " + today + " *---*/\n";
            ipos = ipos + 7;
            str = str.substring(ipos);
        }

        // fix addition of backslashes before quotes on some servers
        // this changes all instances of \" to just "
        if ( str.length ) {
            str= str.replace("\\\"","\"");
        }

        // add the content to the header
        fixstr += str;

        // write to specific skin folder if the location is valid
        try {
            fs.writeFileSync(skin + "/customtiles.css", fixstr, {encoding: "utf8", flag: opts});
            if ( DEBUG1 ) {
                console.log( (ddbg()), "custom CSS file saved in skin folder:", skin, " of size: ", fixstr.length);
            }
        } catch (e) {
            console.log( (ddbg()), e);
            console.log( (ddbg()), "error - failed to save custom CSS file in skin folder: ", skin);
        }
    }
}

function readOptions(caller) {

    var rewrite = false;
    var fname = "hmoptions.cfg";
    GLB.newuser = false;
    GLB.options = {};

    try {
        if ( !fs.existsSync(fname) ) {
            GLB.newuser = true;
            throw "hmoptions.cfg file not found.  New user assumed.  Welcome to HousePanel.";
        } else {
            GLB.options = JSON.parse(fs.readFileSync(fname, 'utf8'));
            if ( !GLB.options ) {
                GLB.options = {};
                throw "hmoptions.cfg file found but was not able to be processed.  Resetting.";
            }
        }

    } catch(e) {
        console.log( (ddbg()), e); 
        setDefaults();
        rewrite = true;
    }

    if ( !array_key_exists("config", GLB.options) ) {
        GLB.options.config = {};
        rewrite = true;
    }
    if ( !array_key_exists("specialtiles", GLB.options.config) ) {
        GLB.options.config["specialtiles"] = {"video": 4, "frame": 4, "image": 4, "blank": 4, "custom": 8};
        rewrite = true;
    }
    if ( !array_key_exists("port", GLB.options.config) ) {
        GLB.options.config.port = 3080;
        rewrite = true;
    }
    if ( !array_key_exists("kiosk", GLB.options.config) ) {
        GLB.options.config.kiosk = "false";
        rewrite = true;
    }
    if ( !array_key_exists("blackout", GLB.options.config) ) {
        GLB.options.config.blackout = "false";
        rewrite = true;
    }
    if ( !array_key_exists("webSocketServerPort", GLB.options.config) ) {
        GLB.options.config.webSocketServerPort = 1380;
        rewrite = true;
    }
    if ( !array_key_exists("fast_timer", GLB.options.config) ) {
        GLB.options.config.fast_timer = "0";
        rewrite = true;
    }
    if ( !array_key_exists("slow_timer", GLB.options.config) ) {
        GLB.options.config.slow_timer = "300000";
        rewrite = true;
    }
    if ( !array_key_exists("accucity", GLB.options.config) ) {
        GLB.options.config.accucity = "ann-arbor-mi";
        rewrite = true;
    }
    if ( !array_key_exists("accuregion", GLB.options.config) ) {
        GLB.options.config.accuregion = "us";
        rewrite = true;
    }
    if ( !array_key_exists("accucode", GLB.options.config) ) {
        GLB.options.config.accucode = "329380";
        rewrite = true;
    }
    if ( !array_key_exists("fcastcity", GLB.options.config) ) {
        GLB.options.config.fcastcity = "ann-arbor";
        rewrite = true;
    }
    if ( !array_key_exists("rules", GLB.options.config) ) {
        GLB.options.config.rules = "true";
        rewrite = true;
    }
    if ( !array_key_exists("hubpick", GLB.options.config) ) {
        GLB.options.config.hubpick = "all";
        rewrite = true;
    }
    if ( !array_key_exists("polisyip", GLB.options.config) ) {
        GLB.options.config.polisyip = "localhost";
        rewrite = true;
    }
    if ( !array_key_exists("uname", GLB.options.config) ) {
        GLB.options.config.uname = "default";
        rewrite = true;
    }

    // various error prevention checks are below
    if ( !array_key_exists("pword", GLB.options.config) ) {
        GLB.options.config["pword"] = {};
        GLB.options.config["pword"]["default"] =  ["","skin-housepanel"];
        GLB.options.config.uname = "default";
        rewrite = true;
    }

    // get valid port numbers
    try {
        var port = parseInt(GLB.options["config"]["port"]);
        if ( !port || isNaN(port) ) {
            port = 3080;
            rewrite = true;
        }
    } catch(e) {
        port = 3080;
        rewrite = true;
    }
    GLB.options["config"]["port"] = port;

    try {
        var webSocketServerPort = parseInt(GLB.options["config"]["webSocketServerPort"]);
        if ( !webSocketServerPort || isNaN(webSocketServerPort) ) {
            webSocketServerPort = 1380;
            rewrite = true;
        }
    } catch(e) {
        webSocketServerPort = 1380;
        rewrite = true;
    }
    GLB.options["config"]["webSocketServerPort"] = webSocketServerPort;

    // handle time settings
    if ( array_key_exists("time", GLB.options) ) {
        var timeval = GLB.options["time"];
        var info = timeval.split(" @ ");
        var version = info[0];
        timeval = info[1];
    } else {
        var d = new Date();
        timeval = d.getTime();
        timeval = timeval.toString();
        version = utils.HPVERSION;
        GLB.options["time"] = version + " @ " + timeval;
        rewrite = true;
    }

    if ( !array_key_exists("useroptions", GLB.options) ) {
        GLB.options["useroptions"]= getTypes();
        rewrite = true;
    }

    // read the hubs and set to empty if nothing there
    if ( array_key_exists("hubs", GLB.options["config"]) ) {
        if ( !is_array(GLB.options.config["hubs"]) ) { 
            GLB.options.config["hubs"] = [] 
            rewrite = true;
        } else {
            for ( var k in GLB.options.config.hubs ) {
                var hub = GLB.options.config.hubs[k];
                var oldval = hub.clientSecret;
                var decoded = decodeURIComponent(hub.clientSecret);
                GLB.options.config.hubs[k].clientSecret = decoded;

                if ( DEBUG2Ford ) {
                    console.log("after read: hub ", hub.hubType, " old= ", oldval, " secret= ", GLB.options.config.hubs[k].clientSecret);
                }
            }
        }
    } else {
        GLB.options.config["hubs"] = [];
        rewrite = true;
    }

    if (  GLB.options.config["hubs"].length > 0 ) {
        console.log( (ddbg()), 'Loading ',  GLB.options.config["hubs"].length,' hubs.');
        if ( DEBUG2 ) {
            console.log( (ddbg()), GLB.options.config["hubs"] );
        }
    } else {
        console.log( (ddbg()), 'No hubs found. HousePanel will only show special and custom tiles.');
    }

    if ( DEBUG1 ) {
        if ( !caller ) { caller = "unknown"; }
        console.log( (ddbg()), 'Config file for HP Version: ', version, " caller: ", caller);
    }

    // update the options file if we added default info
    // we skip the user section by excluding the username
    if ( rewrite ) {
        writeOptions(GLB.options);
    }

    if ( DEBUG2 ) {
        console.log("read hubs: ", GLB.options.config.hubs);
    }

}

function readRoomThings(caller, uname) {

    if ( DEBUG1 ) {
        console.log( (ddbg()), "Reading custom file for username: ", uname, " caller: ", caller);
    }

    var d = new Date();
    var timeval = d.getTime();
    timeval = timeval.toString();

    // get custom settings for this user
    // or create the custom config for new users
    var customfname = "hm_" + uname + ".cfg";
    if ( !fs.existsSync(customfname) ) {

        // if this is not the default user and if default user exists
        // we just use the default user's info
        // otherwise we use existing rooms or make a default
        if ( uname!=="default" && fs.existsSync("hm_default.cfg") ) {
            readRoomThings(caller, "default");
            writeRoomThings(GLB.options, uname);
        } else {
        
            // this format is now in real json format and includes user_ tiles
            // add a signature key to flag this format
            var customopt = {};
            customopt["::CUSTOM::"] = [uname, utils.HPVERSION, timeval];

            // if there are no rooms, create a default setup
            if ( !GLB.options.rooms || utils.count(GLB.options.rooms)===0 ||
                 !GLB.options.things || utils.count(GLB.options.things)===0 ) {
                setupDefaultRooms();
            }

            for (var key in GLB.options) {
                if ( key==="rooms" || key==="things" ) {
                    customopt[key] = GLB.options[key];
                }
            }
            var str_customopt = JSON.stringify(customopt, null, 1);
            fs.writeFileSync(customfname, str_customopt);
        }

    } else {

        // read this assuming new method only
        var str = fs.readFileSync(customfname, 'utf8');
        var str1 = str.replace("\r","");
        var str2 = str1.replace("\n","");

        try {
            var opts = JSON.parse(str2);
        } catch (e) {
            console.log( (ddbg()), "Error while parsing JSON in the existing options file: ", customfname, " Setting up defaults.");
            opts = {}
            opts["::CUSTOM::"] = [uname, utils.HPVERSION, timeval];
        }

        // protect against missing room array - use default list
        if ( !opts.rooms ) {
            opts.rooms = {};
            var k = 0;
            for (var room in defaultrooms) {
                opts.rooms[room] = k;
                k++;
            }
        }
        GLB.options["rooms"] = opts.rooms;
    
        // protect against missing things array - we'll happly make an empty room
        if ( !opts.things ) {
            opts.things = {};
        }

        // put things in rooms that exist
        GLB.options["things"] = {};
        for (var room in opts.rooms) {
            if ( array_key_exists(room, opts.things) ) {
                GLB.options["things"][room] = opts.things[room];
            } else {
                GLB.options["things"][room] = [];
            }
        }

        // flag the room as being updated
        GLB.options.config.uname = uname;
        writeOptions(GLB.options);

    }

}

function writeOptions(options) {
    if ( !is_object(options) ) {
        console.log( (ddbg()), "error - invalid options provided: ", options);
        return;
    }

    for ( var k in options.config.hubs ) {
        var hub = GLB.options.config.hubs[k];
        GLB.options.config.hubs[k].clientSecret = encodeURIComponent(hub.clientSecret);
    }

    var d = new Date();
    var timeval = d.getTime();
    timeval = timeval.toString();
    options["time"] = utils.HPVERSION + " @ " + timeval;

    // write the main section excluding rooms and things
    var mainopt = {};
    mainopt["time"] = utils.HPVERSION + " @ " + timeval;
    for (var key in GLB.options) {
        if ( key!=="rooms" && key!=="things"  ) {
            mainopt[key] = GLB.options[key];
        }
    }
    
    // write the main options file
    var stropt =  JSON.stringify(mainopt, null, 1);
    fs.writeFileSync("hmoptions.cfg", stropt, {encoding: "utf8", flag:"w"});

    for ( var k in options.config.hubs ) {
        var hub = GLB.options.config.hubs[k];
        var decoded = decodeURIComponent(hub.clientSecret);
        GLB.options.config.hubs[k].clientSecret = decoded;

        if ( DEBUG2Ford ) {
            console.log("after write: hub ", hub.hubType, " secret= ", GLB.options.config.hubs[k].clientSecret);
        }
    }
}

function writeRoomThings(options, uname) {
    if ( !uname ) { uname = "default"; }

    var d = new Date();
    var timeval = d.getTime();
    timeval = timeval.toString();
    var userfname = "hm_" + uname + ".cfg";

    // write only the rooms and things
    // add a signature key to flag this format
    var customopt = {};
    customopt["::CUSTOM::"] = [uname, utils.HPVERSION, timeval];
    for (var key in options) {
        if ( key==="rooms" || key==="things" ) {
            customopt[key] = options[key];
        }
    }
    var str_customopt = JSON.stringify(customopt, null, 1);
    fs.writeFileSync(userfname, str_customopt, {encoding: "utf8", flag:"w"});
}

function curl_call(host, headertype, nvpstr, formdata, calltype, callback) {
    var opts = {url: host};
    if ( !calltype ) {
        calltype = "GET";
    }
    opts.method = calltype;
    
    if ( nvpstr && typeof nvpstr === "object" ) {
        opts.form = nvpstr;
    } else if ( nvpstr && typeof nvpstr === "string" ) {
        opts.url = host + "?" + nvpstr;
    }
    
    if (formdata) {
        opts.formData = formdata;
    }
    
    if ( headertype ) {
        opts.headers = headertype;
    }
    request(opts, callback);
}

function getHubInfo(hub, access_token, endpt, clientId, clientSecret, reload, refresh_token) {

    // no need to check for valid access_token and endpt since we can't get here unless both are valid
    // direct settings for Ford, Lincoln, and ISY hubs
    if ( hub.hubType==="Ford" || hub.hubType==="Lincoln" || hub.hubType==="ISY" ) {
        hub["hubAccess"] = access_token;
        hub["hubEndpt"] = endpt;
        var rstr = getRandomInt(1001, 9999);
        if ( !hub["hubName"] ) {
            hub["hubName"]  = hub["hubType"];
        }
        if ( !hub["hubId"] ) {
            hub["hubId"] = hub["hubType"] + rstr.toString();
        }
        if ( typeof refresh_token === "string" && refresh_token ) {
            hub["hubRefresh"] = refresh_token;
            var today = new Date();
            hub["refreshTime"] = today.getTime().toString();
        }
        GLB.defhub = hub["hubId"];
        writeOptions(GLB.options);

        // retrieve all devices and go back to reauth page
        if ( reload ) {
            getDevices(hub, reload, "/reauth");
        }

    // for ST and HE hubs, we first call a function to get hub name and ID
    } else {
        var namehost = endpt + "/gethubinfo";
        var header = {"Authorization": "Bearer " + access_token};
        var nvpreq = {"scope": "app", "client_id": clientId, "client_secret": clientSecret};
        curl_call(namehost, header, nvpreq, false, "POST", nameidCallback);
    }

    function nameidCallback(err, res, body) {
        var jsonbody;
        var hubName;
        var hubId;
        if ( err ) {
            console.log( (ddbg()), "error - attempting to make hub name request.");
            return;
        }

        try {
            jsonbody = JSON.parse(body);
            hubName = jsonbody["sitename"];
            hubId = jsonbody["hubId"];
            if ( DEBUG2 ) {
                console.log( (ddbg()), "hubName request return: ", jsonbody);
            }
        } catch(e) {
            console.log( (ddbg()), "error retrieving hub name.");
            GLB.defhub = "-1";
            pushClient("reload", "/reauth");
            return;
        }

        if ( DEBUG2 ) {
            console.log( (ddbg()), "hub info: access_token= ", access_token, " endpt= ", endpt, " hubName= ", hubName, " hubId= ", hubId);
        }

        // now save our info
        // we also have to save the access point and endpt in case this was an oauth flow
        hub["hubAccess"] = access_token;
        hub["hubEndpt"] = endpt;
        hub["hubName"]  = hubName;
        hub["hubId"] = hubId;
        GLB.defhub = hubId;
        writeOptions(GLB.options);

        // retrieve all devices and go back to reauth page
        getDevices(hub, reload, "/reauth");
    }
}

// handle refresh tokens which happens over and over again
function fordRefreshToken(hub, access_token, endpt, refresh_token, clientId, clientSecret, reload, refresh) {

    // for now just hardwire it -- will figure out encode/decode later
    // TODO - figure out how to encode/decode upon entry and for storage
    clientSecret = "[\"|YW6>4%N>W71vwcE0zYzpz";

    var header = {'Content-Type' : "application/x-www-form-urlencoded"};
    var policy = "B2C_1A_signup_signin_common";
    if ( hub.hubType==="Lincoln" ) {
        policy = policy + "_Lincoln";
    }
    var tokenhost = "https://dah2vb2cprod.b2clogin.com/914d88b1-3523-4bf6-9be4-1b96b4f6f919/oauth2/v2.0/token";
    var nvpreq = "p=" + policy;
    var formData = {"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": clientId, "client_secret": clientSecret};

    if ( DEBUG2 ) {
        console.log( (ddbg()), "clientId, clientSecret: ", clientId, clientSecret);
        console.log( (ddbg()), "tokenhost: ", tokenhost, " nvpreq: ", nvpreq, " formData: ", formData);
    }
    curl_call(tokenhost, header, nvpreq, formData, "POST", function(err, res, body) {
        var refreshsuccess = true;
        try {
            var jsonbody = JSON.parse(body);
            access_token = jsonbody["access_token"];
            refresh_token = jsonbody["refresh_token"];
            var expiresin = jsonbody["expires_in"];

            // set refresh timer to 2 minutes before expiration
            if ( !expiresin || isNaN(parseInt(expiresin)) ) {
                expiresin = 18*60000;
            } else {
                expiresin = (parseInt(expiresin) - 120) * 1000;
            }
        } catch(e) {
            // primary token needs to be redone - the refresh token has expired
            // TODO - find a graceful way to tell the user
            refreshsuccess = false;
        }

        // if we get back a good access_token and refresh_token, repeat the process
        // notice the true boolean last parameter in the call - this signals to refresh repeatedly
        if ( refreshsuccess && access_token && refresh_token && expiresin ) {
            if ( DEBUG2 ) {
                console.log( (ddbg()),"Refresh return... access_token: ", access_token, " refresh_token: ", refresh_token, " endpoint: ", endpt);
            }
            getHubInfo(hub, access_token, endpt, clientId, clientSecret, reload, refresh_token);
            // if ( refresh ) {
            //     setTimeout( async function() {
            //         await fordRefreshToken(hub, access_token, endpt, refresh_token, clientId, clientSecret, false, true);
            //     }, expiresin);
            // }
        } else {
            GLB.defhub = "-1";
            console.log( (ddbg()), "refresh token error for hub: " + hub.hubType + " access_token: ", access_token, " endpt: ", endpt, " refresh: ", refresh_token, "\n body: ", body);
            pushClient("reload", "/reauth");
        }
    });

}

function getAccessToken(code, hub) {

    // these are the parameters determined here using a series of curl calls and callbacks
    var access_token = "";
    var endpt = "";
    var refresh_token;
    var hubType = hub["hubType"];
    var hubName = hub["hubName"];
    var hubHost = hub["hubHost"];
    var clientId = hub["clientId"];
    var clientSecret = hub["clientSecret"];

    // save
    var csecret = clientSecret;

    // for now just hardwire it -- will figure out encode/decode later
    // TODO - figure out how to encode/decode upon entry and for storage
    if ( hubType==="Ford" ) {
        clientSecret = "[\"|YW6>4%N>W71vwcE0zYzpz";
    }

    if ( DEBUG2 ) {
        console.log( (ddbg()), "user clientSecret: ", csecret, " fixed clientSecret: ", clientSecret);
    }

    var redirect = GLB.returnURL + "/oauth";
    var header = {'Content-Type' : "application/x-www-form-urlencoded"};

    // Ford and Lincoln tokens
    if ( hubType === "Ford" || hubType === "Lincoln" ) {
        var policy = "B2C_1A_signup_signin_common";
        if ( hub.hubType==="Lincoln" ) {
            policy = policy + "_Lincoln";
        }

        // we now always assume clientId and clientSecret are already encoded
        var tokenhost = "https://dah2vb2cprod.b2clogin.com/914d88b1-3523-4bf6-9be4-1b96b4f6f919/oauth2/v2.0/token";
        var nvpreq = "p=" + policy;
        var formData = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
                        "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};

        if ( DEBUG2 ) {
            console.log( (ddbg()), "clientId, clientSecret: ", clientId, clientSecret);
            console.log( (ddbg()), "tokenhost: ", tokenhost, " nvpreq: ", nvpreq, " formData: ", formData);
        }
        
        if ( !DEBUG2Ford ) {
            curl_call(tokenhost, header, nvpreq, formData, "POST", fordCallback);
        }

    // ST and HE functions to get accesstoken and endpoint
    } else {
        tokenhost = hubHost + "/oauth/token";
        var nvpreq = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
                      "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};
        if ( DEBUG2 ) {
            console.log( (ddbg()), "calling with nvpreq: ", nvpreq);
        }
        curl_call(tokenhost, header, nvpreq, false, "POST", tokenCallback);
    }

    function fordCallback(err, res, body) {
        var jsonbody = JSON.parse(body);
        access_token = jsonbody["access_token"];
        refresh_token = jsonbody["refresh_token"];
        var expiresin = jsonbody["expires_in"];

        // set refresh timer to 2 minutes before expiration
        if ( !expiresin || isNaN(parseInt(expiresin)) ) {
            expiresin = 18*60000;
        } else {
            expiresin = (parseInt(expiresin) - 120) * 1000;
        }
        endpt = "https://api.mps.ford.com/api/fordconnect/vehicles/v1";

        if ( access_token && refresh_token ) {
            if ( DEBUG2 ) {
                console.log( (ddbg()),"Ford access_token: ", access_token, " refresh_token: ", refresh_token, " endpoint: ", endpt);
            }

            // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
            // this doesn't work so we just do a refresh when the panel is refreshed
            // setTimeout( async function() {
            //     await fordRefreshToken(hub, access_token, endpt, refresh_token, clientId, clientSecret, false, true);
            // }, expiresin);

            getHubInfo(hub, access_token, endpt, clientId, clientSecret, true, refresh_token);
        } else {
            GLB.defhub = "-1";
            console.log( (ddbg()), "fordCallback error authorizing " + hub.hubType + " hub. bad access_token: ", access_token, " or endpt: ", endpt, " or refresh: ", refresh_token, " err: ", err, "\n body: ", body);
            pushClient("reload", "/reauth");
        }
    }

    // callback from the access_token request
    function tokenCallback(err, res, body) {
        // save the access_token
        var jsonbody = JSON.parse(body);
        if ( DEBUG2 ) {
            console.log( (ddbg()), hubType + " access_token return: ", jsonbody);
        }

        if ( jsonbody["error"] ) {
            console.log( (ddbg()), "error authorizing hub: ", hubName, " error: ", jsonbody["error"]);
            console.log( (ddbg()), "calling params: ", nvpreq );
            GLB.defhub = "-1";
            pushClient("reload", "/reauth");
        } else if ( typeof jsonbody==="object" && array_key_exists("access_token", jsonbody) ) {
            access_token = jsonbody["access_token"];
            if (access_token) {
                var ephost;
                if ( hubType==="SmartThings" ) {
                    ephost = hubHost + "/api/smartapps/endpoints";
                } else if ( hubType ==="Hubitat" ) {
                    ephost = hubHost + "/apps/api/endpoints";
                } else {
                    console.log( (ddbg()), "Invalid hub type: ", hubType, " in access_token request call");
                    GLB.defhub = "-1";
                    pushClient("reload", "/reauth");
                    return;
                }

                if ( DEBUG2 ) {
                    console.log( (ddbg()), "getting endpoints next using access_token: ", access_token);
                }
                header = {"Authorization": "Bearer " + access_token};
                curl_call(ephost, header, false, false, "GET", endptCallback);
            }
        } else {
            console.log( (ddbg()), "Unknown error authorizing hub: ", hubName, " error: ", err, " body: ", body);
            GLB.defhub = "-1";
            pushClient("reload", "/reauth");
        }
    }        
    
    function endptCallback(err, res, body) {
        var jsonbody;
        try {
            jsonbody = JSON.parse(body);
            if ( DEBUG2 ) {
                console.log( (ddbg()), "endpoint return: ", jsonbody);
            }
        } catch(e) {
            err = e;
        }

        if ( err ) {
            console.log( (ddbg()), "getEndpoint error authorizing " + hub.hubType + " hub. error: ", err);
            GLB.defhub = "-1";
            pushClient("reload", "/reauth");
        } else {
            var endptzero = jsonbody[0];
            endpt = endptzero.uri;
        }

        if ( access_token && endpt ) {
            if ( DEBUG2 ) {
                console.log( (ddbg()),"access_token and endpt: ", access_token, endpt);
            }
            getHubInfo(hub, access_token, endpt, clientId, clientSecret, true);

        } else {
            GLB.defhub = "-1";
            console.log( (ddbg()), "getEndpoint error authorizing " + hub.hubType + " hub. bad access_token: ", access_token, " or endpt: ", endpt);
            pushClient("reload", "/reauth");
        }
    }
}

// this makes Insteon ID's look good but it messes up the hub calls
// which oddly enough expect the id in the mangled form that does not match
// the way the id is written on the Insteon device
function fixISYid(id) {
    // if ( id.indexOf(" ") !== -1 ) {
    //     var idparts = id.split(" ");
    //     if ( idparts.length===4 ) {
    //         idparts.forEach(function(idp, i) {
    //             if ( idp.length===1 ) {
    //                 idparts[i] = "0" + idp;
    //             }
    //         });
    //         id = idparts.join(".");
    //     }
    // }
    return id;
}

function getAllThings(reload) {
    
    allthings = {};

    // add the special tiles
    addSpecials();
    updateOptions(false);

    // get all things from all configured servers with a valid access and endpoint
    var hubs = GLB.options.config["hubs"];
    if ( hubs && is_array(hubs) && hubs.length ) {
        hubs.forEach(async function(hub) {
            if ( hub.hubAccess && hub.hubEndpt ) {
                if ( DEBUG2 ) {
                    console.log( (ddbg()), "Getting devices for hub type: ", hub.hubType, "\n access_token: ", hub.hubAccess, "\n endpoint: ", hub.hubEndpt);
                }

                if ( hub.hubType==="Ford" && hub["hubAccess"] && hub["hubEndpt"] && hub["hubRefresh"] ) {
                    // refresh Ford token before getting vehicles upon request just to be sure
                    await fordRefreshToken(hub, hub["hubAccess"], hub["hubEndpt"], hub["hubRefresh"], hub["clientId"], hub["clientSecret"], false, false);
                }

                getDevices(hub, reload, "/");
            }
        });
    }
}

function getDevices(hub, reload, reloadpath) {

    var hubnum = hub["hubId"];
    var hubType = hub["hubType"];
    var hubAccess  = hub["hubAccess"];
    var hubEndpt = hub["hubEndpt"];
    var clientId = hub["clientId"];
    var clientSecret = hub["clientSecret"];
    var hubName = hub["hubName"];

    // retrieve all things from ST or HE
    if ( hubType==="SmartThings" || hubType==="Hubitat" ) {
        getHubDevices();

    // retrieve all things from ISY
    } else if ( hubType==="ISY" ) {
        getIsyDevices();
    
    // retrieve all things from Ford of Lincoln
    } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
        // console.log("Getting Ford vehicles...");
        getFordVehicles();

    } else {
        console.log( (ddbg()), "error - attempt to read an unknown hub type= ", hubType);
        pushClient("reload", reloadpath);
    }

    function getHubDevices() {
        var stheader = {"Authorization": "Bearer " + hubAccess};
        var params = {client_secret: clientId,
                      scope: "app",
                      client_id: clientSecret};
        curl_call(hubEndpt + "/getallthings", stheader, params, false, "POST", hubInfoCallback);
    }

    // callback for loading ST and HE hub devices
    function hubInfoCallback(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "error retrieving devices: ", err);
        } else {
            try {
                var jsonbody = JSON.parse(body);
            } catch (e) {
                console.log( (ddbg()), "error translating devices: ", e);
                jsonbody = {};
                return;
            }
            if (DEBUG1) {
                console.log( (ddbg()), "Retrieved ", jsonbody.length, " things from hub: ", hubName);
            }    

            // configure returned array with the "id"
            if (jsonbody && is_array(jsonbody) ) {
                jsonbody.forEach(function(content) {
                    var thetype = content["type"];
                    var id = content["id"];
                    var idx = thetype + "|" + id;
                    var origname = content["name"] || "";
                    var pvalue = content["value"];

                    // if a name isn't there use master name
                    if ( !pvalue.name ) {
                        pvalue.name = origname;
                    }

                    // deal with presence tiles
                    if ( thetype==="presence" && pvalue["presence"]==="not present" ) {
                        pvalue["presence"] = "absent";
                    }
                    // handle audio tiles
                    if ( thetype==="audio" ) {
                        pvalue = translateAudio(pvalue);
                    } else if ( thetype==="music" ) {
                        pvalue = translateMusic(pvalue);
                    }

                    // this is the proper place to load customizations
                    // and we have to do it for ISY too
                    var pvalue = getCustomTile(pvalue, thetype, id);
                    if ( !origname ) {
                        origname = pvalue["name"];
                    }

                    if ( thetype==="weather" ) {
                        pvalue = translateWeather(origname, pvalue);
                    }

                    allthings[idx] = {
                        "id": id,
                        "name": origname, 
                        "hubnum": hubnum,
                        "type": thetype,
                        "hint": hubType, 
                        "refresh": "normal",
                        "value": pvalue
                    };
                });
            }
            updateOptions(reload, reloadpath);
        }
    }

    async function getFordVehicles() {

        // now we call vehicle information query to get vehicle ID
        // API version is fixed for now
        var header = {
            "Authorization": "Bearer " + hubAccess,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-version": "2019-01-01",
            "Application-Id": hub["hubId"],
        };
        var endpt = hub["hubEndpt"];
        curl_call(endpt, header, false, false, "GET", vehicleInfoCallback);
    }

    function vehicleInfoCallback(err, res, body) {

        try {
            var jsonbody = JSON.parse(body);
        } catch(e) {
            console.log(e, " body: ", body);
            pushClient("reload", reloadpath);
            return;
        }
        var thetype = "ford";
        if ( jsonbody.status === "SUCCESS" && array_key_exists("vehicles", jsonbody) && is_array(jsonbody.vehicles) ) {
            jsonbody.vehicles.forEach(function(obj) {
                var vehicleid = obj.vehicleId;
                var idx = thetype + "|" + vehicleid;
                if ( obj.nickName ) {
                    var vehiclename = obj.nickName;
                } else {
                    vehiclename = obj.modelName;
                    obj.nickName = obj.modelName;
                }
                var pvalue = {name: vehiclename};
                for (var subid in obj) {
                    if ( subid!=="vehicleId" ) {

                        // change color to vehicle color since color is special
                        if ( subid==="color" ) {
                            pvalue["vehiclecolor"] = obj[subid];
                        } else {
                            pvalue[subid] = obj[subid];
                        }
                    }
                }

                // add all the api call functions 
                // removed _status and _location since they don't appear to work
                // the location and status are returned in the odometer call
                pvalue["_odometer"] = "_odometer";
                pvalue["_unlock"] = "_unlock";
                pvalue["_lock"] = "_lock";
                pvalue["_startEngine"] = "_startEngine";
                pvalue["_stopEngine"] = "_stopEngine";
                pvalue["_wake"] = "_wake";
                // pvalue["_status"] = "_status";
                // pvalue["_location"] = "_location";

                pvalue = getCustomTile(pvalue, thetype, vehicleid);
                allthings[idx] = {
                    "id": vehicleid,
                    "name": vehiclename, 
                    "hubnum": hubnum,
                    "type": thetype,
                    "hint": hubType,
                    "refresh": "normal",
                    "value": pvalue
                };

            });

            // update main options file
            updateOptions(reload, reloadpath);

            // now call the vehicle info function again for every vehicle but this time with the vehicle ID
            // var header = {
            //     "Authorization": "Bearer " + hubAccess,
            //     "Accept": "application/json",
            //     "Content-Type": "application/json",
            //     "api-version": "2019-01-01",
            //     "Application-Id": hub["hubId"],
            // };
            // curl_call(endpt, header, false, false, "GET", vehicleInfoCallback);
    
        }

    }

    // function for loading ISY hub devices
    function getIsyDevices() {
        var buff = Buffer.from(hubAccess);
        var base64 = buff.toString('base64');
        var stheader = {"Authorization": "Basic " + base64};

        // now read in any int and state variables
        var vidx = "isy|vars";
        if ( allthings[vidx] ) { delete allthings[vidx]; }
        curl_call(hubEndpt + "/vars/get/1", stheader, false, false, "GET", getIntVars);
        curl_call(hubEndpt + "/vars/get/2", stheader, false, false, "GET", getStateVars);

        // also get programs
        curl_call(hubEndpt + "/programs?subfolders=true", stheader, false, false, "GET", getAllProgs);

        // now get all the nodes and do callback to auth page
        curl_call(hubEndpt + "/nodes", stheader, false, false, "GET", getAllNodes);
            
        function getIntVars(err, res, body) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY int variables: ", err);
            } else {

                // create the variable thing if not there
                var id = "vars";
                var thetype = "isy";
                var idx = thetype + "|" + id;
                if ( !array_key_exists(idx, allthings) ) {
                    var pvalue = {name: "Variables"};
                    pvalue = getCustomTile(pvalue, thetype, id);
                    allthings[idx] = {id: id, name: "Variables", hubnum: hubnum, type: thetype, hint: "ISY variable", refresh: "never", value: pvalue };
                }
                getISY_Vars(body, "int");
                updateOptions(false, reloadpath);
            }
        }
        
        function getStateVars(err, res, body) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY state variables: ", err);
            } else {
                
                // create the variable thing if not there
                var id = "vars";
                var thetype = "isy";
                var idx = thetype + "|" + id;
                if ( !array_key_exists(idx, allthings) ) {
                    var pvalue = {name: "Variables"};
                    pvalue = getCustomTile(pvalue, thetype, id);
                    allthings[idx] = {id: id, name: "Variables", hubnum: hubnum, type: thetype, hint: "ISY variable", refresh: "never", value: pvalue };
                }
        
                getISY_Vars(body, "state");
                updateOptions(false, reloadpath);
            }
        }

        async function getISY_Vars(body, vartype) {
            // make a single tile with all the variables in it
            var vartypes = ["", "int", "state"];
            var id = "vars";
            var thetype = "isy";
            var idx = thetype + "|" + id;
            if ( !array_key_exists(idx, allthings) ) {
                return;
            }

            if (DEBUGvar) {
                console.log( (ddbg()), body );
            }

            await xml2js(body, function(err, result) {
                if (DEBUGvar) {
                    console.log( (ddbg()), vartype, "variables: ", UTIL.inspect(result, false, null, false) );
                }

                var varobj = result.vars.var;
                if ( !is_object(varobj) ) {
                    return;
                }

                // convert single variable object into an array of variable objects
                if ( !is_array(varobj) ) {
                    varobj = [varobj];
                }
                    
                var pvalue = allthings[idx]["value"];
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
                        pvalue[vartype+"_"+varid] = val10.toString();
                        pvalue["prec_"+vartype+"_"+varid] = prec.toString();
                    }
                });

                allthings[idx]["value"] = pvalue;
                if ( DEBUGvar ) {
                    console.log( (ddbg()), "New variable value: ", pvalue);
                }
            });
        }

        // get programs and setup program tiles much like how Piston tiles are done in ST and HE
        async function getAllProgs(err, res, body) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY programs: ", err);
            } else {

                // have to use the full parsing function here
                await xml2js(body, function(xmlerr, result) {
                    var thetype = "isy";
                    try {
                        if ( result ) {

                            var programlist = result.programs.program;
                            if ( !is_object(programlist) ) {
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
                            programlist.forEach(function(prog) {
                                var proginfo = prog["$"];
                                var isfolder = proginfo.folder;
                                if ( DEBUG7 ) {
                                    console.log( (ddbg()), "Program details: ", UTIL.inspect(prog, false, null, false) );
                                }

                                // if we have a folder don't add it
                                if ( isfolder==="true" ) {
                                    if ( DEBUG7 ) {
                                        console.log( (ddbg()), "Program ", prog.name, " is a folder. id: ", proginfo.id, " Status: ", proginfo.status);
                                    }

                                // create tile for programs that are not folders
                                } else {
                                    if ( DEBUG7 ) {
                                        console.log( (ddbg()), "Program ", prog.name, " id: ", proginfo.id, " Status: ", proginfo.status, " Last run: ", prog.lastRunTime );
                                    }
                                    var progid = "prog_" + proginfo.id;
                                    var idx  = thetype + "|" + progid;

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
                                    
                                    // call customizer
                                    pvalue = getCustomTile(pvalue, thetype, progid);

                                    allthings[idx] = {
                                        "id": progid,
                                        "name": progname, 
                                        "hubnum": hubnum,
                                        "type": thetype,
                                        "hint": "ISY program",
                                        "refresh": "normal",
                                        "value": pvalue
                                    };
                                }
                            });
                        }
                    } catch (e) {
                        console.log( (ddbg()), "error - failed loading ISY programs. ", e);
                    }
                });
                updateOptions(false, reloadpath);
            }

        }

        async function getAllNodes(err, res, body) {
            var thetype = "isy";
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY nodes: ", err);
                return;
            } else {

                // note - changed to use xml2js
                await xml2js(body, function(xmlerr, result) {
                    if ( DEBUGisy ) {
                        console.log( (ddbg()), "xml2js nodes: ", UTIL.inspect(result, false, null, false) );
                    }
                    var thenodes = result.nodes["node"];
                    for ( var obj in thenodes ) {
                        var node = thenodes[obj];
                        var id = fixISYid(node["address"][0].toString());
    
                        var idx = thetype + "|" + id;
                        var hint = node["type"][0].toString();
    
                        // set hint to nothing if default of zeros is provided
                        // TODO - provide a more useful mapping of hints to type names
                        // until then user can still style hints using CSS
                        if ( hint ) {
                            hint.replace( /\./g, "_" );
                            hint = "ISY " + hint;
                        }
    
                        var name = node["name"][0];
                        var pvalue = {"name": name};
    
                        // this is the proper place to load customizations
                        pvalue = getCustomTile(pvalue, thetype, id);
                        if ( !name ) {
                            name = pvalue["name"];
                        }
    
                        // set bare minimum info
                        // this is updated below in the callback after getting node details
                        allthings[idx] = {
                            "id": id,
                            "name": name, 
                            "hubnum": hubnum,
                            "type": thetype, 
                            "hint": hint,
                            "refresh": "never",
                            "value": pvalue
                        };
                    }

                    var groups = result.nodes["group"];
                    for ( var obj in groups ) {
                        var node = groups[obj];
                        var id = fixISYid(node["address"][0].toString());
                        var idx = thetype + "|" + id;
                        var hint = "ISY scene";
                        var name = node["name"][0];
        
                        // set the base tile to include name and items to turn scene on and off
                        var pvalue = {"name": name, "DON": "DON", "DOF":"DOF"};
                        var members = node.members[0];
        
                        // load up pvalue with links
                        if ( members && array_key_exists("link", members) && is_array(members.link) ) {
                            for ( var sceneitem in members.link ) {
                                pvalue["scene_"+sceneitem] = members.link[sceneitem]["_"];
                            }
                        }
        
                        // this is the proper place to load customizations
                        pvalue = getCustomTile(pvalue, thetype, id);
                        if ( !name ) {
                            name = pvalue["name"];
                        }
        
                        // set tile up
                        allthings[idx] = {
                            "id": id,
                            "name": name, 
                            "hubnum": hubnum,
                            "type": thetype, 
                            "hint": hint,
                            "refresh": "never",
                            "value": pvalue
                        };
        
                        if (DEBUGisy) {
                            console.log( (ddbg()), "id= ", id," hint= ", hint, " node: ", node, " pvalue: ", pvalue);
                        }
                    }
            
                });
            }
        
            // now that we have all the nodes identified, get the details
            curl_call(hubEndpt + "/status", stheader, false, false, "GET", callbackStatusInfo);

            async function callbackStatusInfo(err, res, body) {
                await xml2js(body, function(xmlerr, result) {
                    try {
                        if ( result ) {

                            var nodes = result.nodes.node;
                            if ( DEBUG5 ) {
                                console.log( (ddbg()), "node details: ", UTIL.inspect(nodes, false, null, false) );
                            }
                            if ( nodes ) {
                                nodes.forEach(function(node) {
                                    var nodeid = fixISYid(node["$"]["id"]);
                                    var idx = "isy|" + nodeid;
                                    var value = clone(allthings[idx]["value"]);
                                    var props = node["property"];

                                    // if there are props set values
                                    if ( props ) {
                                        if ( DEBUG5 ) {
                                            console.log( (ddbg()), "ISY status callback. node: ", nodeid, " properties: ", props);
                                        }
                                        setIsyFields(nodeid, value, props);
                                    }
                                });
                            } else {
                                throw "Something went wrong reading status from ISY";
                            }
                        }
                    } catch(e) { 
                        console.log( (ddbg()), "error - ", e);
                    }
                });

                updateOptions(reload, reloadpath);
                // update things and reload page after handling all tiles
                // setTimeout( function() {
                //     updateOptions(reload, reloadpath);
                // }, 5000);
            }
        }
    }
}

function mapIsy(isyid, uom) {
    const idmap = {"ST": "switch", "OL": "onlevel", "SETLVL": "level", "BATLVL": "battery", "CV": "voltage", "TPW": "power",
                   "CLISPH": "heatingSetpoint", "CLISPC": "coolingSetpoint", "CLIHUM": "humidity", "LUMIN": "illuminance", 
                   "CLIMD": "thermostatMode", "CLIHCS": "thermostatState", "CLIFS": "thermostatFanMode",
                   "CLIFRS": "thermostatOperatingState", "CLISMD": "thermostatHold", "CLITEMP":"temperature"};
    var id = isyid;
    if ( uom==="17" && isyid==="ST" ) {
        id = "temperature";
    } else if ( array_key_exists(isyid, idmap) ) {
        id = idmap[isyid];
    }

    return id;
}

function translateIsy(nodeid, objid, uom, subid, value, val, formatted) {

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

        // case "CLIHUM":
        // case "BATLVL":
        //     newvalue[subid] = val;
        //     break;

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

function objMerge(obj, newobj) {
    for ( var key in newobj ) {
        obj[key] = newobj[key];
    }
    return clone(obj);
}

function setIsyFields(nodeid, value, props) {
    var idx = "isy|" + nodeid;
    if ( is_array(props) ) {
        props.forEach(function(aprop) {
            var obj = aprop['$'];
            // map ISY logic to the HousePanel logic based on SmartThings and Hubitat
            var subid = mapIsy(obj.id, obj.uom);
            value["uom_" + subid] = obj.uom;
            var val = obj.value;
            value = translateIsy(nodeid, obj.id, obj.uom, subid, value, val, obj.formatted);
            allthings[idx]["value"] = clone(value);
            pushClient(nodeid, "isy", subid, value, false, false);
        });
    }
}

// returns the maximum index from the options
function getMaxIndex() {
    var optindex = GLB.options.index;
    var maxindex = 0;
    if ( typeof optindex==="object" ) {
        for ( var key in optindex ) {
            var value = parseInt(optindex[key]);
            if ( !isNaN(value) ) {
                maxindex = ( value > maxindex ) ? value : maxindex;
            }
        }
    }
    return maxindex;
}

// updates the global options array with new things found on hub
function updateOptions(reload, reloadpath) {

    var update = false;
    if ( !GLB.options ) {
        GLB.options = {};
        update = true;
    }
    
    if ( !array_key_exists("index", GLB.options )) {
        GLB.options.index = {};
        update = true;
    }
   
    // make all the user options visible by default
    if ( !array_key_exists("useroptions", GLB.options )) {
        GLB.options["useroptions"] = getTypes();
    }

    // find the largest index number for a sensor in our index
    var cnt = getMaxIndex() + 1;

    // update the index with latest sensor information
    for (var thingid in allthings) {
        // var thesensor = allthings[thingid];
        if ( !array_key_exists(thingid, GLB.options["index"]) ||
             parseInt(GLB.options["index"][thingid])===0 ) {
            GLB.options["index"][thingid] = cnt;
            update = true;
            cnt++;
        }
    }
    
    // save the options file
    if ( update ) {
        // make exactly the right number of special tiles
        var specialtiles = getSpecials();
        for (var stype in specialtiles) {
            var sid = specialtiles[stype];
            var customcnt = getCustomCount(stype, sid[3]);
            createSpecialIndex(customcnt, stype, sid[0]);
        }

        writeOptions(GLB.options);
    }

    // signal clients to reload
    if ( reload && reloadpath) {
        pushClient("reload", reloadpath);
    }
}

function setupDefaultRooms() {
    // make a default options array based on the old logic
    // protocol for the options array is an array of room names
    // where each item is an array with the first element being the order number
    // second element is an optional alternate name defaulted to room name
    // each subsequent item is then a tuple of ST id and ST type
    // encoded as ST-id|ST-type to enable an easy quick text search
    GLB.options["rooms"] = {};
    GLB.options["things"] = {};

    var k = 0;
    for (var room in defaultrooms) {
        GLB.options["rooms"][room] = k;
        GLB.options["things"][room] = [];
        k++;
    }

    // organize things into rooms if we have things loaded
    if ( allthings && GLB.options["index"] ) {
        for (var thingid in allthings) {
            var thesensor = allthings[thingid];
            var thename= thesensor["name"].toLowerCase();
            var k = GLB.options["index"][thingid];
            if ( k ) {
                for (var room in defaultrooms) {
                    var checkarr = defaultrooms[room].split("|");
                    checkarr.forEach(function(keyword) {
                        var islocated = thename.indexOf(keyword);
                        if ( islocated !== -1 ) {
                            var tile = [k,0,0,1,""];
                            GLB.options["things"][room].push(tile);
                        }
                    });
                }
            }
        }
    }
}

function getSpecials() {
    // GLB.options.config["specialtiles"] = {"video": 4, "frame": 4, "image": 4, "blank": 4, "custom": 8};
    GLB.options.config["specialtiles"] = {};
    var obj = {
        "video":  ["vid",480,240, 4, "normal"], 
        "frame":  ["frame",480,212, 4, "slow"],
        "image":  ["img",480,240, 4, "normal"],
        "blank":  ["blank",120,150, 2, "never"],
        "custom": ["custom_",120,150, 8, "normal"]
    };

    for ( var key in obj ) {
        GLB.options.config["specialtiles"][key] = obj[key][3];
    }

    return obj;
   
}

// set defaults here
function setDefaults() {

    GLB.options = {};
    GLB.options.config = {};
    GLB.options.config["port"] = "3080";
    GLB.options.config["kiosk"] = "false";
    GLB.options.config["blackout"] = "false";
    GLB.options.config["webSocketServerPort"] = "1380";
    GLB.options.config["timezone"] = "America/Detroit";
    GLB.options.config["hubs"] = [];
    GLB.options.config["specialtiles"] = {"video": 4, "frame": 4, "image": 4, "blank": 4, "custom": 8};
    GLB.options.config["fast_timer"] = "0";
    GLB.options.config["slow_timer"] = "300000";
    GLB.options.config["rules"] = "true";
    GLB.options.config["accucity"] = "ann-arbor-mi";
    GLB.options.config["accuregion"] = "us";
    GLB.options.config["accucode"] = "329380";
    GLB.options.config["fcastcity"] = "ann-arbor";
    GLB.options.config["hubpick"] = "all";
    GLB.options.config["polisyip"] = "localhost";
    GLB.options.config["uname"] = "default";
    GLB.options.config["pword"] = {};
    GLB.options.config["pword"]["default"] = ["", "skin-housepanel"];
    GLB.options["useroptions"] = getTypes();

    // new user setup includes ading special tiles
    allthings = {};
    addSpecials();
    updateOptions(false);
}

function getLoginPage(uname) {
    var $tc = "";
    var skin = getSkin(uname);
    $tc += utils.getHeader(skin, true);
    $tc += "<h2>" + utils.APPNAME + "</h2>";
    $tc += "<br /><br />";
    $tc += "<form id=\"loginform\" name=\"login\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";
    $tc += utils.hidden("returnURL", GLB.returnURL);
    $tc += utils.hidden("pagename", "login");
    $tc += utils.hidden("api", "dologin");
    $tc += utils.hidden("id", "none");
    $tc += utils.hidden("type", "none");
    $tc += "<div>";
    $tc += "<label for=\"uname\" class=\"startupinp\">Username: </label>";
    $tc += "<input id=\"uname\" name=\"uname\" width=\"20\" type=\"text\" value=\"" + uname + "\"/>"; 
    $tc += "<br /><br />";
    $tc += "<label for=\"pword\" class=\"startupinp\">Password: </label>";
    $tc += "<input id=\"pword\" name=\"pword\" width=\"40\" type=\"password\" value=\"\"/>"; 
    $tc += "<br /><br />";
    $tc += '<div id="dologin" class="formbutton">Login</div>';
    $tc += "</div>";
    $tc += "</form>";
    $tc += utils.getFooter();
    return $tc;
}

function getAuthPage(uname, hostname, pathname, rmsg) {
    var $tc = "";
    var skin = getSkin(uname);
    if ( !rmsg ) { rmsg = ""; }
    $tc += utils.getHeader(skin);
    $tc += "<h2>" + utils.APPNAME + " Hub Authorization</h2>";

    // provide welcome page with instructions for what to do
    // this will show only if the user hasn't set up HP
    // or if a reauth is requested or when converting old passwords
    $tc += "<div class=\"greeting\">";

    $tc +="<p>Here is where you link a SmartThings, Hubitat, or ISY hub to " +
            "HousePanel to gain access to your smart home devices. " +
            "Ford and Lincoln vehicles are also supported if you have a Ford-Connect API developer account. "
            "You can link any number and combination of hubs. " + 
            "To link a hub you must have the following info: " +
            "API URL, Client ID, and Client Secret. " +
            "For ISY hubs enter your username in the ClientID field and " +
            "password in the Client Secret field, and enter the URL of your ISY hub for API Url." +
            "</p><br />";
    
    $tc += "<p><strong>*** IMPORTANT ***</strong> Information you provide here is secret and will be stored " +
            "on your server in a configuration file called <i>hmoptions.cfg</i> " + 
            "This is why HousePanel should <strong>*** NOT ***</strong> be hosted on a public-facing website. " +
            "A locally hosted website on a Raspberry Pi is the strongly recommended option. " +
            "HousePanel does share anonymized and encrypted usage data with its developer " + 
            "for the purposes of fine tuning the performance of future versions. "
            "By proceeding you are agreeing to this practice.</p>";
    $tc += "</div>";

    if ( DONATE===true ) {
        $tc += '<br /><h4>Donations appreciated for HousePanel support and continued improvement, but not required to proceed.</h4> \
            <br /><div><form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
            <input type="hidden" name="cmd" value="_s-xclick"> \
            <input type="hidden" name="hosted_button_id" value="XS7MHW7XPYJA4"> \
            <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
            <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
            </form></div>';
    }
    
    // get the current settings from options file
    // legacy file support removed
    var options = GLB.options;
    var rewrite = false;
    var config = options["config"];
    
    // removed old legacy file handling since it was prone to errors
    if ( array_key_exists("hubs", config) ) {
        var authhubs = clone(config["hubs"]);
    } else {
        authhubs = [];
        rewrite = true;
    }
    
    // get version and time info
    // force rewrite of options if a new version
    if ( array_key_exists("time", options) ) {
        var time = options["time"];
        var info = time.split(" @ ");
        var version = info[0].trim();
        var timestamp = parseInt(info[1].trim());
        var d = new Date(timestamp);
        var lastedit =  d.toLocaleDateString() + "  " + d.toLocaleTimeString();
        if ( version !== utils.HPVERSION ) {
            rewrite = true;
        }
    } else {
        rewrite = true;
        lastedit = "Unknown";
        version = "Pre Version 1.7";
    }

    // add a new blank hub at the end for adding new ones
    // note: the type must be "New" because js uses this to do stuff
    // hubId must be a unique name and can be anything
    // for ST and HE hubs this is a string obtained from the hub itself
    // for Ford and Lincoln hubs this should be provided by the user
    var newhub = {"hubType": "New", "hubHost": "", 
                  "clientId": "", "clientSecret": "",
                  "userAccess": "", "userEndpt": "", "hubName": "", "hubId": "new",
                  "hubTimer": 0, "hubAccess": "", "hubEndpt": ""};
    authhubs.push(newhub);

    var webSocketUrl = getSocketUrl(hostname);
    $tc += utils.hidden("pagename", "auth");
    $tc += utils.hidden("returnURL", GLB.returnURL);
    $tc += utils.hidden("pathname", pathname);
    $tc += utils.hidden("webSocketUrl", webSocketUrl);
    $tc += "<div class=\"greetingopts\">";
    $tc += "<h3><span class=\"startupinp\">Last update: " + lastedit + "</span></h3>";
    
    // ------------------ general settings ----------------------------------
    var numnewthings = 0;
    if ( DEBUG2 ) {
        console.log( (ddbg()), "Hub auth default hub: ", GLB.defhub);
    }
    if ( GLB.defhub && GLB.defhub.toString() !== "-1" ) {
        var defhub = GLB.defhub;
        for ( var idx in allthings) {
            var thing = allthings[idx];
            if ( thing["hubnum"] === defhub ) {
                numnewthings++;
            }
        }
        var ntc= "Hub with hubId= " + defhub + " was authorized and " + numnewthings + " devices were retrieved.";
    } else {
        defhub = authhubs[0]["hubId"];
        ntc = rmsg;
    }

    $tc += "<div id=\"newthingcount\">" + ntc + "</div>";
    $tc += "<div class='hubopt'><label for=\"pickhub\" class=\"startupinp\">Authorize Hub: </label>";
    $tc += "<select name=\"pickhub\" id=\"pickhub\" class=\"startupinp pickhub\">";

    var i= 0;
    authhubs.forEach(function(hub) {
        var hubName = hub["hubName"];
        var hubType = hub["hubType"];
        var hubId = hub["hubId"].toString();
        if ( hubId === defhub) {
            var hubselected = "selected";
        } else {
            hubselected = "";
        }
        $tc += "<option value=\"" + hubId + "\" " + hubselected + ">Hub #" + i + " " + hubName + " (" + hubType + ")</option>";
        i++;
    });
    $tc += "</select></div>";

    $tc +="<div id=\"authhubwrapper\">";
    i = 0;

    var allhubtypes = { SmartThings:"SmartThings", Hubitat: "Hubitat", ISY: "ISY", Ford: "Ford", Lincoln: "Lincoln" };
    authhubs.forEach(function(hub) {
        
        // putStats(hub);
        var hubType = hub["hubType"];
        var hubId = hub["hubId"].toString();
        if ( hubId === defhub) {
            var hubclass = "authhub";
        } else {
            hubclass = "authhub hidden";
        }

        // for each hub make a section with its own form that comes back here as a post
        $tc +="<div id=\"authhub_" + hubId + "\" hubid=\"" + hubId + "\" hubtype=\"" + hubType + "\" class=\"" + hubclass + "\">";
        $tc += "<form id=\"hubform_" + hubId + "\" class=\"houseauth\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";
        // $tc += utils.hidden("doauthorize", hpcode);

        // we use this div below to grab the hub type dynamically chosen
        $tc += "<div id=\"hubdiv_" + hubId + "\"><label class=\"startupinp\">Hub Type: </label>";
        $tc += "<select name=\"hubType\" class=\"startupinp\">";
        for (var ht in allhubtypes) {
            if ( ht === hubType ) {
                $tc += "<option value=\"" + ht + "\" selected>" + allhubtypes[ht] + "</option>";
            } else {
                $tc += "<option value=\"" + ht + "\">" + allhubtypes[ht] + "</option>";
            }
        }
        // var st_select = "";
        // var he_select = "";
        // var isy_select = "";
        // var ford_select = "";
        // var lincoln_select = "";
        // if ( hubType==="SmartThings" ) { st_select = "selected"; }
        // if ( hubType==="Hubitat" ) { he_select = "selected"; }
        // if ( hubType==="ISY" ) { isy_select = "selected"; }
        // if ( hubType==="Ford" ) { ford_select = "selected"; }
        // if ( hubType==="Lincoln" ) { lincoln_select = "selected"; }
        // $tc += "<option value=\"SmartThings\" " + st_select + ">SmartThings</option>";
        // $tc += "<option value=\"Hubitat\" " + he_select + ">Hubitat</option>";
        // $tc += "<option value=\"ISY\" " + isy_select + ">ISY</option>";
        // $tc += "<option value=\"Ford\" " + ford_select + ">Ford</option>";
        // $tc += "<option value=\"Lincoln\" " + lincoln_select + ">Lincoln</option>";
        $tc += "</select></div>";
        
        if ( !hub["hubHost"] ) {
            hub["hubHost"] = "https://graph.api.smartthings.com";
        }
        $tc += "<div><label class=\"startupinp required\">API Url: </label>";
        $tc += "<input class=\"startupinp\" title=\"Enter the hub OAUTH address here\" name=\"hubHost\" width=\"80\" type=\"text\" value=\"" + hub["hubHost"] + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp required\">Client ID: </label>";
        $tc += "<input class=\"startupinp\" name=\"clientId\" width=\"80\" type=\"text\" value=\"" + hub["clientId"] + "\"/></div>"; 

        // we load client secret in js since it could have special chars that mess up doing it here
        // but we do it anyway in case first one is good so it shows without clicking
        $tc += "<div class=\"fixClientSecret\"><label class=\"startupinp required\">Client Secret: </label>";
        var csecret = hub.clientSecret;
        if ( csecret.indexOf("<")!== -1 || csecret.indexOf(">")!== -1 ||  csecret.indexOf("\"")!== -1 ) {
            csecret = "";
        }
        $tc += "<input class=\"startupinp\" name=\"clientSecret\" width=\"80\" type=\"text\" value=\"" + csecret + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp\">Fixed access_token: </label>";
        $tc += "<input class=\"startupinp\" name=\"userAccess\" width=\"80\" type=\"text\" value=\"" + hub["userAccess"] + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp\">Fixed Endpoint: </label>";
        $tc += "<input class=\"startupinp\" name=\"userEndpt\" width=\"80\" type=\"text\" value=\"" + hub["userEndpt"] + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp\">Hub Name: </label>";
        $tc += "<input class=\"startupinp\" name=\"hubName\" width=\"80\" type=\"text\" value=\"" + hub["hubName"] + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp\">hub ID or App ID: </label>";
        $tc += "<input class=\"startupinp\" name=\"hubId\" width=\"80\" type=\"text\" value=\"" + hub["hubId"] + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp required\">Refresh Timer: </label>";
        $tc += "<input class=\"startupinp\" name=\"hubTimer\" width=\"10\" type=\"text\" value=\"" + hub["hubTimer"] + "\"/></div>"; 

        $tc += "<input class=\"hidden\" name=\"hubAccess\" type=\"hidden\" value=\"" + hub["hubAccess"] + "\"/>"; 
        $tc += "<input class=\"hidden\" name=\"hubEndpt\" type=\"hidden\" value=\"" + hub["hubEndpt"] + "\"/>"; 
        
        $tc += "<div>";
        $tc += "<input hub=\"" + i + "\" hubid=\"" + hubId + "\" class=\"authbutton hubauth\" value=\"Authorize Hub #" + i + "\" type=\"button\" />";
        // $tc += "<input hub=\"" + i + "\" hubid=\"" + hubId + "\" class=\"authbutton hubdel\" value=\"Remove Hub #" + i + "\" type=\"button\" />";
        $tc += "</div>";
        
        $tc += "</form>";
        $tc += "</div>";
        
        i++;
    });
    $tc += "</div>";
    $tc += "<div id=\"authmessage\"></div>";
    $tc += "<br><br>";
    // $tc += "<input id=\"cancelauth\" class=\"authbutton\" value=\"Return to HousePanel\" name=\"cancelauth\" type=\"button\" />";
    $tc += "<button class=\"infobutton\">Return to HousePanel</button>";

    $tc += utils.getFooter();
    return $tc;
}

function createSpecialIndex(customcnt, stype, spid) {
    var oldindex = clone(GLB.options["index"]);
    var maxindex = getMaxIndex();

    if ( !array_key_exists("specialtiles", GLB.options["config"]) ) {
        GLB.options["config"]["specialtiles"] = {};
    }
    GLB.options["config"]["specialtiles"][stype] = customcnt;

    // remove special types of this type
    var n = stype.length + 1;
    for (var idx in oldindex) {
        if ( idx.substr(0,n) === stype + "|" ) {
            delete GLB.options["index"][idx];
        }
    }

    // add back in the right number
    var theindex;
    for ( var i=0; i<customcnt; i++) {
        var k = (i + 1).toString();
        var fid = spid + k;
        var sidnum = stype + "|" + fid;
        if ( array_key_exists(sidnum, oldindex) ) {
            theindex = parseInt(oldindex[sidnum]);
            if ( theindex > maxindex ) {
                maxindex= theindex;
            }
        } else {
            maxindex++;
            theindex = maxindex;
        }
        GLB.options["index"][sidnum] = theindex;
    }
}

// routine that renumbers all the things in your options file from 1
function refactorOptions(uname) {

    // load in custom css strings
    var updatecss = false;
    var cnt = 0;
    var options = GLB.options;
    var oldoptions = clone(GLB.options);
    options["things"] = {};
    options["index"] = {};
    var skin = getSkin(uname);
    var customcss = readCustomCss(skin);

    var cflags = [ ["\.p\_","\."], ["\.p\_"," "], ["\.v\_","\."], ["\.v\_"," "], ["\.t\_","\."], ["\.t\_"," "], ["\.n\_","\."], ["\.n\_"," "] ];

    for (var thingid in oldoptions["index"]) {
        var idxarr = oldoptions["index"][thingid];
        
        // only keep items that are in our current set of hubs
        if ( array_key_exists(thingid, allthings) ) {
        
            // removed the old system check since this is a new day for HP
            cnt++;
            var idx = parseInt(idxarr);

            // replace all instances of the old "idx" with the new "cnt" in customtiles
            if ( customcss && idx!==cnt ) {

                cflags.forEach(function(arr) {
                    var re = new RegExp(arr[0] + idx.toString() + arr[1], "g");
                    var newval = arr[0] + cnt.toString() + arr[1];
                    customcss = customcss.replace(re, newval);
                });

                updatecss = true;
            }

            // save the index number - fixed prior bug that only did this sometimes
            options["index"][thingid] = cnt;
        }
    }

    // now replace all the room configurations
    // this is done separately now which is much faster and less prone to error
    // foreach ($oldoptions["things"] as $room => $thinglist) {
    for (var room in oldoptions["things"]) {
        options["things"][room] = [];
        var thinglist = oldoptions["things"][room];
        for ( var thingroom in thinglist ) {
            var pidpos = thinglist[thingroom];
            var pid;
            var postop = 0;
            var posleft = 0;
            var zindex = 1;
            var customname = "";
            if ( is_array(pidpos) ) {
                var pid = parseInt(pidpos[0]);
                var postop = parseInt(pidpos[1]);
                var posleft = parseInt(pidpos[2]);
                if ( pidpos.length>3 ) {
                    zindex = parseInt(pidpos[3]);
                    customname = pidpos[4];
                }
            } else {
                pid = parseInt(pidpos);
            }

            var thingid = array_search(pid, oldoptions["index"]);
            
            if ( thingid!==false && array_key_exists(thingid, options["index"]) ) {
                var newid = options["index"][thingid];
                // use the commented code below if you want to preserve any user movement
                // otherwise a refactor call resets all tiles to their baseeline position  
                // options["things"][room].push([newid,postop,posleft,zindex,customname]);
                options["things"][room].push([newid,0,0,1,customname]);
            }
        };
    }
    
    // now adjust all custom configurations
    for (var key in oldoptions) {
        
        var lines = oldoptions[key];
        var newlines;
        var calltype;
    
        if ( ( key.substr(0,5)==="user_" ) && is_array(lines) ) {

            // allow user to skip wrapping single entry in an array
            if ( !is_array(lines[0]) ) {
                lines = [lines];
            }

            newlines = [];
            for (var k in lines) {
                var msgs = lines[k];
                calltype = msgs[0].toUpperCase().trim();

                // switch to new index for links
                // otherwise we just copy the info over to options
                if ( calltype==="LINK" ) {
                    var linkid = msgs[1].toString().trim();
                    var thingid = array_search(linkid, oldoptions["index"]);
                    if ( thingid!==false && array_key_exists(thingid, options["index"]) ) {
                        msgs[1] = options["index"][thingid].toString();
                    }
                }
                newlines.push(msgs);
            }
            if ( newlines.length ) {
                options[key] = newlines;
            }
        }
    }
    
    // TODO... not yet working so don't save

    // save our updated options and our custom style sheet file
    // writeRoomThings(options, uname);

    // if ( updatecss ) {
    //     writeCustomCss(skin, customcss);
    // }
}

// emulates the PHP function for javascript objects or arrays
function array_search(needle, arr) {
    var key = false;
    if ( is_object(arr) ) {
        try {
            for (var t in arr) {
                if ( arr[t]===needle || arr[t].toString() === needle.toString() ) {
                    return t;
                }
            } 
        }
        catch(e) { key = false; }
    }
    return key;
}

function tile_search(tileid, tiles) {
    var thetile = false;
    tileid = parseInt(tileid);
    var found = false;
    if ( !isNaN(tileid) ) {
        tiles.forEach(function(tile) {
            var checktile = parseInt(tile[0]);
            if ( !isNaN(checktile) && checktile === tileid ) {
                thetile = tile;
                // if already found then this is a dup so set position to zero
                if (found) {
                    thetile[1] = 0;
                    thetile[2] = 0;
                }
                found = true;
            }
        });
    }
    return thetile;
}

function in_array(needle, arr) {
    if ( !is_object(arr) ) {
        return false;
    } else {
        for (var i in arr) {
            var item = arr[i];
            if ( item===needle || item.toString()===needle.toString() ) {
                return true;
            }
        }
        return false;
    }
}

function is_array(obj) {
    if ( typeof obj === "object" ) {
        return Array.isArray(obj);
    } else {
        return false;
    }
}

function is_object(obj) {
    return ( typeof obj === "object" );
}

function array_key_exists(key, arr) {
    if ( !is_object(arr) ) {
        return false;
    }
    return ( typeof arr[key] !== "undefined" );
}

function ddbg() {
    var d = new Date();
    var dstr = d.toLocaleDateString() + "  " + d.toLocaleTimeString() + " ";
    return "V" + utils.HPVERSION +" on " + dstr;
}

// returns true if the index is in the room things list passed
function inroom($idx, $things) {
    var $found = false;
    var $idxint = parseInt($idx);
    for (var i in $things) {
        var $arr = $things[i];
        var $thingindex = is_array($arr) ? $arr[0] : parseInt($arr);
        if ( $idxint === $thingindex ) {
            $found = i;
            break;
        }
    }
    return $found;
}

// this is the main page rendering function
// each HousePanel tab is generated by this function call
// each page is contained within its own form and tab division
// notice the call of $cnt by reference to keep running count
function getNewPage(cnt, roomtitle, kroom, things) {
    var $tc = "";
    var roomname = roomtitle;
    $tc += "<div id=\"" + roomname + "-tab\">";
    $tc += "<form title=\"" + roomtitle + "\" action=\"#\">";
    
    // add room index to the id so can be style by number and names can duplicate
    // no longer use room number for id since it can change around
    // switched this to name - not used anyway other than manual custom user styling
    // if one really wants to style by room number use the class which includes it
    $tc += "<div id=\"panel-" + roomname + "\" title=\"" + roomtitle + "\" class=\"panel panel-" + kroom + " panel-" + roomname + "\">";

    // the things list can be integers or arrays depending on drag/drop
    var idxkeys = Object.keys(GLB.options["index"]);
    var idxvals = Object.values(GLB.options["index"]);
    var zcolor = 200;
    things.forEach(function(kindexarr) {
        
        // get the offsets and the tile id
        var kindex = parseInt(kindexarr[0]);
        var postop = parseInt(kindexarr[1]);
        var posleft = parseInt(kindexarr[2]);
        if ( postop < 0 || posleft < 0 ) {
            postop = 0;
            posleft = 0;
        }
        var zindex = 1;
        var customname = "";

        if ( kindexarr.length > 3 ) {
            zindex = kindexarr[3];
            customname = kindexarr[4];
            if ( typeof customname !== "string" ) {
                customname = "";
            }
        }
        var i = idxvals.findIndex(idx => idx === kindex);
        var thingid = idxkeys[i];
        
        // if our thing is still in the master list, show it
        if (thingid && allthings[thingid]) {
            var thesensor = allthings[thingid];

            if ( typeof thesensor==="object" ) {

                // adjust the zindex to show on top of others if there is a color field
                // this starts at 199 and counts down to 100 assuming fewer than 100 color things on a page
                // but only do this for relative placement tiles
                // we handle color separately for dragged tiles
                if ( array_key_exists("color", thesensor.value) && zindex < 100 && posleft===0 && postop===0 ) {
                    zcolor--;
                    zindex = zcolor;
                    if ( zcolor < 100 ) { zcolor = 200; }
                }

                // keep running count of things to use in javascript logic
                cnt++;
                $tc += makeThing(cnt, kindex, thesensor, roomtitle, postop, posleft, zindex, customname, false);
            }
        }
    });

    // end the form and this panel
    $tc += "</div></form>";

    // end this tab which is a different type of panel
    $tc +="</div>";
    return {tc: $tc, cnt: cnt};
}

// function to search for triggers in the name to include as classes to style
function processName(thingname, thingtype) {

    // this is where we do a check for bad chars and remove them in names
    var pattern = /[,;:!-\'\*\<\>\{\}\+\&\%]/g;
    try {
        thingname = thingname.replace(pattern,"");
    } catch(e) {
        console.log( (ddbg()), thingname, "error: ", e);
    }

    // get rid of 's and split along white space
    var subtype = "";
    var ignore2 = getTypes();
    ignore2.push("panel");

    try {
        var lowname = thingname.toLowerCase();
        var subopts = lowname.split(" ");
        var k = 0;
        subopts.forEach(function(str) {
            str= str.trim();
            var numcheck = +str;
            if ( str.length>1 && ignore2.indexOf(str)===-1 && str!==thingtype && isNaN(numcheck) &&
                str.indexOf("::")===-1 && str.indexOf("://")===-1 && str.length<20 ) {
                if ( k < 3 ) {
                    subtype += " " + str;
                    k++;
                }
            }
        });
    } catch (e) {
        subtype = "";
    }
    return [thingname, subtype];
}

// returns proper html to display an image, video, frame, or custom
// if some other type is requested it returns a div of requested size and skips search
// searches in main folder and media subfolder for file name
function returnFile(thingvalue, thingtype) {

    // do nothing if this isn't a special tile
    var specialtiles = getSpecials();
    if ( !array_key_exists(thingtype, specialtiles) ) {
        return thingvalue;
    }

    // get the name, width, height to create
    if ( array_key_exists("name", thingvalue) ) {
        var fn = thingvalue["name"];
    } else {
        fn = specialtiles[thingtype][0];
        thingvalue["name"] = fn;
    }
    if ( array_key_exists("width", thingvalue) ) {
        var fw = thingvalue["width"];
    } else {
        fw = specialtiles[thingtype][1];
        thingvalue["width"] = fw;
    }
    var fwnum = parseInt(fw);
    if ( isNaN(fwnum) ) { fwnum = 900; }

    if ( array_key_exists("height", thingvalue) ) {
        var fh = thingvalue["height"];
    } else {
        fh = specialtiles[thingtype][2];
        thingvalue["height"] = fh;
    }
    var fhnum = parseInt(fh);
    if ( isNaN(fhnum) ) { fhnum = 600; }

    var grtypes;
    switch (thingtype) {
        case "image":
            grtypes = [".jpg",".png",".gif"];
            break;
        case "video":
            grtypes = [".mp4",".ogg"];
            break;
        case "frame":
            grtypes = [".html",".htm"];
            break;
        case "custom":
        case "blank":
            grtypes = [".jpg",".png",".gif",".mp4",".ogg",".html",".htm"];
            break;
        // for blanks never load a file
        // but we do set the name above
        // below we set the tile size for blanks and others
        default:
            grtypes = null;
            break;
    }

    // this block sets the file name to load based on extension requested
    var $vn = "";
    var $fext = "";

    // the logged in user is irrelevant here so we scan all the skins until we find a match if needed
    // moved logic to the code block below
    // var skin = getSkin();
    var skin;

    function getext(fname) {
        var ipos = fname.lastIndexOf(".");
        var ext = "";
        if ( ipos !== "-1" ) {
            ext = fname.substr(ipos);
        }
        return ext;
    }

    if ( grtypes ) {

        // first check names without extensions
        try {
            var pwords = GLB.options.config.pword;
        } catch(e) {
            pwords = {default: ["","skin-housepanel"]};
        }

        var uname;
        if (fs.existsSync(fn) || fn.startsWith("http")) {
            $vn = fn;
            $fext = getext(fn);
        } else if (fs.existsSync("media/"+ fn)) {
            $vn = "media/" + fn;
            $fext = getext(fn);
        } else {
            for ( uname in pwords ) {
                var skin = pwords[uname][1];
                if ( $vn==="" && fs.existsSync(skin + "/media/"+ fn)) {
                    $vn = skin + "/media/" + fn;
                    $fext = getext(fn);
                    found = true;
                }
            }
        }

        // next check names with extensions and in media folders including skin
        if ( $vn==="" ) {
            grtypes.forEach(function($ext) {
                if ( $vn==="" && fs.existsSync(fn + $ext) ) {
                    $vn = fn + $ext;
                    $fext = $ext;
                } else if ( $vn==="" && fs.existsSync("media/" + fn + $ext) ) {
                    $vn = "media/" + fn + $ext;
                    $fext = $ext;
                } else {
                    for ( uname in pwords ) {
                        skin = pwords[uname][1];
                        if ( $vn==="" && fs.existsSync(skin + "/media/" + fn + $ext) ) {
                            $vn = skin + "/media/" + fn + $ext;
                            $fext = $ext;
                        }
                    }
                }
            });
        }
    }

    var $v = "";
    var mediafile = "";

    // process things if file was found
    if ( $vn ) {

        // if file has an extension then remove the dot
        if ( $fext.length && $fext.substr(0,1)==="." ) {
            $fext = $fext.substr(1);
        }

        switch ($fext) {
            // image files
            case "jpg":
            case "png":
            case "gif":
                $v= "<img width=\"" + fw + "\" height=\"" + fh + "\" src=\"" + $vn + "\">";
                mediafile = $vn;
                break;

            // video files
            case "mp4":
            case "ogg":
                $v= "<video width=\"" + fw + "\" height=\"" + fh + "\" autoplay>";
                $v+= "<source src=\"" + $vn + "\" type=\"video/" + $fext + "\">";
                $v+= "Video Not Supported</video>";

                mediafile= $vn;
                break;
                
            // render web pages in a web iframe
            case "html":
            case "htm":
                $v = "<iframe width=\"" + fw + "\" height=\"" + fh + "\" src=\"" + $vn + "\" frameborder=\"0\"></iframe>";
                mediafile= $vn;
                break;

            // otherwise just show a blank just like below
            default:
                if ( thingtype==="custom" ) {
                    $v = "";
                } else {
                    $v = "<div style=\"width: " + fw + "px; height: " + fh + "px;\"></div>";
                }
                break;
        }
    
    // if file wasn't found just make an empty block of the requested size
    // but for custom tiles don't do this since we can use blanks to make empty block sizes
    // for custom tiles only create a block of size if there is content to be seen
    } else {
        if ( thingtype==="custom" ) {
            $v = "";
        } else {
            $v = "<div style=\"width: " + fw + "px; height: " + fh + "px;\"></div>";
        }
    }

    thingvalue[thingtype] = $v;

    // TODO - figure out a better way to show large images
    if ( mediafile ) {
        thingvalue["_media_"] = mediafile;
    }
    return thingvalue;
}

// function to create frame2.html with AccuWeather for a city
// the City Name, Country Code, and the Location Code from AccuWeather must be provided
// writeAccuWeather("ann-arbor-mi","us","329380");
function writeAccuWeather(city, region, code) {
    const acid = "awcc1531959686475";
    const unit = "F";
    if ( !city || !code || !region ) {
        return;
    }

    var rcitycode = region + "/" + city + "/" + code + "/weather-forecast/" + code;
    var $tc = "<!DOCTYPE html>";
    $tc += "<html><body>";
    $tc += "<a href=\"https://www.accuweather.com/en/" + rcitycode + "\" class=\"aw-widget-legal\">";
    $tc += "</a><div id=\"" + acid + "\" class=\"aw-widget-current\"  data-locationkey=\"" + code + "\" data-unit=\"" + unit + "\" data-language=\"en-us\" data-useip=\"false\" data-uid=\"" + acid + "\"></div>";
    $tc += "<script type=\"text/javascript\" src=\"https://oap.accuweather.com/launch.js\"></script>";
    $tc += "</body></html>";
    fs.writeFileSync("Frame2.html", $tc, {encoding: "utf8", flag:"w"});
}

// function to create Frame1.html for a city
// the City Name and code must be provided
// data for my home town:  ("ann-arbor","Ann Arbor","42d28n83d74");
function writeForecastWidget(city, region, code) {
    if ( !city || !code || !region ) {
        return;
    }

    var $tc = `
    <!DOCTYPE html>
    <html>
        <head>
            <title>Weather Forecast</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script>
                !function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];
                if(!d.getElementById(id)){js=d.createElement(s);
                js.id=id;js.src="https://weatherwidget.io/js/widget.min.js";
                fjs.parentNode.insertBefore(js,fjs);}}(document,"script","weatherwidget-io-js");
            </script>
        </head>
        <body style="margin: 0;">
        <a class="weatherwidget-io" href="https://forecast7.com/en/{{code}}/{{city}}/?unit=us" data-label_1="{{region}}" data-label_2="Weather Forecast" data-icons="Climacons" data-days="7" data-theme="original" ></a>
        </body>
    </html>`;

    $tc = $tc.replace("{{city}}", city);
    $tc = $tc.replace("{{region}}", region);
    $tc = $tc.replace("{{code}}", code);
    fs.writeFileSync("Frame1.html", $tc, {encoding: "utf8", flag:"w"});
}

function getWeatherIcon(num, accu) {
    var iconimg;
    var iconstr;
    if ( typeof num === "string" && num.startsWith("<img") ) {
        iconstr = num;
    } else if ( !num || isNaN(+num) ) {
        iconstr = false;
    // accuweather's icons
    } else if ( num==="na" ) {
        iconimg = "media/weather/na.png";
        iconstr = "<img src=\"" + iconimg + "\" alt=\"na\" width=\"80\" height=\"80\">";
    } else if ( accu ) {
        num = num.toString() + ".svg";
        iconimg = "https://accuweather.com/images/weathericons/" + num;
        iconstr = "<img src=\"" + iconimg + "\" alt=\"" + num + "\" width=\"80\" height=\"80\">";
    } else {
        num = num.toString();
        if ( num.length < 2 ) {
            num = "0" + num;
        }
        // uncomment this to use ST's copy. Default is to use local copy
        // so everything stays local
        iconimg = "media/weather/" + num + ".png";
        iconstr = "<img src=\"" + iconimg + "\" alt=\"" + num + "\" width=\"80\" height=\"80\">";
    }
    return iconstr;
}

function translateWeather(name, pvalue) {

    if ( !pvalue || typeof pvalue!=="object" ) {
        console.log( (ddbg()), "invalid weather data - object expected but not found");
        return pvalue;
    }

    if ( !pvalue.realFeel ) {
        if ( pvalue && pvalue.weatherIcon && pvalue.forecastIcon ) {
            var wicon = getWeatherIcon(pvalue["weatherIcon"]);
            if ( wicon===false ) {
                delete pvalue["weatherIcon"];
            } else {
                pvalue["weatherIcon"] = wicon;
            }
            var ficon = getWeatherIcon(pvalue["forecastIcon"]);
            if ( ficon===false ) {
                delete pvalue["forecastIcon"];
            } else {
                pvalue["forecastIcon"] = ficon;
            }
        }
        return pvalue;
    }

    // the rest of this function fixes up the accuWeather tile
    var newvalue = {};
    newvalue.name = name;
    newvalue.temperature = pvalue.temperature;
    newvalue.realFeel = pvalue.realFeel;
    newvalue.weatherIcon = getWeatherIcon(pvalue.weatherIcon, true);
    if ( newvalue.weatherIcon===false ) {
        delete newvalue.weatherIcon;
    }

    // don't include these because they are in the summary below
    // ----------------------------------------------------------
    // newvalue.cloudCover = pvalue.cloudCover;
    // newvalue.humidity = pvalue.humidity;
    // newvalue.localSunrise = pvalue.localSunrise;
    // newvalue.localSunset = pvalue.localSunset;
    // newvalue.windVector = pvalue.windDirection + " " + pvalue.windSpeed;
    // newvalue.uvIndex = pvalue.uvIndex;
    // newvalue.alert = pvalue.alert;

    // fix the summary string to work with the web
    var summaryStr = pvalue.summary;
    var forecastStr = "";
    if ( typeof summaryStr === "string" ) {
        newvalue.summary = summaryStr.replace(/\n/g, "<br/>");
    }

    // make the visual forcast block
    try {
        var forecast = JSON.parse(pvalue.forecast);
    } catch(e) {
        if ( typeof pvalue.forecast === "string" ) {
            forecastStr = pvalue.forecast.replace(/\n/g, "<br/>");
        }
        forecast = null;
    }
    if ( forecast ) {
        forecastStr = "<table class='accuweather'>";
        forecastStr += "<tr>";
        forecastStr += "<th class='hr'>Time</th>";
        forecastStr += "<th class='temperature'>Temp</th>";
        // forecastStr += "<th class='realFeel'>Feels</th>";
        forecastStr += "<th class='precipitation'>Icon</th>";
        forecastStr += "</tr>";

        var hr = 1;
        var thishr = hr.toString().trim()+"hr"
        while ( hr <= 3 && typeof forecast[thishr] === "object" ) {
            forecastStr += "<tr>";
            // see if we have icons and times
            if (pvalue["time"+thishr]) {
                var words = pvalue["time"+thishr].split("\n");
                var timestr = words[1].substr(0,3) + " " + words[2];
                forecastStr += "<td class='hr'>" + timestr + "</td>";
            } else {
                forecastStr += "<td class='hr'>" + hr + " Hr</td>";
            }
            forecastStr += "<td class='temperature'>" + forecast[thishr].temperature + "</td>";
            // forecastStr += "<td class='realFeel'>" + forecast[thishr].realFeel + "</td>";
            if (pvalue["icon"+thishr]) {
                forecastStr += "<td class='weatherIcon'>" + getWeatherIcon(pvalue["icon"+thishr], true) + "</td>";
            } else {
                forecastStr += "<td class='weatherIcon'>" + getWeatherIcon("na") + "</td>";
            }
            forecastStr += "</tr>";

            hr++;
            thishr = hr.toString()+"hr";
        }
        forecastStr += "</table>";
    }
    newvalue.forecast = forecastStr;
    return newvalue;
}

// removes dup words from a string
function uniqueWords(str) {
    var arr = str.split(" ");
    var newstr = "";
    arr.forEach(function(word) {
        word = word.trim();
        if ( word && !newstr.includes(word) ) {
            if ( newstr==="" ) {
                newstr+= word;
            } else {
                newstr+= " " + word;
            }
        }
    });
    return newstr;
}

function makeThing(cnt, kindex, thesensor, panelname, postop, posleft, zindex, customname, wysiwyg) {
    // const audiomap = {"title": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
    //                   "albumArtUrl": "trackImage", "mediaSource": "mediaSource"};
    // const musicmap = {"name": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
    //                   "status": "status", "trackMetaData": "trackImage", "trackImage":"trackImage", "metaData":"trackImage",
    //                   "trackNumber":"", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
    //                   "audioSource": "mediaSource"};
    const mantemp = {"temperature":"", "feelsLike":"", "name":"", "city":"", "weather":"", 
                     "weatherIcon":"", "forecastIcon":"","alertKeys":""};
    var $tc = "";
    thesensor["value"] = setValOrder(thesensor["value"]);
    var thingvalue = thesensor["value"];
    var thingtype = thesensor["type"];
    var bid = thesensor["id"];

    // set type to hint if one is given
    // this is to support ISY nodes that all register as ISY types
    // so we can figure out what type of tile this is closest to
    // this also is used to include the hub type in the tile
    var hint = thesensor["hint"] || "";
    var hubnum = thesensor["hubnum"] || "-1";
    var refresh = "normal";

    // use override if there
    if ( array_key_exists("refresh", thesensor) ) {
        refresh = thesensor["refresh"];
    }
    if ( array_key_exists("refresh", thingvalue) ) {
        refresh = thingvalue["refresh"];
    }

    // set the custom name
    var subtype = "";
    if ( array_key_exists("name", thingvalue) ) { 
        if ( customname ) {
            thingvalue["name"] = customname;
        }
        var pnames = processName(thingvalue["name"], thingtype);
        thingvalue["name"] = pnames[0];
        subtype = pnames[1];
    }

    postop= parseInt(postop);
    posleft = parseInt(posleft);
    zindex = parseInt(zindex);
    var idtag = "t-" + cnt;
    if ( wysiwyg ) {
        idtag = wysiwyg;
    }

    // set the custom name
    // limit to 132 visual columns but show all for special tiles and custom names
    // now we use custom name in both places
    // var thingname = thingvalue["name"];
    var thingname = thesensor["name"];
            
    // check if there is a color key - use to set color
    // no longer print this first since we need to include in custom logic
    var bgcolor= "";
    if ( array_key_exists("color", thingvalue) ) {
        var cval = thingvalue["color"];
        try {
            if ( cval && (cval.match(/^#[abcdefABCDEF\d]{6}/) !== null || cval.startsWith("rgb")) ) {
                bgcolor = " style=\"background-color:"+cval+";\"";
            }
        } catch (e) {
            bgcolor = "";
        }
    }
    
    // wrap thing in generic thing class and specific type for css handling
    $tc=   "<div id=\""+idtag+"\" aid=\""+cnt+"\" hub=\""+hubnum+"\" tile=\""+kindex+"\" bid=\""+bid+"\" type=\""+thingtype+"\" ";
    
    // set up the class setting
    var classstr = "thing " + thingtype+"-thing" + subtype;
    if ( hint ) {
        classstr += " " + hint.replace(/\./g,"_");
    }
    classstr += " p_"+kindex;

    // add the panel name to the class
    // this allows styling to be page dependent or applied everywhere
    classstr = panelname + " " + classstr;
    classstr = uniqueWords(classstr);

    $tc += "panel=\""+panelname+"\" class=\""+classstr+"\" ";
    $tc += "refresh=\""+refresh+"\"";
    var pos = "absolute";
    if ( wysiwyg || (postop===0 && posleft===0) ) {
        pos = "relative";
        posleft = 0;
        postop = 0;
    }
    $tc += " style=\"position: "+pos+"; left: "+posleft+"px; top: "+postop+"px; z-index: "+zindex+";\"";
    $tc += ">";


    // same thingname field for each tile with the original name
    $tc += "<div aid=\""+cnt+"\" type=\""+thingtype+"\" title=\""+thingname+"\" class=\"thingname "+thingtype+" t_"+kindex+"\" id=\"s-"+cnt+"\">";
    $tc += thingname;
    $tc += "</div>";

    // special handling for weather tiles
    // this allows for feels like and temperature to be side by side
    // and it also handles the inclusion of the icons for status
    if (thingtype==="weather" && array_key_exists("feelsLike", thingvalue) ) {
        if ( !thingvalue["name"] ) {
            thingvalue["name"] = thingname;
        }

        // fix icons just in case
        var tempicon = getWeatherIcon(thingvalue["weatherIcon"], false);
        var feelicon = getWeatherIcon(thingvalue["forecastIcon"], false);
        
        $tc += putElement(kindex, cnt, 0, thingtype, thingvalue["name"], "name");
        $tc += putElement(kindex, cnt, 1, thingtype, thingvalue["city"], "city");
        $tc += "<div class=\"weather_temps\">";
        $tc += putElement(kindex, cnt, 2, thingtype, thingvalue["temperature"], "temperature");
        $tc += putElement(kindex, cnt, 3, thingtype, thingvalue["feelsLike"], "feelsLike");
        $tc += "</div>";
        
        // use new weather icon mapping
        $tc += "<div class=\"weather_icons\">";
        $tc += putElement(kindex, cnt, 4, thingtype, tempicon, "weatherIcon");
        $tc += putElement(kindex, cnt, 5, thingtype, feelicon, "forecastIcon");
        $tc += "</div>";
        // $tc += putElement(kindex, cnt, 6, thingtype, "Sunrise: " + thingvalue["localSunrise"] + " Sunset: " + thingvalue["localSunset"], "sunriseset");
        
        var j = 6;
        for ( var tkey in thingvalue ) {
            tkey = tkey.toString();
            if ( !array_key_exists(tkey, mantemp) && tkey.substring(0,5)!=="user_" ) {
                var helperkey = "user_" + tkey;
                var tval = thingvalue[tkey];
                if (  array_key_exists(helperkey, thingvalue) && thingvalue[helperkey] && thingvalue[helperkey].substr(0,2)==="::" ) {
                    var helperval = thingvalue[helperkey];
                    $tc += putLinkElement(bid, helperval, kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor);
                } else {
                    $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor);
                }
                j++;
            }
        };
        
    } else {

        // create a thing in a HTML page using special tags so javascript can manipulate it
        // multiple classes provided. One is the type of thing. "on" and "off" provided for state
        // for multiple attribute things we provide a separate item for each one
        // the first class tag is the type and a second class tag is for the state - either on/off or open/closed
        // ID is used to send over the groovy thing id number passed in as $bid
        // for multiple row ID's the prefix is a$j-$bid where $j is the jth row

        // removed this old check since things are now always objects
        // if (typeof thingvalue === "object") {
        var j = 0;

        // get width and height for images if given
        var twidth = null;
        var theight = null;
        if ( array_key_exists("width", thingvalue) ) {
            twidth = thingvalue["width"];
        }
        if ( array_key_exists("height", thingvalue) ) {
            theight = thingvalue["height"];
        }
        
        // create on screen element for each key
        // this includes a check for helper items created in tile customizer
        for ( var tkey in thingvalue ) {
            var helperkey = "user_" + tkey;
            var tval = thingvalue[tkey];

            // check value for "json" strings
            try {
                var jsontval = JSON.parse(tval);
            } catch(jerr) {
                jsontval = null;
            }
            
            // skip special audio and music tiles
            if ( tkey==="audioTrackData" || tkey==="trackData" || tkey==="forecast" ) {
                jsontval = null;
                tval = null;
            }

            // handle other cases where the value is an object like audio or music tiles
            // but audio, music, and weather and handled elsewhere so don't do it again here
            if ( jsontval && is_object(jsontval) && !array_key_exists(helperkey, thingvalue) ) {

                var isarr = is_array(jsontval);
                for (var jtkey in jsontval ) {
                    var jtval = jsontval[jtkey];

                    // expand arrays onto the base
                    // for example, this happens for buttons reporting acceptable values
                    if ( isarr ) {
                        jtkey = tkey + "_" + jtkey.toString();
                    }

                    // skip adding an object element if it duplicates an existing one
                    if ( jtkey && jtval && !array_key_exists(jtkey, thingvalue) ) {
                        if ( is_object(jtval) ) {
                            var isarr2 = is_array(jtval);
                            for (var jtkey2 in jtval) {
                                var jtval2 = jtval[jtkey2];
                                if ( isarr2 ) {
                                    jtkey2 = jtkey + "_" + jtkey2.toString();
                                }
                                // only print strings and non duplicates - don't descend more than 2 levels
                                // i should have written putElement as a recursive function call - this is to be done later
                                if ( jtkey2 && jtval2 && (typeof jtval2!=="object") && !array_key_exists(jtkey2, thingvalue) ) {
                                    $tc += putElement(kindex, cnt, j, thingtype, jtval2, jtkey2, subtype, bgcolor, null, null, twidth, theight);
                                    j++;
                                }
                            }
                        } else {
                            $tc += putElement(kindex, cnt, j, thingtype, jtval, jtkey, subtype, bgcolor, null, null, twidth, theight);
                            j++;
                        }
                    }
                }
            }

            else if ( hint==="ISY scene" && tkey.substring(0,6)==="scene_" ) {
                var sceneidx = "isy|" + tval;
                if ( allthings[sceneidx] ) {
                    tval = allthings[sceneidx].value.name + "<br />" + tval;
                    $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, null, null, twidth, theight);
                }
            }

            else if ( tkey.substring(0,5)!=="user_" && typeof tval!=="object" ) { 
                
                // new logic for links - they all now follow the format ::LINK::code
                // print a hidden field for user web calls and links
                // this is what enables customization of any tile to happen
                // this special element is not displayed and sits inside the overlay
                // we only process the non helpers and look for helpers in same list
                if (  array_key_exists(helperkey, thingvalue) && thingvalue[helperkey] && thingvalue[helperkey].substr(0,2)==="::" ) {
                    var helperval = thingvalue[helperkey];
                    $tc += putLinkElement(bid, helperval, kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, twidth, theight);
                } else {
                    $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, null, null, twidth, theight);
                }

                j++;
            }
        }
    }

    $tc += "</div>";
    
    return $tc;
}

// compare this logic with how siblings are defined
// in the getCustomTile function
function putLinkElement(bid, helperval, kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, twidth, theight) {

    var linktype = thingtype;
    var linkbid = bid;
    var realsubid = tkey;
    var idx = thingtype + "|" + bid;

    var ipos = helperval.indexOf("::",2);
    var command = helperval.substring(2, ipos);
    var linkval = helperval.substring(ipos+2);

    // get info for links but skip if the link had an error
    if ( command==="LINK" && linkval && linkval!=="error" && linkval.indexOf("|")!==-1 ) {
        var lidx = linkval;
        linkval = GLB.options.index[lidx];
        var idxitems = lidx.split("|");
        linktype = idxitems[0];
        linkbid = idxitems[1];

        // use the link value - if subid isn't there look for subid's that form the beginning of our link subid
        if ( array_key_exists(lidx, allthings) ) {
            var linktileval = allthings[lidx]["value"];
            if ( array_key_exists(realsubid, linktileval) ) {
                tval = linktileval[realsubid];
            } else {
                for (var ltkey in linktileval) {
                    if ( realsubid.startsWith(ltkey) ) {
                        realsubid = ltkey;
                        tval = linktileval[ltkey];
                        break;
                    }
                }
            }

            // look for width and height and replace if there
            if ( linktileval["width"] ) {
                twidth = linktileval["width"];
            }
            if ( linktileval["height"] ) {
                theight = linktileval["height"];
            }

            // save the value in our main array for user queries and api calls
            // note that all screen refreshes will come here again and update it
            // but we skip this for non permanent things being made for visual sake
            if ( cnt!== 0 ) {
                allthings[idx]["value"][tkey] = tval;
            }
        } else {
            linkval = "dum";
        }
    } else if ( command==="URL" || command==="POST" || command==="PUT" || command==="GET" ) {
        linkval = decodeURI(linkval);
    } else {
        // neuter out linkval since we no longer use it
        linkval = linkval || "dum";
    }

    // use the original type here so we have it for later
    // but in the actual target we use the linktype
    // var sibling= "<div aid=\""+cnt+"\" linktype=\""+linktype+"\" value=\""+tval+"\" linkval=\""+linkval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
    var sibling= "<div aid=\""+cnt+"\" linktype=\""+linktype+"\" linkval=\""+linkval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
    if ( DEBUG10 ) {
        console.log( (ddbg()), "bid: ", bid, " helperval: ", helperval, " sibling: ", sibling);
    }
    var $tc = putElement(kindex, cnt, j, linktype, tval, tkey, subtype, bgcolor, sibling, realsubid, twidth, theight);
    return $tc;
}

// cleans up the name of music tracks for proper html page display
// no longer trim the name because that breaks album art
function fixTrack(tval) {
    if ( !tval || tval.trim()==="" ) {
        tval = "None"; 
    }
    return tval;
}

function putElement(kindex, i, j, thingtype, tval, tkey, subtype, bgcolor, sibling, realsubid, twidth, theight) {
    var $tc = "";
    var aitkey = "a-" + i + "-" + tkey;
    var pkindex = " p_" + kindex;
    var aidi = "<div aid=\"" + i + "\"";
    var ttype = " type=\"" + thingtype + "\"";
    var colorval = "";
    if ( typeof subtype === "undefined" ) {
        subtype = "";
    } else if ( typeof subtype === "string" && subtype.substr(0,1)!==" " ) {
        subtype = " " + subtype;
    }
    if ( bgcolor && (tkey==="hue" || tkey==="saturation") ) {
        colorval = bgcolor;
    }
    if ( !tval ) { tval = ""; }

    // do nothing if this is a rule and rules are disabled
    if ( !ENABLERULES && typeof tval==="string" && tval.substr(0,6)==="RULE::" ) {
        return $tc;
    }
        
    // fix thermostats to have proper consistent tags
    // this is supported by changes in the .js file and .css file
    if ( tkey==="hue" || tkey==="saturation" ||
         tkey==="heatingSetpoint" || tkey==="coolingSetpoint" || 
         (tkey.startsWith("int_") && thingtype==="isy") ||
         (tkey.startsWith("state_") && thingtype==="isy") ) {

        var modvar = tkey;
        // if ( tkey.startsWith("int_") || tkey.startsWith("state_") ) {
        //     modvar = tkey + " variable";
        // } else {
        //     modvar = tkey;
        // }

        // fix thermostats to have proper consistent tags
        // this is supported by changes in the .js file and .css file
        $tc += "<div class=\"overlay " + tkey + " " + subtype + " v_" + kindex + "\">";
        if (sibling) { $tc += sibling; }
        $tc += aidi + " subid=\"" + tkey + "-dn\" title=\"" + thingtype + " down\" class=\"" + thingtype + " arrow-dn " + modvar + "-dn " + pkindex + "\"></div>";
        $tc += aidi + " subid=\"" + tkey + "\" title=\"" + thingtype + " " + tkey + "\" class=\"" + thingtype + " arrow " + modvar + pkindex + "\"" + colorval + " id=\"" + aitkey + "\">" + tval + "</div>";
        $tc += aidi + " subid=\"" + tkey + "-up\" title=\"" + thingtype + " up\" class=\"" + thingtype + " arrow-up " + modvar + "-up " + pkindex + "\"></div>";
        $tc += "</div>";
    
    
    // process analog clocks signalled by use of a skin with a valid name other than digital
    } else if ( thingtype==="clock" && tkey==="skin" && tval && tval!=="digital" ) {
        $tc += "<div class=\"overlay "+tkey+" v_"+kindex+"\">";
        if (sibling) { $tc += sibling; }
        $tc += aidi + ttype + "\"  subid=\""+tkey+"\" title=\"Analog Clock\" class=\"" + thingtype + subtype + pkindex + "\" id=\""+aitkey+"\">" +
              "<canvas id=\"clock_"+i+"\" class=\""+tval+"\"></canvas></div>";
        $tc += "</div>";
    } else {
        // add state of thing as a class if it isn't a number and is a single word
        // or two words separated by a space
        // also prevent dates and times from being added
        // also do not include any music album or artist names in the class
        // and finally if the value is complex with spaces or numbers, skip
        // also skip links and rules and anything longer than 30 characters
        var extra;
        if ( typeof tval==="string" && tval.indexOf(" ") !== -1 ) {
            var tvalwords = tval.split(" ");
            if ( tvalwords.length===2 ) {
                extra = " " + tvalwords[0] + "_" + tvalwords[1];
            } else {
                extra = "";
            }
        } else if ( tkey==="time" || tkey==="date" || tkey==="color" || typeof tval!=="string" || tval==="" ||
                   (tkey.substr(0,6)==="event_") || tkey.startsWith("_") ||
                   tkey==="trackDescription" || tkey==="currentArtist" || tkey==="groupRole" ||
                   tkey==="currentAlbum" || tkey==="trackImage" || tkey==="mediaSource" ||
                   tkey==="weatherIcon" || tkey==="forecastIcon" ||
                   !isNaN(+tval) || thingtype===tval ||
                   (tval.substr(0,7)==="number_") || 
                   (tval.indexOf("://")!==-1) ||
                   (tval.indexOf("::")!==-1) || tval.length > 30 ) {
            extra = "";
        } else {
            extra = " " + tval;
        }
        
        // fix track names for groups, empty, and super long
        if (tkey==="trackDescription") {
            tval = fixTrack(tval);
        // change this over to a css so we can style it if needed
        } else if (tkey==="trackImage") {
            if ( tval.substr(0,4) === "http" ) {
                if ( twidth && theight ) {
                    tval = "<img width='" + twidth + "' height='" + theight + "' src='" + tval + "'>";
                } else {
                    tval = "<img class='trackImage' src='" + tval + "'>";
                }
            }
        } else if ( tkey === "battery") {
            var powmod = parseInt(tval);
            powmod = powmod - (powmod % 10);
            tval = "<div style=\"width: " + tval + "%\" class=\"ovbLevel L" + powmod.toString() + "\"></div>";
        } else if ( tval && typeof tval==="string" && tval.startsWith("rtsp:") && tval.length > 40 ) {
            extra = extra + " rtsp";
            // tval = "<div class=\"rtspwrap\">" + tval + "</div>";
        }

        // hide variable precisions
        if ( thingtype==="isy" && tkey.startsWith("prec_") ) {
            extra += " user_hidden";
        }
        
        // for music status show a play bar in front of it
        // now use the real item name and back enable old one
        // note that we add the sibling to the music controls
        // so that linked tiles will operate properly
        // only one sibling for all the controls. The js file deals with this.
        if (tkey==="musicstatus" || (thingtype==="music" && tkey==="status") ) {
            $tc += "<div class=\"overlay music-controls" + subtype + " v_"+kindex+"\">";
            if (sibling) { $tc += sibling; }
            $tc += aidi + " subid=\"music-previous\" title=\"Previous\" class=\""+thingtype+" music-previous" + pkindex + "\"></div>";
            $tc += aidi + " subid=\"music-pause\" title=\"Pause\" class=\""+thingtype+" music-pause" + pkindex + "\"></div>";
            $tc += aidi + " subid=\"music-play\" title=\"Play\" class=\""+thingtype+" music-play" + pkindex + "\"></div>";
            $tc += aidi + " subid=\"music-stop\" title=\"Stop\" class=\""+thingtype+" music-stop" + pkindex + "\"></div>";
            $tc += aidi + " subid=\"music-next\" title=\"Next\" class=\""+thingtype+" music-next" + pkindex + "\"></div>";
            $tc += "</div>";
        }

        // ignore keys for single attribute items and keys that match types
        var tkeyshow;
        if ( (tkey===thingtype ) || 
             (tkey==="value" && j===0) ) {
            tkeyshow= "";
        // add confirm class for keys that start with c$_ so we can treat like buttons
        } else if ( tkey.substr(0,3) === "c__" ) {
            tkey = tkey.substr(3);
            tkeyshow = " " + tkey + " confirm";
        } else {
            tkeyshow = " " + tkey;
        }

        // add real sub for linked tiles
        if ( realsubid && realsubid!==tkey ) {
            tkeyshow = tkeyshow + " " + realsubid;
        }
         // include class for main thing type, the subtype, a sub-key, and a state (extra)
        // also include a special hack for other tiles that return number_ to remove that
        // this allows KuKu Harmony to show actual numbers in the tiles
        // finally, adjust for level sliders that can't have values in the content
        // hide all of the ISY uom items - couid do in CSS but this is easier and faster
        if ( thingtype==="isy" && tkey.startsWith("uom_") ) {
            $tc += "<div class=\"overlay "+tkey+" hidden v_"+kindex+"\">";
        } else {
            $tc += "<div class=\"overlay "+tkey+" v_"+kindex+"\">";
        }
        if (sibling) { $tc += sibling; }
        if ( tkey === "level" || tkey==="onlevel" || tkey==="colorTemperature" || tkey==="volume" ) {
            $tc += aidi + ttype + " subid=\"" + tkey+"\" value=\""+tval+"\" title=\""+tkey+"\" class=\"" + thingtype + tkeyshow + pkindex + "\" id=\"" + aitkey + "\"></div>";
        } else if ( typeof tkey==="string" && typeof tval==="string" && tkey.substr(0,8)==="_number_" && tval.substr(0,7)==="number_" ) {
            var numval = tkey.substring(8);
            $tc += aidi + ttype + " subid=\"" + tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + "\" id=\"" + aitkey + "\">" + numval + "</div>";
        } else {
            if ( typeof tval==="string" && tval.substr(0,6)==="RULE::" && subtype!=="rule" ) {
                tkeyshow += " rule";
            }
            $tc += "<div aid=\""+i+"\" type=\""+thingtype+"\"  subid=\""+tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + extra + "\" id=\"" + aitkey + "\">" + tval + "</div>";
        }
        $tc += "</div>";
    }
    return $tc;
}

function getCustomCount(stype, defcount) {
    var customcnt = defcount;
    if ( array_key_exists("specialtiles", GLB.options.config) ) {
        var specialarr = GLB.options.config["specialtiles"];
        if ( array_key_exists(stype, specialarr) ) {
            customcnt = parseInt(specialarr[stype]);
            if ( isNaN(customcnt) || customcnt < 1 ) { 
                customcnt = defcount; 
            }
        }
    }
    return customcnt;
}

function getCustomName(defbase, idx, cnum) {
    // make the default name start with a capital letter if we give a number
    var defname;
    if ( cnum && typeof cnum==="number" || typeof cnum==="string") {
        defname = defbase.substr(0,1).toUpperCase() + defbase.substr(1);
        defname = defname + cnum;
    } else {
        defname = defbase;
    }
    return defname;
}

function getFormattedDate(fmtdate, d, clockid) {
    var weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if ( typeof d=== "undefined" || !d ) {
        d = new Date();
    }
    var dofw = d.getDay();
    var mofy = d.getMonth();
    var weekday = weekdays[dofw];
    var month = months[mofy];
    var day = d.getDate().toString();
    var zday = day;
    if ( zday.length < 2 ) {
        zday = "0" + zday;
    }
    var year = d.getFullYear().toString();
    var datestr;

    // set date and weekday to react to custom values
    if ( fmtdate && typeof fmtdate==="string" ) {
        datestr = fmtdate;
        if ( fmtdate.indexOf("Y")!==-1 ) {
            datestr = datestr.replace("Y", year);
        }
        if ( fmtdate.indexOf("y")!==-1 ) {
            datestr = datestr.replace("y", year.substr(-2));
        }
        if ( fmtdate.indexOf("D")!==-1 ) {
            datestr = datestr.replace("D", zday);
        }
        if ( fmtdate.indexOf("d")!==-1 ) {
            datestr = datestr.replace("d", day);
        }
        if ( fmtdate.indexOf("M")!==-1 ) {
            datestr = datestr.replace("M", month);
        }
        if ( fmtdate.indexOf("m")!==-1 ) {
            datestr = datestr.replace("m", month.substr(0,3));
        }
        if ( fmtdate.indexOf("W")!==-1 ) {
            datestr = datestr.replace("W", weekday);
        }
        if ( fmtdate.indexOf("w")!==-1 ) {
            datestr = datestr.replace("w", weekday.substr(0,3));
            weekday = weekday.substr(0,3);
        }
    } else {
        fmtdate = "M d, Y";
        datestr = month + " " + day + ", " + year;
    }
    var retobj = {fmt_date: fmtdate, date: datestr, week: weekday};
    return retobj;
}

function getFormattedTime(fmttime, d, clockid) {
    if ( typeof d=== "undefined" || !d ) {
        d = new Date();
    }

    var timezone = d.getTimezoneOffset().toString();
    var hour24 = d.getHours();
    var hour = hour24;
    var min = d.getMinutes().toString();
    var sec = d.getSeconds().toString();

    var zmin = min;
    if ( zmin.length < 2 ) { 
        zmin = "0" + min.toString();
    }
    var zsec = sec;
    if ( zsec.length < 2 ) { 
        zsec = "0" + zsec;
    }
    if ( hour24=== 0 ) {
        hour = "12";
    } else if ( hour24 > 12 ) {
        hour = (+hour24 - 12).toString();
    } else {
        hour = hour.toString();
    }
    var zhour = hour;
    if ( zhour.length < 2 ) {
        zhour = "0" + zhour;
    }
    var zhour24 = hour24;
    if ( zhour24.length < 2 ) {
        zhour24 = "0" + zhour24;
    }

    var timezone;
    var timestr;

    if ( fmttime ) {
        timestr = fmttime;
        timestr = timestr.replace("g",hour24);
        timestr = timestr.replace("h",hour);
        timestr = timestr.replace("G",zhour24);
        timestr = timestr.replace("H",zhour);
        timestr = timestr.replace("i",min);
        timestr = timestr.replace("I",zmin);
        timestr = timestr.replace("s",sec);
        timestr = timestr.replace("S",zsec);
        if ( hour24 >= 12 ) {
            timestr = timestr.replace("a","pm");
            timestr = timestr.replace("A","PM");
        } else {
            timestr = timestr.replace("a","am");
            timestr = timestr.replace("A","AM");
        }
    } else {
        fmttime = "h:I:S A";
        timestr = hour + ":" + zmin + ":" + zsec;
        if ( hour24 >= 12 ) {
            timestr+= " PM";
        } else {
            timestr+= " AM";
        }
    }

    var retobj = {fmt_time: fmttime, time: timestr, timezone: timezone};
    return retobj;
}

function getClock(clockid) {
    // set up all defaults here - can change with customizer
    var clockname = "Digital Clock";
    var clockskin = "";
    if ( clockid==="clockanalog" ) {
        clockname = "Analog Clock";
        clockskin = "CoolClock:swissRail:72";
    }
    var d = new Date();
    var dates = getFormattedDate("M D, Y", d, clockid);
    var dateofmonth = dates.date;
    var weekday = dates.week;
    var fmtdate = dates.fmt_date;

    var times = getFormattedTime("h:I:S A", d, clockid);
    var timeofday = times.time;
    var fmttime = times.fmt_time;
    var timezone = times.timezone;

    var timeofday = d.toLocaleTimeString();
    var timezone = d.getTimezoneOffset().toString();
    var dclock = {"name": clockname, "skin": clockskin, "weekday": weekday,
        "date": dateofmonth, "time": timeofday, "tzone": timezone,
        "fmt_date": fmtdate, "fmt_time": fmttime};

    return dclock;
}

function addSpecials() {
    // set hub number to nothing for manually created tiles
    var hubnum = "-1";

    // add digital clock tile
    // never refresh since clocks have their own refresh timer built into the javascript code
    // you will need to over-ride this with the tile customizer if you add custom fields
    var clockidd = "clockdigital";
    var dclock = getClock(clockidd);
    var dname = dclock["name"];
    dclock = getCustomTile(dclock, "clock", clockidd);
    allthings["clock|"+clockidd] = {"id" :  clockidd, "name" :  dname, 
        "hubnum" :  hubnum, "type" :  "clock", "refresh": "slow", "value" :  dclock};

    // add analog clock tile - no longer use dclock format settings by default
    var clockida = "clockanalog";
    var aclock = getClock(clockida);
    var aname = aclock["name"];
    aclock = getCustomTile(aclock, "clock", clockida);
    allthings["clock|"+clockida] = {"id" :  clockida, "name" :  aname, 
        "hubnum" :  hubnum, "type" :  "clock", "refresh": "slow", "value" :  aclock};

    // add special tiles based on type and user provided count
    // this replaces the old code that handled only video and frame tiles
    // this also creates image and blank tiles here that used to be made in groovy
    // putting this here allows them to be handled just like other modifiable tiles
    // these tiles all refresh fast except first 4 frames that are reserved for weather
    // renamed accuweather to forecast2 for simplicity sake and to make sorting work
    var specialtiles = getSpecials();
    for (var stype in specialtiles) {
        var sid = specialtiles[stype];
        var speed = sid[4] || "normal";
        
        var fcnt = getCustomCount(stype, sid[3]);
        if ( fcnt ) {
            for (var i=0; i<fcnt; i++) {

                var k = (i + 1).toString();
                var fid = sid[0] + k;
                var idx = stype + "|" + fid;

                var fn = getCustomName(stype, idx, k);
                var ftile = {"name": fn};
                ftile = getCustomTile(ftile, stype, fid);
                ftile = returnFile(ftile, stype);

                // we now preserve the original name in the master array
                allthings[idx] = {"id":  fid, "name": fn, "hubnum":  hubnum, 
                    "type": stype, "refresh": speed, "value":  ftile};
            }
        }
    }
    
    // create the controller tile
    // keys starting with c__ will get the confirm class added to it
    // this tile cannot be customized by the user due to its unique nature
    // but it can be visually styled just like any other tile
    var controlval = {"name": "Controller", "showoptions": "Options","refreshpage": "Refresh","c__refactor": "Reset",
                 "c__userauth": "Re-Auth","showid": "Show Info","toggletabs": "Toggle Tabs",
                 "showdoc": "Documentation",
                 "blackout": "Blackout","operate": "Operate","reorder": "Reorder","edit": "Edit"};
    controlval = getCustomTile(controlval, "control", "control_1");
    allthings["control|control_1"] = {"id":  "control_1", "name": "Controller", "hubnum":  hubnum, 
                "type":  "control", "refresh": "never", "value":  controlval};
}

// create addon subid's for any tile
// this enables a unique customization effect
function getCustomTile(custom_val, customtype, customid) {
    const reserved = ["index","rooms","things","config","control","useroptions"];

    try {
        var index = GLB.options["index"];
    } catch(e) {
        console.log( (ddbg()), "warning, index not available for customization for id= ", customid);
        return custom_val;
    }
    
    // see if a section for this id is in options file
    // this is where customizer updates are processed
    var lines = false;
    if (array_key_exists("user_" + customid, GLB.options) ) {
        lines = GLB.options["user_" + customid];
    } else if ( !in_array (customid, reserved) && array_key_exists(customid, GLB.options) ) {
        lines = GLB.options[customid];
    }

    if ( lines && is_array(lines) ) {
        
        // allow user to skip wrapping single entry in an array
        // the GUI will never do this but a user might in a manual edit
        if ( !is_array(lines[0]) ) {
            lines = [lines];
        }
        
        // first remove existing ones so we can read them in the proper order
        lines.forEach(function(msgs) {
            var subidraw = msgs[2].trim();
            var subid = subidraw.replace(/[\"\*\<\>\!\{\}\.\,\:\+\&\%]/g,""); //  str_replace(ignores, "", subidraw);
            var companion = "user_" + subid;
            delete custom_val[subid];
            delete custom_val[companion];
        });
        
        // sort the lines and add them back in the requested order
        // replacements of default items will occur in default place
        // usort(lines, sortlinefunc);
        
        // loop through each item and add to tile
        lines.forEach(function(msgs) {

           
            // check to make sure we have an array of three long
            // this strict rule is followed to enforce discipline use
            if ( is_array(msgs) && msgs.length >= 3 ) {
            
                var calltype = msgs[0].toString().toUpperCase().trim();
                var content = msgs[1].toString().trim();
                // var posturl = encodeURIComponent(content);
                var subidraw = msgs[2].trim();
                var subid = subidraw.replace(/[\"\*\<\>\!\{\}\.\,\:\+\&\%]/g,""); //  str_replace(ignores, "", subidraw);
                var companion = "user_" + subid;
    
                // process web calls made in custom tiles
                // this adds a new field for the URL or LINK information
                // in a tag called user_subid where subid is the requested field
                // web call results and linked values are stored in the subid field
                if ( content && (calltype==="PUT" || calltype==="GET" || calltype==="POST" || calltype==="URL") )
                {
                    // custom_val[companion] = "::" + calltype + "::" + posturl;
                    custom_val[companion] = "::" + calltype + "::" + encodeURI(content);
                    custom_val[subid] = calltype + "::" + subid;
               
                } else if ( calltype==="LINK" ) {
                    // code for enabling mix and match subid's into custom tiles
                    // this stores the tile number so we can quickly grab it upon actions
                    // this also allows me to find the hub number of the linked tile easily
                    // and finally, the linked tile is displayable at user's discretion
                    // for this to work the link info is stored in a new element that is hidden
                    
                    var idx = array_search(content, index);

                    // changed the link logic so we don't need to know the value at link time
                    // if ( allthings && idx!== false && array_key_exists(idx, allthings) ) {
                    if ( idx !== false ) {
                
                        // if the subid exists in our linked tile add it
                        // this can replace existing fields with linked value
                        // if an error exists show text of intended link
                        // first case is if link is valid and not an existing field
                        // if ( array_key_exists(subid, pvalue) ) {
                        custom_val[companion] = "::" + calltype + "::" + idx;
                        custom_val[subid]= "LINK::" + content;
                            
                    // final cases are if link tile wasn't found
                    } else {
                        custom_val[companion] = "::" + calltype + "::" + "error";
                        custom_val[subid] = "LINK::" + content;
                        console.log( (ddbg()), "error - Links unavailable to link #" + content + " with subid= " + subid);
                    }
               
                } else if ( ENABLERULES && calltype==="RULE" ) {
                    custom_val[companion] = "::" + calltype + "::" + content;
                    custom_val[subid] = "RULE::" + subid;

                } else if ( calltype==="TEXT" ) {
                    // code for any user provided text string
                    // we could skip this but including it bypasses the hub call
                    // which is more efficient and safe in case user provides
                    // a subid that the hub might recognize - this way it is
                    // guaranteed to just pass the text on the browser
                    calltype = "TEXT";
                    custom_val[companion] = "::" + calltype + "::" + content;
                    custom_val[subid] = content;
                }
            }
        });

        // fix clock date if the format sting is provided
        if ( array_key_exists("date", custom_val) && array_key_exists("fmt_date", custom_val) ) {
            var dates = getFormattedDate(custom_val["fmt_date"], null, customid);
            custom_val["date"] = dates.date;
            if ( array_key_exists("weekday", custom_val) ) {
                custom_val["weekday"] = dates.week;
            }
            custom_val["fmt_date"] = dates.fmt_date;
        }
        if ( array_key_exists("time", custom_val) && array_key_exists("fmt_time", custom_val) ) {
            var times = getFormattedTime(custom_val["fmt_time"], null, customid);
            custom_val["time"] = times.time;
            if ( array_key_exists("tzone", custom_val) ) {
                custom_val["tzone"] = times.timezone;
            }
            custom_val["fmt_time"] = times.fmt_time;
        }
    }
    return custom_val;
}

// this little gem makes sure items are in the proper order
function setValOrder(val) {
    const order = {"name": 1, "battery": 2, "color": 3, "switch": 7, "momentary": 7, "presence": 7,
                   "contact": 8, "door": 8, "motion": 9, "themode": 10, "temperature": 7,
                   "trackDescription": 11, "trackImage": 12, "currentAlbum": 13, 
                   "mediaSource": 14, "currentArtist": 15, "playbackStatus": 16, 
                   "_muteGroup": 17, "_unmuteGroup": 18, "_volumeDown": 19, "_volumeUp": 20, 
                   "_previousTrack": 21, "_pause": 22, "_play": 23, "_stop": 24, "_nextTrack": 25,
                   "onlevel": 150, "level": 151, "volume": 152, "colorTemperature": 153,
                   "allon": 41, "alloff": 42 };

    function getComp(vala) {
        var comp;
        if ( array_key_exists(vala, order) ) {
            comp = order[vala];
        } else if ( vala.startsWith("_") ) {
            comp = 50;
        } else if ( vala.startsWith("user_") ) {
            comp = 70;
        } else if ( vala.startsWith("event_") ) {
            comp = 100;
        } else {
            comp = 30;
        }
        return comp;
    }

    // leave user fields unsorted
    // but sort all others based on type of subid
    var keys = Object.keys(val).sort( function(vala, valb) {

        var compa = array_key_exists("user_"+vala, val) ? 70 : getComp(vala);
        var compb = array_key_exists("user_"+valb, val) ? 70 : getComp(valb);
        if ( compa===30 && compb===30 ) {
            return vala - valb;
        } else {
            return compa - compb;
        }
    });

    var newval = {};
    keys.forEach( function(key) {
        newval[key] = val[key];
    });

    return newval;
}

function processHubMessage(hubmsg) {
    // loop through all things for this hub
    // remove music trackData field that we don't know how to handle
    var audiomap = {"name": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                    "status": "status", "trackMetaData": "trackImage", "trackImage":"trackImage", "metaData":"",
                    "trackNumber":"", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
                    "audioSource": "mediaSource"};
    var cnt = 0;
    var idx;

    // push info to all things that match
    // we don't know the thing types so we have to check all things
    // this uses the format defined in the HousePanel.groovy file
    // that was also used in the old housepanel.push app
    var subid = hubmsg['change_attribute'];
    var hubmsgid = hubmsg['change_device'].toString();
    // var strtype = hubmsg['chnage_type'] || "";

    // deal with presence tiles
    if ( subid==="presence" && hubmsg['change_value']==="not present" ) {
        hubmsg['change_value'] = "absent";
    }

    // get any custom size parameters for linked tiles
    var triggeridx = hubmsg['change_type'] + "|" + hubmsgid;
    var customwidth = false;
    var customheight = false;
    try {
        if ( allthings[triggeridx] && array_key_exists("user_width", allthings[triggeridx]["value"]) ) {
            customwidth = allthings[triggeridx]["value"]["user_width"];
            if (customwidth.startsWith("::TEXT::")) {
                customwidth = customwidth.substr(8);
            } else {
                customwidth = false;
            }
        }
        if ( allthings[triggeridx] && array_key_exists("user_height", allthings[triggeridx]["value"]) ) {
            customheight = allthings[triggeridx]["value"]["user_height"];
            if (customheight.startsWith("::TEXT::")) {
                customheight = customheight.substr(8);
            } else {
                customheight = false;
            }
        }
    } catch (e) {
        customwidth = false;
        customheight = false;
    }

    if ( DEBUG12 ) {
        console.log( (ddbg()), "processhubMessage - hubmsgid: ", hubmsgid, "\nmessage: ", hubmsg, " sizes: width: ", customwidth, " height: ", customheight);
    }

    for (idx in allthings) {

        var entry = allthings[idx];

        // removed the logic that skips rule if state is already set as wanted
        // because it could be a button or a momentary or a timer rule in mid cycle
        // if timer rule in mid cycle this starts the cycle fresh again
        // (entry['value'][subid] !== hubmsg['change_value'] || entry.type==="button"  )
        if ( entry.id === hubmsgid ) {
            cnt++;
            entry['value'][subid] = hubmsg['change_value'];

            // handle special audio updates
            if ( entry.type==="audio" && hubmsg['change_type']==="audio" ) { // } && array_key_exists("audioTrackData",subid) ) {
                entry['value'] = translateAudio(entry['value']);
            } else if ( entry.type==="music" && hubmsg['change_type']==="music" ) { // } && array_key_exists("trackData",subid) ) {
                entry['value'] = translateMusic(entry['value']);
            } else if ( entry.type==="weather" && hubmsg['change_type']==="weather" ) {
                var origname = entry.name || entry.value.name;
                entry['value'] = translateWeather(origname, entry['value']);
            }

            // avoid pushing client if this is a passive updater
            if ( ! array_key_exists("skip_push", hubmsg) ) {
                pushClient(entry.id, entry.type, subid, entry['value'])
            }
            processRules(entry.id, entry.type, subid, entry['value'], "processMsg");
        }
    }

    // now handle links including checking for triggers that have objects tied to them
    // this happens for audio and music tiles and maybe others in the future
    var newval;
    try {
        newval = JSON.parse(hubmsg['change_value']);
    } catch (e) { 
        newval = null;
    }

    if ( newval && hubmsg['change_type']==="audio" && subid==="audioTrackData" ) {
        newval = translateAudio(newval, false);
    } else if ( newval && hubmsg['change_type']==="music" && subid==="trackData" ) {
        newval = translateAudio(newval, false, audiomap);
    } else if ( newval && hubmsg['change_type']==="weather" && subid==="forecast" ) {
        var origname = hubmsg['change_name'];
        newval = translateWeather(origname, newval);
    } else {
        newval = {};
        newval[subid] = hubmsg['change_value'];
    }
    if ( typeof newval === "object" ) {

        if ( DEBUG12 ) {
            console.log( (ddbg()), "processHubMessage - newval: ", newval );
        }

        // loop through each field of the object
        // or the only item if this is a simple link
        for ( var obj_subid in newval ) {
            var companion = "user_"+obj_subid;

            // check every tile for a link that matches this companion field
            for (idx in allthings) {
                var entry = allthings[idx];

                // this code replaces the pushclient handler on js side that used to do links
                // it is faster here and more robust and allows rules to be tied in as we
                if ( array_key_exists(companion, entry.value) ) {
                    var helperval = entry.value[companion];
                    var ipos = helperval.indexOf("::",2);
                    var command = helperval.substring(2, ipos);
                    var lidx = helperval.substring(ipos+2);
                    var lidxitems = lidx.split("|");
                    var linktype = lidxitems[0];
                    var linkbid = lidxitems[1];

                    // get info for links but skip if the link had an error
                    if ( DEBUG12 ) {
                        console.log( (ddbg()), "processhubMessage - link debug. companion=",companion," helper=",helperval," command=",command,
                                    " lidx=",lidx," linktype=",linktype," linkbid=",linkbid);
                    }
                    if ( command==="LINK" && linkbid === hubmsgid ) {
                        cnt++;
                        entry['value'][obj_subid] = newval[obj_subid];
                        var idxitems = idx.split("|");
                        var targetobj = {};
                        targetobj[obj_subid] = newval[obj_subid];

                        // add size info if available
                        if (customwidth ) {
                            targetobj["width"] = customwidth;
                        }
                        if (customheight) {
                            targetobj["height"] = customheight;
                        }
                        if ( ! array_key_exists("skip_push", hubmsg) ) {
                            pushClient(idxitems[1], idxitems[0], obj_subid, targetobj);
                        }
                        processRules(idxitems[1], idxitems[0], obj_subid, targetobj, "processMsg");
                    }
                }
            }

        }

   }
    // resetRules();
    return 'pushed new status info to ' + cnt + ' tiles';
}

function resetRules() {
    GLB.rules = {};
    if ( DEBUG11 ) {
        console.log( (ddbg()), "reset dup flag... ");
    }
}

function resetRuleTimers() {
    for (var delhash in GLB.ruledelay) {
        try {
            clearTimeout(GLB.ruledelay[delhash]);
            delete GLB.ruledelay[delhash];
        } catch(e) { }
    }
    GLB.ruledelay = {};
    if ( DEBUG11 ) {
        console.log( (ddbg()), "reset RULE timers");
    }
}

// this function handles processing of all websocket calls from ISY
// used to keep clients in sync with the status of ISY operation
function processIsyMessage(isymsg) {
    var newval;
    var pvalue;
    if ( DEBUG9 ) {
        console.log( (ddbg()), "ISY event detected for msg: ", isymsg);
    }
    xml2js(isymsg, function(err, result) {
        if ( !err && result.Event ) {
            var control = result.Event.control;
            var action = result.Event.action;
            var node = result.Event.node;
            var eventInfo = result.Event.eventInfo;
            if ( DEBUG9 ) {
                console.log( (ddbg()), "ISY event json result: ", UTIL.inspect(result, false, null, false) );
            }

            if ( is_array(node) && node.length && node[0]!=="" &&
                 is_array(control) && control.length && control[0]!=="" &&
                 action[0] && action[0]["$"] && action[0]["_"] ) {
                var bid = node[0];
                var idx = "isy|" + bid;

                if ( allthings && allthings[idx] && allthings[idx].value && allthings[idx].type==="isy" ) {
                    pvalue = allthings[idx].value;
                    try {
                        newval = action[0]["_"] || pvalue[subid];
                        newval = parseFloat(newval);
                        var uom = action[0]["$"]["uom"] || "";

                        // adjust the value based on precision
                        if ( action[0]["$"]["prec"] ) {
                            var prec = parseInt(action[0]["$"]["prec"]);
                            if ( ! isNaN(prec) && prec > 0 ) {
                                var pow10 = Math.pow(10,prec);
                                newval = newval / pow10;
                            }
                        }

                        newval = newval.toString();
                    } catch (e) {
                        console.log( (ddbg()), "error - node // processIsyMessage: ", e);
                        return;
                    }

                    var subid = mapIsy(control[0], uom);
                    pvalue = translateIsy(bid, control[0], uom, subid, pvalue, newval, "");
                    pushClient(bid, "isy", subid, pvalue, false, false);
                    processRules(bid, "isy", subid, pvalue, "processMsg");
                    if ( DEBUG9 ) {
                        console.log( (ddbg()), "ISY webSocket updated node: ", bid, " trigger:", control[0], " subid: ", subid, " uom: ", uom, " newval: ", newval, " value: ", pvalue);
                    }
                }

            // set variable changes events
            } else if ( is_object(eventInfo[0]) && array_key_exists("var", eventInfo[0]) ) {
                var varobj = eventInfo[0].var[0];
                if ( DEBUG9 ) {
                    console.log( (ddbg()), "Event info: ", UTIL.inspect(varobj, false, null, false) );
                }
                var bid = "vars";
                var idx = "isy|" + bid;
                if ( allthings && allthings[idx] && allthings[idx].value && allthings[idx].type==="isy" ) {
                    pvalue = allthings[idx]["value"];
                    try {
                        var id = varobj["$"]["id"];
                        if ( varobj["$"]["type"] === "1" ) {
                            var subid = "int_" + id;
                        } else if ( varobj["$"]["type"] === "2" ) {
                            subid = "state_" + id;
                        } else {
                            throw "invalid variable type: " + varobj["$"]["type"];
                        }

                        if ( is_array( varobj.val) ) {
                            newval = parseFloat(varobj.val[0]);
                        } else {
                            newval = parseFloat(varobj.val);
                        }
                        if ( is_array(varobj.prec) ) {
                            var prec = parseInt(varobj.prec[0]);
                            if ( !isNaN(newval) && ! isNaN(prec) && prec > 0 ) {
                                newval = newval / Math.pow(10,prec);
                            }
                        } 
                        pvalue[subid] = newval.toString();
                        allthings[idx]["value"] = pvalue;
                        pushClient(bid, "isy", subid, pvalue, false, false);
                        processRules(bid, "isy", subid, pvalue, "processMsg");
                        if ( DEBUG9 ) {
                            console.log( (ddbg()), "ISY webSocket updated node: ", bid, " trigger:", control[0], " subid: ", subid, " newval: ", newval, " pvalue: ", pvalue);
                        }

                    } catch (e) {
                        console.log( (ddbg()), "warning - var // processIsyMessage: ", e);
                        return;
                    }
                }

            // handle program changes events
            } else if ( is_object(eventInfo[0]) && array_key_exists("id", eventInfo[0]) && 
                        array_key_exists("r",  eventInfo[0]) && array_key_exists("f",  eventInfo[0]) ) {
                try {
                    // var idsymbol = parseInt(eventInfo[0]["id"]);
                    // idsymbol = idsymbol.toString();
                    var idsymbol = eventInfo[0]["id"].toString().trim();
                    var len = 4 - idsymbol.length;
                    var bid = "prog_" + "0000".substr(0,len) + idsymbol;
                    var idx = "isy|" + bid;
                    if ( allthings && allthings[idx] && allthings[idx].value && allthings[idx].type==="isy" ) {
                        pvalue = allthings[idx]["value"];
                        pvalue["lastRunTime"] = eventInfo[0]["r"][0];
                        pvalue["lastFinishTime"] = eventInfo[0]["f"][0];

                        // use decoder ring documented for ISY program events
                        if ( array_key_exists("s", eventInfo[0]) ) {
                            var st = eventInfo[0]["s"][0].toString();
                            if ( st.startsWith("2") ) {
                                pvalue["status"] = "true";
                            } else if ( st.startsWith("3") ) {
                                pvalue["status"] = "false";
                            } else if ( st.startsWith("1") ) {
                                pvalue["status"] = "unknown";
                            } else {
                                pvalue["status"] = "not_loaded"
                            }
                        }
                        if ( array_key_exists("on", eventInfo[0]) ) {
                            pvalue["enabled"] = "true";
                        } else if ( array_key_exists("off", eventInfo[0])  ) {
                            pvalue["enabled"] = "false";
                        }
                        if ( array_key_exists("rr", eventInfo[0]) ) {
                            pvalue["runAtStartup"] = "true";
                        } else if ( array_key_exists("nr", eventInfo[0])  ) {
                            pvalue["runAtStartup"] = "false";
                        }
                        allthings[idx]["value"] = pvalue;
                        pushClient(bid, "isy", "lastRunTime", pvalue, false, false);
                        // pushClient(bid, "isy", "lastFinishTime", pvalue, false, false);
                        // processRules(bid, "isy", subid, pvalue, "processMsg");
                        if ( DEBUG9 ) {
                            console.log( (ddbg()), "ISY webSocket updated program: ", bid, " pvalue: ", pvalue);
                        }
                    }
                } catch(e) {
                    console.log( (ddbg()), "error - program // processIsyMessage: ", e);
                    return;
                }

            } else if (DEBUG9) {
                console.log( (ddbg()), "Unhandled ISY event: ", UTIL.inspect(result.Event, false, null, false) );
            }
        }
    });
}

function getTimeStr(ifvalue, str) {
    str = str.toUpperCase();
    var firstcolon = str.indexOf(":");
    var secondcolon = -1;
    if ( firstcolon !== -1 ) {
        var str2 = str.substr(firstcolon+1);
        secondcolon = str2.indexOf(":");
    }
    var amloc = str.indexOf("AM");
    var pmloc = str.indexOf("PM");

    var today = new Date();
    var d = new Date(today.toDateString() + " " + ifvalue);

    var hour = d.getHours().toString();
    var min = d.getMinutes().toString();
    var sec = d.getSeconds().toString();

    var zsec = "";
    if ( secondcolon !== -1 ) {
        zsec = sec.length < 2 ? "0" + sec : sec;
    }

    var zmin = "";
    if ( firstcolon !== -1 ) {
        zmin = min.length < 2 ? "0" + min : min;
    }

    if ( amloc !== -1 || pmloc !== -1 ) {
        if ( hour=== 0 ) {
            hour = "12";
        } else if ( hour > 12 ) {
            hour = (+hour - 12).toString();
        }
    }

    var timestr = hour.length < 2 ? "0" + hour : hour;
    if ( zmin ) {
        timestr+= ":" + zmin;
     }
    if ( zmin && zsec ) {
        timestr+=  + ":" + zsec;
    }

    if ( amloc !== -1 ) {
        timestr+= " AM";
    }
    if ( pmloc !== -1 ) {
        timestr+= " PM";
    }

    if ( DEBUG11 ) {
        console.log( (ddbg()), "getTimeStr: ", ifvalue, str, amloc, pmloc, timestr );
    }
    return timestr;
}

function processRules(bid, thetype, trigger, pvalue, rulecaller) {

    if ( !ENABLERULES || (GLB.options.config["rules"] !=="true" && GLB.options.config["rules"] !==true) ) {
        return;
    }

    // go through all things that could be links for this tile
    var userid = "user_" + bid;
    var ifvalue = false;
    var rbid = bid;
    var rtype = thetype;
    var ridx = thetype + "|" + bid;

    // if this tile has no rule, do nothing
    if ( !array_key_exists(userid, GLB.options) ) {
        return;
    }

    // go through all tiles with a new rule type
    var idx = thetype + "|" + bid;
    try {
        var index = GLB.options["index"];
        var tileid = index[idx].toString();
    } catch (e) {
        console.log( (ddbg()), "webSocket RULE error: id: ", bid, " type: ", thetype, " trigger: ", trigger, " error: ", e);
        return;
    }
    
    // rule structure
    // delay and attr are optional, but must give a delay to give an attr; just set it to 0 or false to skip delay
    // you cannot safely mix the logic of "or" with the logic of "and" but it sometimes works
    // for example if an "or" is given at the end it will be a logical or of everything in front of it
    // likewise if an "and" is given at the end it will be a logic and of everything in front of it
    // so you can mix and and or if you use the non dominant logic statement only once at the end
    // if subid>=xx or num=subid=on or num=subid=off... , num=subid=value=delay, num=subid=value=delay=attr, ...
    // if subid>=xx and num=subid=on and num=subid=off... , num=subid=value=delay, num=subid=value=delay=attr, ...
    // for example...
    // user_custome_1 : [ [RULE, "if switch==on and 167=switch==on, 28=switch=on, 12=switch=on=2", myrule, 1], 
    //                    [RULE, "if state==away or 42=presence==absent", 19=thermostatMode=heat, 19=heatingSetpoint=72, 14=lock=lock, rule2, 2] ]
    const regsplit = /[,;]/;
    const ifpattern = /(if)\s+(.*)/;
    const triggerpattern = /(\w+)\s*([=|!|<|>])(=?)\s*(.+)/;
    // const rulepattern = /(\d*)\s*=\s*(\w+)\s*([=|!|<|>])(=?)\s*(\w+)/;
    const rulepattern = /(\d*)\s*=\s*(\w+)\s*([=|!|<|>])(=?)\s*(.+)/;
    
    // print some debug info
    var items = GLB.options[userid];
    if ( DEBUG11 ) {
        console.log( (ddbg()), "RULE: id: ", bid, " type: ", thetype, " trigger: ", trigger, " tileid: ", tileid, " userid: ", userid, " rules: ", UTIL.inspect(items, false, null, false));
    }

    // loop through all the custom elements of this tile looking for rules
    items.forEach( function(item) {

        // process custom entries that are rules
        // the subid it is tied to is ignored as is the order number
        // so we only need to get item[0] and item[1]
        if ( item[0]==="RULE" ) {
            var linkval = item[1].trim();
            var isrule = false;

            // split the test line between commas and semi-colons
            var testcommands = linkval.split(regsplit);

            // only proceed if there are at least two parts and the first part starts with "if "
            if ( testcommands.length > 1 && testcommands[0].trim().startsWith("if") ) {

                // get the if and the rule and continue if in the right format
                var iftest = testcommands[0].match(ifpattern);
                var rulestr = (iftest && iftest.length>1 && iftest[2]) ? iftest[2] : "";
                if ( iftest[1]==="if" && rulestr ) {

                    // get the rule set
                    var ruleset = rulestr.split(/\s+/);
                    var newset = [];
                    var theword = "";
                    ruleset.forEach(function(aword) {
                        aword = aword.trim();
                        if ( aword.toLowerCase()==="or" || aword.toLowerCase()==="and" ) {
                            newset.push(theword);
                            newset.push(aword.toLowerCase());
                            theword = "";
                        } else if ( aword.toLowerCase()==="am" || aword.toLowerCase()==="pm" ) {
                            theword = theword + " " + aword;
                        } else {
                            theword = theword + aword;
                        }
                    }) 
                    newset.push(theword);


                    var doand = true;
                    if ( DEBUG11 ) {
                        console.log( (ddbg()), "RULE debug: rulestr: ", rulestr, " rulseset: ", ruleset, " newset: ", newset);
                    }
    
                    // loop through each one and add to test
                    var rulenum = 0;
                    var priorand = false;
                    var firstlogical = false;
                    newset.forEach( function(rule) {

                        var ruleparts = null;
                        var ruletileid = null;
                        var rulesubid = "";
                        var rulevalue = "";
                        var ruleop = "";
                        var ruleop2 = "";
                        rule = rule.trim();
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), "RULE debug: rule step#", rulenum, " rule: ", rule);
                        }
    
                        // set rule mode based on word - if it is "and" then use and logic
                        // the firstlogical parameter is used to allow mixing of and and or to some degree
                        // it allows logical "or" to follow some and strings by using just the first item
                        // if one then switches back to and then firstlogical will save the most recent and status for the next or
                        if ( rule==="and" ) {
                            doand = true;
                            priorand = true;

                        // if the separator word is "or" then use or logic
                        } else if ( rule==="or" ) {
                            doand = false;

                        // otherwise we are on an element so interpret the test
                        } else {
                            ruleparts = rule.match(rulepattern);
                            // first check for format with a tile ID number
                            if ( ruleparts ) {
                                ruletileid = parseInt(ruleparts[1]);
                                rulesubid = ruleparts[2] || "";
                                ruleop = ruleparts[3] || "";
                                ruleop2 = ruleparts[4];
                                if ( ruleop2 ) { ruleop = ruleop + ruleop2; }
                                rulevalue = ruleparts[5] || "";
                            // if id number not given then assume this tile ID
                            } else {
                                ruleparts = rule.match(triggerpattern);
                                if ( ruleparts ) {
                                    ruletileid = tileid;
                                    rulesubid = ruleparts[1] || "";
                                    ruleop = ruleparts[2] || "";
                                    ruleop2 = ruleparts[3];
                                    if ( ruleop2 ) { ruleop = ruleop + ruleop2; }
                                    rulevalue = ruleparts[4] || "";
                                }
                            }

                            // use this tile's existing value for check if $ symbol given
                            var jv = rulevalue.substr(0,1);
                            var kv = rulevalue.indexOf("$");
                            var rvindex;
                            if ( jv === "$" ) {
                                rvindex = rulevalue.substr(1);
                                if ( array_key_exists(rvindex, pvalue) ) {
                                    rulevalue = pvalue[rvindex];
                                }

                            // use another tile's existing value for check using @tilenum$fieldname syntax
                            } else if ( jv === "@" && kv !== -1 ) {
                                var rvtile = rulevalue.substring(1, kv);
                                rvindex = rulevalue.substr(kv+1);
                                var rvidx = array_search(rvtile, GLB.options["index"]);
                                if ( DEBUG11 ) {
                                    console.log( (ddbg()), "rvtile = ", rvtile, " rvindex= ", rvindex, " rvidx= ", rvidx);
                                }
                                if ( rvidx && allthings[rvidx] && array_key_exists(rvindex, allthings[rvidx]["value"]) ) {
                                    rulevalue = allthings[rvidx]["value"][rvindex];
                                }
                            }

                            if ( DEBUG11 ) {
                                console.log( (ddbg()), "RULE debug: ruleparts: ", ruleparts, " ruletileid: ", ruletileid, " rulesubid: ", rulesubid, 
                                                       " ruleop: ", ruleop, " rulevalue: ", rulevalue, " before: ", doand, " rule: ", rule, " isrule: ", isrule);
                            }
    
                            // compute the test if this test part has the required elements
                            if ( ruletileid && ! isNaN(ruletileid) && ruleop && rulevalue ) {

                                // find the tile index and proceed with activating the rule
                                if ( ruletileid===tileid && array_key_exists(rulesubid, pvalue) ) {
                                    rtype = thetype;
                                    rbid = bid;
                                    ridx = thetype + "|" + bid;
                                    ifvalue = pvalue[rulesubid];
                                } else {
                                    ridx = array_search(ruletileid, GLB.options["index"]);
                                    if ( ridx ) {
                                        var ritems = ridx.split("|");
                                        rtype = ritems[0];
                                        rbid = ritems[1];
                                        try {
                                            ifvalue = allthings[ridx]["value"][rulesubid];
                                        } catch(e) {
                                            ifvalue = false;
                                        }
                                    } else {
                                        ifvalue = false;
                                        rtype = "";
                                        rbid = "";
                                    }
                                }

                                // fix up ISY hubs
                                if ( rtype==="isy" && rulevalue==="on" ) { rulevalue = "DON"; }
                                if ( rtype==="isy" && rulevalue==="off" ) { rulevalue = "DOF"; }

                                if ( DEBUG11 ) {
                                    console.log( (ddbg()), "RULE debug: ridx: ", ridx, " rtype= ", rtype, " rbid= ", rbid, " ifvalue: ", ifvalue, "rulevalue: ", rulevalue, " ruletileid: ", ruletileid, " parts: ", ruleparts );
                                }

                                // get the rule check if the requested subid is recognized
                                // we handle numbers, dates, and times differently than strings
                                if ( ifvalue!==false ) {

                                    var num1 = ifvalue;
                                    var num2 = rulevalue;
                                    if ( rulesubid==="date") {
                                        var d1 = new Date(ifvalue);
                                        var d2 = new Date(rulevalue);
                                        num1 = d1.getTime();
                                        num2 = d2.getTime();
                                        if ( DEBUG11 ) {
                                            console.log( (ddbg()), "ruleop=", ruleop," ifvalue=",ifvalue," rulevalue= ",rulevalue," d1=",d1," d2=",d2," num1=",num1," num2=",num2);
                                        }
                                    } else if ( rulesubid==="time") {
                                        var today = new Date();
                                        var d1 = new Date(today.toDateString() + " " + getTimeStr(ifvalue, rulevalue));
                                        var d2 = new Date(today.toDateString() + " " + rulevalue);
                                        num1 = d1.getTime();
                                        num2 = d2.getTime();
                                        if ( DEBUG11 ) {
                                            console.log( (ddbg()), "ruleop=", ruleop," ifvalue=",ifvalue," rulevalue= ",rulevalue," d1=",d1," d2=",d2," num1=",num1," num2=",num2);
                                        }
                                    } else if ( !isNaN(parseFloat(ifvalue)) && !isNaN(parseFloat(rulevalue)) ) {
                                        num1 = parseFloat(ifvalue);
                                        num2 = parseFloat(rulevalue);
                                    }

                                    var ismatch = ( 
                                        ( (ruleop==="=" || ruleop==="==") && (num1===num2) ) ||
                                        ( (ruleop==="!" || ruleop==="!=") && (num1!==num2) ) ||
                                        ( (ruleop==="<" ) && (num1 <  num2) ) ||
                                        ( (ruleop==="<=") && (num1 <= num2) ) ||
                                        ( (ruleop===">" ) && (num1 >  num2) ) ||
                                        ( (ruleop===">=") && (num1 >= num2) ) 
                                    );

                                    // if this is time and match isn't there check string versions
                                    if ( rulesubid==="time" && !ismatch ) {
                                        ismatch = ( 
                                            ( (ruleop==="=" || ruleop==="==") && (ifvalue===rulevalue) ) ||
                                            ( (ruleop==="!" || ruleop==="!=") && (ifvalue!==rulevalue) ) 
                                        );
                                    }

                                    // apply and/or logic to the final rule determination
                                    if ( rulenum===0 ) {
                                        isrule = ismatch;
                                        firstlogical = ismatch;
                                    } else if ( doand ) {
                                        isrule = isrule && ismatch;
                                    } else {
                                        if ( priorand ) {
                                            isrule = firstlogical || ismatch;
                                            firstlogical = isrule;
                                        } else {
                                            isrule = isrule || ismatch;
                                        }
                                    }
                                } else {
                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "error - invalid RULE syntax: ", rule, " parts: ", ruleparts);
                                    }
                                    isrule = false;
                                }
                            } else {
                                if ( DEBUG11 ) {
                                    console.log( (ddbg()), "error - invalid RULE syntax: ", rule);
                                }
                                ruleparts = false;
                            }
                        }

                        // report state of test
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), "RULE debug: and=true, or=false: ", doand, " ", rule, " after isrule: ", isrule);
                        }
                        rulenum++;
            
                    });
                }
            } else {
                isrule = false;
            }

            // execute the statements after if for the cases that pass the logic test above
            if ( isrule ) {
                execRules(rulecaller, item[1], thetype, 1, testcommands, pvalue);
            }

        }

    });

}

// this executes the rules in the list starting with either 0 or 1
// rules without if statements start at 0, if RULES start at 1
function execRules(rulecaller, item, swtype, istart, testcommands, pvalue) {
    // get a unique has for this rule to use for managing timers and gathering stats
    // we also use this to prevent dup rules within the same doAction cycle
    var itemhash = pw_hash(item,'md5');

    if ( DEBUG11 ) {
        console.log( (ddbg()), "RULE item: ", item, " hash: ", itemhash, " caller: ", rulecaller);
    }

    if ( ! GLB.rules ) {
        GLB.rules = {};
    }
    if ( ! GLB.ruledelay ) {
        GLB.ruledelay = {};
    }
    
    if ( !array_key_exists(itemhash, GLB.rules) ) {
        GLB.rules[itemhash] = false;
    }

    // prevent this rule from running more than once in a single doAction cycle
    if (rulecaller==="callHub") {
        GLB.rules[itemhash] = true;
        if ( DEBUG11 ) {
            console.log( (ddbg()), "setting dup flag...");
        }
    } else if ( GLB.rules[itemhash] ) {
        if ( DEBUG11 ) {
            console.log( (ddbg()), "skipping dup rule...");
        }
        // immediately clear so we only skip this once
        // if a future event comes along for same rule, we do it
        GLB.rules[itemhash] = false;
        return;
    }

    // perform all of the commands if we meet the if test
    // const actpattern = /(\d+)\s*=\s*(\w+)\s*=\s*(\w+)\s*=?\s*(.*)/;
    for (var i= istart; i<testcommands.length; i++) {
        var autostr = testcommands[i];

        // get the parts of the auto exec
        // the regex is an alternate approach but it is slower and not needed for this simple syntax
        // var autoexec = autostr.match(actpattern);
        // the unshift is just so I can keep the same index numbers as when using regex
        var autoexec = autostr.split("=");
        autoexec.unshift(" ");
        var len = autoexec.length;

        if ( len >= 3 ) {
            var rtileid = parseInt(autoexec[1].trim());
            var rsubid = autoexec[2].trim();
            var rvalue = len > 3 ? autoexec[3].trim() : "on" ;
            var delay = len > 4 ? autoexec[4] : false;
            if ( delay ) {
                delay = parseInt( delay.trim() );
                if ( isNaN(delay) || delay<=0 ) {
                    delay = false;
                } else {
                    delay = delay * 1000;
                }
            }
            var rswattr = len > 5 ? autoexec[5].trim() : "";
            var ridx = false;

            // check for a stop all other timer rules command
            // this is done by entering 0=__delay as a rule segment
            if ( rsubid==="__delay" ) {
                resetRuleTimers();
            } else {
                // find the tile index and proceed with activating the rule
                ridx = array_search(rtileid, GLB.options["index"]);
            }
            if ( DEBUG11 ) {
                console.log( (ddbg()), "RULE debug: exec step #", i, " rtileid: ", rtileid, " rsubid: ", rsubid, " rvalue: ", rvalue, " rswattr: ", rswattr, " ridx: ", ridx, " delay: ", delay);
            }

            if ( ridx && allthings[ridx] ) {
                var idxitems = ridx.split("|");
                var rswtype = idxitems[0];
                var rswid = idxitems[1];
                var hubid = allthings[ridx]["hubnum"];
                var hub = findHub(hubid);

                // handle requests for parameters of the trigger tile ($) or destination tile (@)
                // disable hub calls for this type of rule
                var trigtype = rvalue.substr(0,1);
                if ( trigtype==="$" || trigtype==="@" ) {
                    var trigsubid = rvalue.substr(1);
                    if ( trigtype==="$" && array_key_exists(trigsubid, pvalue) ) {
                        rvalue = pvalue[trigsubid];
                    } else if ( trigtype==="@" && array_key_exists(trigsubid, allthings[ridx]["value"]) ) {
                        rvalue = allthings[ridx]["value"][trigsubid];
                    }
                }

                // fix up ISY hubs
                if ( rswtype==="isy" && array_key_exists(rsubid, allthings[ridx]["value"]) ) {
                    var curvalue = allthings[ridx]["value"][rsubid];
                    if ( rvalue==="on" || (rvalue==="toggle" && curvalue==="DOF") ) { rvalue = "DON"; }
                    if ( rvalue==="off" || (rvalue==="toggle" && curvalue==="DON") ) { rvalue = "DOF"; }
                } 


                // set the destination to the value which would typically be overwritten by hub call
                // if the destination is a link force the link to a TEXT type to neuter other types
                var linkinfo = false;
                if ( array_key_exists(rsubid, allthings[ridx]["value"]) ) {
                    allthings[ridx]["value"][rsubid] = rvalue;
                    var companion = "user_"+rsubid;
                    if ( array_key_exists(companion, allthings[ridx]["value"]) ) {
                        allthings[ridx]["value"][companion] = "::TEXT::" + rvalue;
                        linkinfo = [rswid, rswtype, rsubid, rsubid, "TEXT"];
                        pushClient(rswid, rswtype, rsubid, allthings[ridx]["value"])
                    }

                // if destination subid isn't found make a user TEXT field
                } else {
                    addCustom("default", rswid, rswtype, "TEXT", rvalue, rsubid);
                    linkinfo = [rswid, rswtype, rsubid, rsubid, "TEXT"];
                    if ( DEBUG11 ) {
                        console.log( (ddbg()), " new custom field: ", rsubid, " created in tile: ", allthings[ridx].value);
                    }
                    // restart all clients to show the newly created field
                    // this only happens the first time the rule is triggered
                    // pushClient("reload", "/");
                }

                // handle level sliders and the funky attr values for other tiles
                if ( linkinfo==="" ) {
                    if ( rsubid==="level" ) {
                        rswattr= "level";
                    } else if ( rsubid==="colorTemperature" ) {
                        rswattr= "colorTemperature";
                    } else if ( rsubid==="onlevel" ) {
                        rswattr= "onlevel";
                    } else if ( rsubid==="volume" ) {
                        rswattr= "volume";
                    } else if ( rsubid==="switch" || swtype==="isy" || (swval!=="on" && swval!=="off") ) {
                        rswattr="";
                    } else if ( !rswattr && rswtype!=="isy" ) {
                        var swval = rvalue==="on" ? "off" : "on";
                        rswattr= swtype + " p_" + rtileid + " " + swval;
                    }
                }

                if ( hub ) {
                    var thandle;

                    // look for this rule being in a timer and if found, clear timer
                    if ( array_key_exists(itemhash, GLB.ruledelay) ) {
                        thandle = GLB.ruledelay[itemhash];
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), "clearing timer handle: ", itemhash);
                        }
                        try {
                            clearTimeout(thandle);
                            delete GLB.ruledelay[itemhash];
                        } catch(e) { }
                    }

                    // make the hub call now or delayed
                    // if delayed we store the handle in our rules array so that
                    // should the same rule come along again we cancel this one first
                    // this way delay light on and off will stay on if trigger keeps happening
                    if ( delay && delay > 0 ) {
                        thandle = setTimeout( function() {
                            try {
                                callHub(hub, rswid, rswtype, rvalue, rswattr, rsubid, linkinfo, false, true);
                            } catch (e) {
                                console.log( (ddbg()), "error calling hub from rule: ", rswid, rswtype, rvalue, rswattr, rsubid, " error: ", e);
                            }
                        }, delay);
                        GLB.ruledelay[itemhash] = thandle;
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), "setting timer handle: ", itemhash);
                        }
                    } else {
                        try {
                            callHub(hub, rswid, rswtype, rvalue, rswattr, rsubid, linkinfo, false, true);
                        } catch (e) {
                            console.log( (ddbg()), "error calling hub from rule: ", rswid, rswtype, rvalue, rswattr, rsubid, " error: ", e);
                        }
                    }
                }
            }


        }
    }

}

function pushClient(swid, swtype, subid, body, linkinfo, popup) {
    // send the new results to all clients
    var entry = {};
    if ( typeof subid === "undefined" ) { subid= ""; }
    entry["id"] = swid;
    entry["type"] = swtype;
    entry["clientcount"] = clients.length;
    entry["trigger"] = subid;
    if ( typeof popup!=="undefined" && popup ) {
        entry["popup"] = "popup";
    } else {
        entry["popup"] = "";
    }
    var pvalue;

    if ( typeof body === "undefined" || body==="" || !body ) {
        pvalue = {};
    } else if ( typeof body === "string") {
        try {
            pvalue = JSON.parse(body);
        } catch(e) {
            console.log( (ddbg()), "warning - unrecognized non-JSON string in hub push update: ", body);
            return;
        }
    } else if ( typeof body === "object") {
        pvalue = clone(body);
    } else {
        console.log( (ddbg()), "warning - unrecognized body in hub push update: ", body);
        return;
    }

    // if ( pvalue["password"] ) { delete pvalue["password"]; }
        
    // save the result to push to all clients
    entry["value"] = pvalue;
    if ( DEBUG14 ) {
        console.log( (ddbg()), "pushClient: ", UTIL.inspect(entry, false, null, false), " linkinfo: ", linkinfo);
    }

    // update the main array with changed push values
    if ( swid!=="reload" && swid!=="popup" && swtype ) {
        var idx = swtype + "|" + swid;
        var lidx = "";
        var lsubid = "";
        var lreal = "";
        if ( linkinfo && is_array(linkinfo) ) {
            lidx = linkinfo[1] + "|" + linkinfo[0];
            lsubid = linkinfo[2];
            lreal = linkinfo[3];
            // entry["LINK"] = linkinfo;
        }

        if ( array_key_exists(idx, allthings) ) {
            for (var thekey in pvalue) {
                allthings[idx]["value"][thekey] = pvalue[thekey];

                // update the link that triggered if this was a link
                // we do something similar on the client side to change
                // all linked things that match this
                if ( lidx && lsubid && lreal && lreal===thekey && allthings[lidx] ) {
                    allthings[lidx]["value"][lsubid] = pvalue[thekey];
                }
            }
        }
    }

    // send mqtt message
    // eventually we can use MQTT on clients to receive this message instead of sendUTF below
    if ( udclient && udclient.connected ) {
        udclient.publish("housepanel/pushClient", JSON.stringify(entry));
    }

    // do a push to each client
    // if this is a screen reload request only the triggering screen should reload
    for (var i=0; i < clients.length; i++) {
        entry["client"] = i;
        if ( DEBUG17 ) {
            console.log( (ddbg()), "Pushing client #", i, " id: ", entry.id);
        }
        clients[i].sendUTF(JSON.stringify(entry));
    }

}

function callHub(hub, swid, swtype, swval, swattr, subid, linkinfo, popup, inrule) {
    if ( !hub ) { return false; }
    
    var access_token = hub["hubAccess"];
    var endpt = hub["hubEndpt"];
    var result = "success";
    var idx = swtype + "|" + swid;
    if ( DEBUG7 ) {
        console.log( (ddbg()), "callHub: access: ", access_token, " endpt: ", endpt, " swval: ", swval, " subid: ", subid, " attr: ", swattr);
    }
    
    var isyresp = {};
    if ( linkinfo && is_array(linkinfo) && linkinfo.length>3 && linkinfo[4]==="TEXT" ) {
        try {
            result = allthings[idx].value;
        } catch(e) {
            result = "error - custom TEXT field not found for: " + idx;
            console.log( (ddbg()), result, " error: ", e);
            return result;
        }

        if (result) {
            pushClient(swid, swtype, subid, result, linkinfo, popup);
            processRules(swid, swtype, subid, result, "callHub");
        }

    // this function calls the Groovy hub api
    } else if ( hub["hubType"]==="SmartThings" || hub["hubType"]==="Hubitat" ) {
        var host = endpt + "/doaction";
        var header = {"Authorization": "Bearer " + access_token};
        var nvpreq = {"swid": swid,  
                    "swattr": swattr,
                    "swvalue": swval, 
                    "swtype": swtype};
        if ( subid && subid!=="none" ) { nvpreq["subid"] = subid; }
        curl_call(host, header, nvpreq, false, "POST", getHubResponse);

    // implement the functions supported as described in the postman collection
    // but only the things that start with an underscore invoke the api call
    } else if ( hub["hubType"]==="Ford" ) {

        if ( DEBUG18 ){
            console.log( (ddbg()), " Calling Ford API doaction in callHub. subid: ", subid, " swid: ", swid, " swval: ", swval, " swtype: ", swtype, " hub: ", hub,  );
        }

        // all API calls have the same header structure
        var host = endpt + "/" + swid; 
        var header = {"Authorization": "Bearer " + access_token,
            "Content-Type": "application/json",
            "api-version": "2019-01-01",
            "Application-Id": hub["hubId"] 
        };

        switch(subid) {

            case "_odometer":
            case "_details":
                curl_call(host, header, false, false, "GET", getHubResponse);
                break;

            case "_unlock":
            case "_lock":
            case "_status":
            case "_startEngine":
            case "_stopEngine":
            case "_wake":
            case "_location":
                host = host + "/" + subid.substr(1);
                curl_call(host, header, false, false, "POST", getHubResponse);
                break;

            default:
                result = "error - unknown field in a ford hub call: " + subid;
                console.log( (ddbg()), result);
                return result;
        }

    // this module below is the equivalent of the ST and HE groovy app
    // for ISY where the logic for handling actions is provided
    // compare this to the doAction function in HousePanel.groovy
    } else if ( hub["hubType"]==="ISY" ) {
        var buff = Buffer.from(access_token);
        var base64 = buff.toString('base64');
        var isyheader = {"Authorization": "Basic " + base64};
        var cmd;
        // var idx = "isy|" + swid;
        var hint = allthings[idx].hint;

        // fix up isy devices
        if ( swval==="on" ) { swval = "DON"; }
        else if ( swval==="off" ) { swval = "DOF"; }

        // set default subid so api calls will work
        if ( !subid ) {
            subid = "switch";
        }

        switch(subid) {

            case "level":
                // for now semd both level commands since either could be expected
                // one is for Insteon other is for Polyglot nodes
                // later we will flag this in the item
                var cmd1 = "/nodes/" + swid + "/cmd/SETLVL/" + swval;
                curl_call(endpt + cmd1, isyheader, false, false, "GET", getNodeResponse);

                // convert percentage to 0 - 256 range for Insteon
                var irange = Math.floor(parseInt(swval) * 255 / 100);
                var cmd2 = "/nodes/" + swid + "/cmd/DON/" + irange;
                isyresp["switch"] = "DON";
                curl_call(endpt + cmd2, isyheader, false, false, "GET", getNodeResponse);

                // comment this code to preserve the prior dimmer setting; 
                // otherwise the onlevel is set to current level
                // the default behavior for Insteon lights would be to comment this
                // setTimeout(function() {
                //     var cmd3 = "/nodes/" + swid + "/cmd/OL/" + irange;
                //     isyresp["onlevel"] = swval;
                //     curl_call(endpt + cmd3, isyheader, false, false, "GET", getNodeResponse);
                // }, 200 );
                break;

            case "onlevel":

                // convert percentage to 0 - 256 range for Insteon
                var irange = Math.floor(parseInt(swval) * 255 / 100);
                var cmd3 = "/nodes/" + swid + "/cmd/OL/" + irange;
                isyresp["onlevel"] = swval;
                curl_call(endpt + cmd3, isyheader, false, false, "GET", getNodeResponse);

                // pause before we turn on the light to prevent slider from toggling
                setTimeout(function() {
                    var cmd2 = "/nodes/" + swid + "/cmd/DON/" + irange;
                    isyresp["switch"] = "DON";
                    curl_call(endpt + cmd2, isyheader, false, false, "GET", getNodeResponse);
                }, 200 );
                break;
    
            case "switch":
            case "DOF":
            case "DON":
                // handle toggle command - note that the GUI will never produce a toggle swval command
                // but the RULE logic can and so can users when using api calls
                if ( swval==="toggle" ) {
                        var currentval = allthings["isy|"+swid]["value"][subid];
                        swval = currentval==="DON" ? "DOF" : "DON";
                }
                cmd = "/nodes/" + swid + "/cmd/" + swval;
                isyresp[subid] = swval;
                curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                break;

            case "heatingSetpoint-up":
            case "coolingSetpoint-up":
            case "heatingSetpoint-dn":
            case "coolingSetpoint-dn":
                // do some fancy footwork here to get either CLISPH or CLISPC so we can use same code
                var hcletter = subid.substr(0,1).toUpperCase();
                var clicommand = "CLISP" + hcletter;

                // determine if up or down
                var isup = subid.substr(-2);

                // get existing value and then proceed with adjust if it is a number
                var newval = extractTemp(swval);
                if ( !isNaN(newval) ) { 
                    newval = (isup === "up") ? newval + 1 : newval - 1;
                    cmd = "/nodes/" + swid + "/cmd/" + clicommand + "/" + newval.toString();
                    isyresp[subid] = newval;
                    curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                } else {
                    result = "error - ISY thermostat set point cannot be interpreted.  value: " + swval;
                    console.log( (ddbg()), result);
                }
                break;
    
            default:

                // handle arrows for variable changes
                if ( hint==="ISY variable" && subid.startsWith("int_") ) {
                    // get the real subid that the arrows are pointing toward
                    var intvar = parseInt(swval);
                    if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
                        var varnum = subid.substr(4, subid.length-7);
                        var realsubid = subid.substr(0, subid.length-3);
                        intvar = subid.endsWith("-up") ? intvar + 1 : intvar - 1;
                    } else {
                        varnum = subid.substr(4);
                        realsubid = subid;
                    }
                    cmd = "/vars/set/1/" + varnum + "/" + intvar.toString();
                    isyresp[realsubid] = intvar.toString();
                    curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);

                } else if ( hint==="ISY variable" && subid.startsWith("state_") ) {
                    // get the real subid that the arrows are pointing toward
                    var intvar = parseFloat(swval);
                    var prec = 0;
                    if ( !isNaN(intvar) ) {
                        if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
                            var varnum = subid.substr(6, subid.length-9);
                            var realsubid = subid.substr(0, subid.length-3);
                            intvar = subid.endsWith("-up") ? intvar + 1 : intvar - 1;
                        } else {
                            varnum = subid.substr(6);
                            realsubid = subid;

                            // deal with precision values
                            prec = parseInt(allthings[idx].value["prec_state_"+varnum]);
                            if ( ! isNaN(prec) && prec > 0 ) {
                                var pow10 = Math.pow(10,prec);
                                intvar = Math.round(intvar*pow10) / pow10;
                            }
                        }
                        cmd = "/vars/set/2/" + varnum + "/" + intvar.toString();
                        isyresp[realsubid] = intvar.toString();
                        curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                    }

                // run commands
                } else if ( hint==="ISY program" ) {
                    // var progcommands = "run|runThen|runElse|stop|enable|disable";
                    // var progarr = progcommands.split("|");
                    var progarr = ["run","runThen","runElse","stop","enable","disable"];
                    var progid = allthings[idx].id;
                    progid = progid.substr(5);
                    if ( progarr.includes(subid) ) {
                        cmd = "/programs/" + progid + "/" + subid;
                        curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                        result = "success";
                    } else {
                        result = allthings[idx].value;
                    } 
                } else {
                    result = "error - command: " + subid + " not yet supported for ISY hubs";
                    console.log( (ddbg()), result);
                }

        }
    }
    return result;
    
    // --------------------- end of callHub commands ------------------------------
    // supporting sub-functions are below
    // ----------------------------------------------------------------------------
    
    function extractTemp(val) {
        var newval;
        if ( swval.substr(-1)==="F" || swval.substr(-1)==="C" ) {
            newval = parseInt(swval.substr(0, swval.length-2));
        } else {
            newval = parseInt(swval);
        }
        return newval;
    }

    function getHubResponse(err, res, body) {
        var pvalue;
        // var idx = swtype + "|" + swid;
        if ( DEBUG18 ) {
            console.log( (ddbg()), hub.hubType, " hub: ", hub.hubName, " trigger: ", subid, " rule: ", inrule, " call returned: ", body);
        }
        if ( err ) {
            console.log( (ddbg()), "error calling ST or HE hub: ", err);
        } else {
            // update all clients - this is actually not needed if your server is accessible to websocket updates
            // It is left here because my dev machine sometimes doesn't get websocket pushes
            // you can comment this if your server gets pushes reliable
            // leaving it here causes no harm other than processing the visual update twice
            if ( body ) {

                // convert from json string
                try {
                    pvalue = JSON.parse(body);
                } catch (ep) {
                    pvalue = null;
                    console.log( (ddbg()), "failed converting hub call return to JSON object. body: ", body);
                }

                if (pvalue) {

                    // deal with audio tiles
                    if ( swtype==="audio" ) {
                        pvalue = translateAudio(pvalue);
                    } else if ( swtype==="music" ) {
                        pvalue = translateMusic(pvalue);
                    } else if ( swtype==="weather" && is_object(pvalue.forecast) ) {
                        var origname = allthings[idx].name;
                        pvalue = translateWeather(origname, pvalue);
                    } else if ( swtype==="ford" && (subid==="_odometer" || subid==="_details") && pvalue.vehicle && pvalue.status && pvalue.status==="SUCCESS" ) {
                        var vehicle = clone(pvalue["vehicle"]);
                        pvalue = {};
                        for (var key in vehicle) {
                            if ( is_object(vehicle[key]) ) {
                                for ( var newid in vehicle[key] ) {
                                    if ( is_object(vehicle[key][newid]) ) {
                                        for ( var subsubid in vehicle[key][newid] ) {
                                            pvalue[newid+"_"+subsubid] = vehicle[key][newid][subsubid];
                                        }
                                    } else {
                                        pvalue[newid] = vehicle[key][newid];
                                        if ( pvalue[newid] === null || pvalue[newid]==="null" ) {
                                            pvalue[newid] = "None";
                                        }
                                    }
                                }
            
                            } else {

                                // change color subid since that is reserved for color light bulbs
                                if ( key==="color" ) {
                                    pvalue["vehiclecolor"] = vehicle[key];
                                } else if ( key!=="vehicleId" ) {
                                    pvalue[key] = vehicle[key];
                                }
                            }
                        }
                    }

                    // push new values to all clients and execute rules
                    pushClient(swid, swtype, subid, pvalue, linkinfo, popup);
                    processRules(swid, swtype, subid, pvalue, "callHub");
                }
            }
        }

        // handle case when we click on a linked item make the change on the linked item
        // var linkinfo = [swid, swtype, subid, $realsubid, "LINK"];
        // linked items will be update by the hub callback handler
        if ( linkinfo && is_array(linkinfo) && linkinfo.length>4 && linkinfo[4]==="LINK" ) {
            var realsubid = linkinfo[3];
            var linksubid = linkinfo[2];
            var targetobj = {};
            targetobj[linksubid] = pvalue[realsubid];
            if ( DEBUG18 ) {
                console.log( (ddbg()), "Linkinfo: ", linkinfo, " targetobj: ", targetobj);
            }
            pushClient(linkinfo[0], linkinfo[1], linksubid, targetobj);
            processRules(linkinfo[0], linkinfo[1], linksubid, targetobj, "callHub");
        }


    }

    // I don't think I need to use this because the ISY pushes a webSocket that I use
    // to do the same thing in the processIsyMessage function
    async function getNodeResponse(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "error calling ISY node: ", err);
        } else {

            var rres;
            await xml2js(body, async function(xmlerr, result) {
                rres = result.RestResponse.status[0];
                if ( DEBUGisy ) {
                    console.log( (ddbg()), hub.hubType, " hub: ", hub.hubName, " trigger: ", subid, " rule: ", inrule, " isyrep: ", isyresp, " call returned: ", UTIL.inspect(result, false, null, false));
                }
            });

            // update all clients - this is actually not needed if your server is accessible to websocket updates
            // because ISY will push state updates via a websocket
            // and that will process a similar pushClient but for only those things that change
            // It is left here because my dev machine sometimes doesn't get websocket pushes
            // you can comment this if your server gets pushes reliable
            // leaving it here causes no harm other than processing the visual update twice
            // ....
            // push client and process rules if response failed which means it won't give a websocket reply
            // this typically would happen for buttons which don't do anything from the panel
            // so calling updating client and doing rules here allows the button state to change

            // var rres = result.RestResponse;
            // if ( !inrule && rres && rres.status && rres.status.toString()!=="200" ) {
            if ( !inrule && rres && rres.toString()!=="200" ) {
                pushClient(swid, swtype, subid, isyresp, linkinfo, popup);
                processRules(swid, "isy", subid, isyresp, "callHub");
            }
        }
    }

}

function queryHub(hub, swid, swtype, popup) {
    var access_token = hub["hubAccess"];
    var endpt = hub["hubEndpt"];
    var idx = swtype + "|" + swid;
    if ( hub["hubType"]==="SmartThings" || hub["hubType"]==="Hubitat" ) {
        var host = endpt + "/doquery";
        var header = {"Authorization": "Bearer " + access_token};
        var nvpreq = {"swid": swid, "swtype": swtype};
        curl_call(host, header, nvpreq, false, "POST", getQueryResponse);
    } else if ( hub["hubType"]==="ISY" ) {
        var buff = Buffer.from(access_token);
        var base64 = buff.toString('base64');
        var header = {"Authorization": "Basic " + base64};
        var cmd = "/nodes/" + swid;
        curl_call(endpt + cmd, header, false, false, "GET", getNodeQueryResponse);
    }
    
    async function getQueryResponse(err, res, pvalue) {
        if ( err ) {
            console.log( (ddbg()), "error requesting hub node query: ", err);
        } else {
            if ( DEBUG5 ) {
                console.log( (ddbg()), "doQuery: ", swid, " type: ", swtype, " value: ", pvalue);
            }
            if ( pvalue ) {
                // deal with presence tiles
                if ( swtype==="presence" && pvalue["presence"]==="not present" ) {
                    pvalue["presence"] = "absent";
                }
                // deal with audio tiles
                if ( swtype==="audio" ) {
                    pvalue = translateAudio(pvalue);
                } else if ( swtype==="music" ) {
                    pvalue = translateMusic(pvalue);
                } else if ( swtype==="weather" ) {
                    var origname = allthings[idx].name;
                    pvalue = translateWeather(origname, pvalue);
                }

                pushClient(swid, swtype, "none", pvalue, null, popup);

                // force processing of rules for weather and clocks on a query
                if ( swtype==="weather" || swtype==="clock" ) {
                    processRules(swid, swtype, "timer", pvalue, "doQuery");
                }
            }
        }
    }

    function getNodeQueryResponse(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "error requesting ISY node query: ", err);
        } else {
            xml2js(body, async function(xmlerr, result) {
                try {
                    if ( result ) {
                        var nodeid = result.nodeInfo.node[0]["address"];
                        nodeid = fixISYid(nodeid);
                        if ( nodeid ) {
                            var idx = "isy|" + nodeid;
                            var value = clone(allthings[idx]["value"]);
                            var props = result.nodeInfo.properties[0].property;
                            setIsyFields(nodeid, value, props); // result.nodeInfo);
                        } else {
                            throw "Something went wrong reading node from ISY in getNodeQueryResponse";
                        }
                    }
                } catch(e) { 
                    console.log( (ddbg()), "error in getNodeQueryResponse: ", e);
                }
            });
        }

    }
}

function translateAudio(pvalue, specialkey, audiomap) {
    // map of audio fields used in multiple places
    // but if false is given then we just translate pvalue
    if ( typeof specialkey === "undefined" ) {
        specialkey = "audioTrackData";
    }

    if ( typeof audiomap !== "object" ) {
        audiomap = {"title": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                    "albumArtUrl": "trackImage", "mediaSource": "mediaSource"};
    }

    try {
        var audiodata;
        if ( pvalue ) {
            if ( specialkey==="" || specialkey===false ) {
                if ( typeof pvalue==="string" ) {
                    audiodata = JSON.parse(pvalue);
                    pvalue = {};
                } else if ( typeof pvalue==="object" ) {
                    audiodata = clone(pvalue);
                    pvalue = {};
                } else {
                    throw "Unknown format in translateAudio";
                }
            } else if ( array_key_exists(specialkey, pvalue) && typeof pvalue[specialkey]==="string" ) {
                audiodata = JSON.parse(pvalue[specialkey]);
                // delete pvalue[specialkey];
            } else if ( array_key_exists(specialkey, pvalue) && typeof pvalue[specialkey]==="object" ) {
                audiodata = clone(pvalue[specialkey]);
                pvalue[specialkey] = JSON.stringify(pvalue[specialkey]);
            } else {
                throw "Unknown format in translateAudio";
            }

            for  (var jtkey in audiodata) {
                if ( array_key_exists(jtkey, audiomap) ) {
                    var atkey = audiomap[jtkey];
                    if ( atkey ) {
                        pvalue[atkey] = audiodata[jtkey] || "";
                    }
                } else {
                    pvalue[jtkey] = audiodata[jtkey];
                }
            }

            // get image from the string if http is buried
            // this usually works for music tiles but not always
            // not needed for audio tiles since http will be first
            if ( array_key_exists("trackImage", pvalue) ) {
                var jtval = pvalue["trackImage"];
                if  ( typeof jtval==="string" && jtval.indexOf("http")>0 ) {
                    var j1 = jtval.indexOf(">http") + 1;
                    var j2 = jtval.indexOf("<", j1+1);
                    if ( j1===-1 || j2===-1) {
                        jtval = "";
                    } else {
                        jtval = jtval.substring(j1, j2);
                        jtval = jtval.replace(/\\/g,"");
                    }
                    pvalue["trackImage"] = jtval;
                }
            }
        }
    } catch(jerr) {
        console.log( (ddbg()), jerr);
    }
    return pvalue;
}

function translateMusic(pvalue) {
    var audiomap = {"name": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                    "status": "status", "trackMetaData": "trackImage", "trackImage":"trackImage", "metaData":"",
                    "trackNumber":"", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
                    "audioSource": "mediaSource", "trackData": "trackData"};
    var musicmap = {"artist": "currentArtist", "album": "currentAlbum",
                    "status": "status", "trackMetaData": "", "metaData":"",
                    "trackNumber":"trackNumber", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
                    "audioSource": "mediaSource"};

    var nvalue = {};
    for  (var jtkey in pvalue) {
        if ( array_key_exists(jtkey, musicmap) ) {
            var atkey = musicmap[jtkey];
            if ( atkey ) {
                nvalue[atkey] = pvalue[jtkey] || "";
            }
        } else {
            nvalue[jtkey] = pvalue[jtkey];
        }
    }

    // if there is a trackData field then use that to overwrite stuff
    if ( array_key_exists("trackData", nvalue) ) {
        nvalue = translateAudio(nvalue, "trackData", audiomap);
    }
    return nvalue;
}

function findHub(hubid) {
    var hub = false;
    for (var h in  GLB.options.config["hubs"]) {
        var ahub =  GLB.options.config["hubs"][h];
        if ( ahub["hubId"]===hubid ) { hub = ahub; }
    }
    return hub;
}

// update the hubs array with a new hub value of a certain ID
// if not found the hub is added
function updateHubs(newhub, oldid) {
    var num = 0;
    oldid = oldid.toString();
    var found = false;

    // every hub that matches gets updated
    // should only be one but just in case
    GLB.options.config.hubs.forEach(function(hub) {
        if ( hub["hubId"].toString() === oldid ) {
            GLB.options.config.hubs[num] = clone(newhub);
            found = true;
        }
        num++;
    });

    // if not found then add new hub
    if ( !found ) {
        GLB.options.config.hubs.push(newhub);
    }
    return found;
}

function testclick(clktype, clkid) {
    const infoclicks = [
        "temperature", "name", "contact", "presence", "motion", "battery",
        "date","time", "weekday", "tzone", "heatingSetpoint", "coolingSetpoint",
        "camera", "statusMessage", "numberOfButtons", 
        "time", "weekday", "date"
    ];
    var test = false;
    if ( clkid.startsWith("_") || clkid.endsWith("-up") || clkid.endsWith("-dn") ) {
        test = false;
    } else if ( clktype==="weather" || clkid.startsWith("int_") || clkid.startsWith("state_") || clkid.startsWith("event_") || in_array(clkid, infoclicks) ) {
        test = true;
    }
    return test;
}

function doAction(hubid, swid, swtype, swval, swattr, subid, tileid, command, linkval, protocol) {

    var response = "error";
    var idx;

    // reset rules
    resetRules();

    if ( DEBUG7 ) {
        console.log( (ddbg()), "doaction: swid: ", swid, " swtype:", swtype, " swval: ", swval, 
                               " swattr: ", swattr, " subid: ", subid, " tileid: ", tileid, " command: ", command, " linkval: ", linkval);
    }

    if ( (swid==="none" || swtype==="none" || !swtype || !swid || swid==="0") && tileid )  {
        idx = array_search(tileid, GLB.options["index"]);
        if ( idx===false || idx.indexOf("|")===-1 ) {
            return "error - invalid tile: " + tileid;
        }
        var items = idx.split("|");
        swtype = items[0];
        swid = items[1];
    } else {
        idx = swtype + "|" + swid;
    }
    var specialtiles = getSpecials();

    // handle clocks to return current time always
    if ( (typeof command==="undefined" || !command) && swid==="clockdigital") {
        response = getClock("clockdigital");
        response = getCustomTile(response, "clock", "clockdigital");
    } else if ( (typeof command==="undefined" || !command) && swid==="clockanalog" ) {
        response = getClock("clockanalog");
        response = getCustomTile(response, "clock", "clockanalog");
    
    // handle types that just return the current status
    // added check to skip clicks on things that are commands flagged in ST and HE with an underscore
    // } else if   (   (typeof command==="undefined" || !command ) && ( !subid.startsWith("_") ) &&
    //                 (  
    //                    swtype==="contact" || swtype==="presence" || swtype==="motion" || swtype==="weather" || 
    //                    subid==="temperature" || subid==="name" || subid==="contact" || 
    //                    subid==="presence" || subid==="motion" || subid.startsWith("event_")
    //                 )
    //             ) {
    } else if ( (typeof command==="undefined" || !command ) && testclick(swtype, subid) ) {
        response = allthings[idx]["value"];
        
    // send name, width, height to returnFile routine to get the html tag
    } else if ( (typeof command==="undefined" || command==="") && array_key_exists(swtype, specialtiles) ) {
        var thingvalue = allthings[idx]["value"];
        thingvalue = returnFile(thingvalue, swtype);
        // thingvalue = getCustomTile(thingvalue, swtype, swid);
        response = thingvalue;
    } else {

        // get the hub to call
        if ( hubid==="auto" ) {
            hubid = allthings[idx]["hubnum"];
        }
        var hub = findHub(hubid);

        // first check if this subid has a companion link
        // use command to signal this - HUB is usual case which makes hub call
        // this has been generalized to always read the data from the options array
        // unless command is not set in which case this is a normal HUB call
        var goodcommands = ["POST", "PUT", "GET", "URL", "TEXT", "LINK", "RULE"];
        if ( command && goodcommands.includes(command) ) {
            linkval = "";
            var links = GLB.options[ "user_" + swid];
            links.forEach(function(linkset) {
                if ( linkval==="" && linkset[0]===command && subid.startsWith(linkset[2]) ){
                    linkval = linkset[1];
                }  
            });
        } else {
            linkval = "";
            command = "HUB";
        }
    
        switch(command) {

            case "POST":
            case "GET":
            case "PUT":
                // var posturl = decodeURIComponent(linkval);
                var posturl = linkval;
                var isparm = posturl.indexOf("?");
                var parmstr = "";
                var jsonobj = {};
                if ( isparm!=="-1" ) {
                    parmstr = posturl.substr(isparm+1).split("&");
                    posturl = posturl.substr(0, isparm);
                    if ( posturl.substr(-1)==="/" ) {
                        posturl = posturl.substr(0, posturl.length-1);
                    }
                    parmstr.forEach(function(key) {
                        key = key.split("=");
                        jsonobj[key[0]] = key[1];
                    })
                }
                if ( DEBUG7 ) {
                    console.log( (ddbg()), command + " call: ", posturl, " parms: ", jsonobj);
                }
                curl_call(posturl, null, jsonobj, false, command, urlCallback);
                response = "success";
                break;

            // converted this over to getting the custom text out of the options
            // this allows me to avoid lugging around the custom text in the sibling helper
            // this mirrors the code in RULES below
            case "TEXT":
                response = allthings[idx]["value"];
                response[subid] = linkval;
                break;

            // link commands are the only ones that use the linkval setting
            // all others get the user input values from the options file
            case "LINK":
                var lidx = array_search(linkval, GLB.options["index"]);
                // console.log("lidx = ", lidx, " linkval= ", linkval);

                if ( lidx ) {
                    var $linked_hubnum = allthings[lidx]["hubnum"];
                    var $linked_swtype = allthings[lidx]["type"];
                    var $linked_swid = allthings[lidx]["id"];
                    var $linked_val = allthings[lidx]["value"];

                    // make hub call if requested and if the linked tile has one
                    var $lhub = findHub($linked_hubnum);

                    // if the link subid is in the linked tile then it is the real subid
                    // otherwise it is a duplicate with info after subid so lets find the real one
                    // this is what allows us to have the same subid referenced to different tiles
                    if ( subid.endsWith("-up") || subid.endsWith("-dn") || array_key_exists(subid, $linked_val) ) {
                        var $realsubid = subid;
                    } else {
                        $realsubid = false;
                        for (var key in $linked_val) {
                            if ( subid.indexOf(key) === 0 ) {   //  strpos($subid, key) === 0 ) {
                                $realsubid = key;
                                break;
                            }
                        }
                    }
                    
                    if ( DEBUG7 ) {
                        console.log( (ddbg()),"linked_hubnum: ", $linked_hubnum, " linked_type: ", $linked_swtype,
                                               " linked_id: ", $linked_swid, " linked_val: ", $linked_val, 
                                               " realsubid: ", $realsubid );
                    }
                    // make the action call on the linked thing
                    // the hub callback now handles the linked resposnes properly
                    // if link is to something static, show it
                    if ( $realsubid ) {
                        if ( testclick($linked_swtype, $realsubid) ) {
                            response = $linked_val;
                        } else {
                            var linkinfo = [swid, swtype, subid, $realsubid, "LINK"];
                            try {
                                response = callHub($lhub, $linked_swid, $linked_swtype, swval, swattr, $realsubid, linkinfo, false, false);
                            } catch (e) {
                                console.log( (ddbg()), "error calling hub: ", $lhub.hubId, $lhub.hubName, $linked_swid, $linked_swtype, swval, swattr, $realsubid, linkinfo, " error: ", e);
                            }
                        }
                    }
                }
                break;

            case "RULE":

                // rewrite the rule to use data in options array
                // no need to pass it around in the tile as with old php version
                if ( ENABLERULES ) {
                    // get the execution statements and call them all here
                    const regsplit = /[,;]/;
                    if ( linkval ) {
                        var testcommands = linkval.split(regsplit);
                        var istart = 0;
                        if ( testcommands[0].trim().startsWith("if") ) {
                            istart = 1;
                        }
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), "RULE execution: commands: ", testcommands );
                        }
                        execRules("callHub", linkval, swtype, istart, testcommands, allthings[idx]["value"]);
                    }
                    response = "success";
                } else {
                    response = "error - Rules are not enabled in this version of HousePanel";
                }
                break;

            case "HUB":
                try {
                    response = callHub(hub, swid, swtype, swval, swattr, subid, false, false, false);
                    if ( DEBUG8 ) {
                        console.log( (ddbg()), "calling hub: ", hub.hubId, hub.hubName, swid, swtype, swval, swattr, subid, " response: ", response);
                    }
                } catch (e) {
                    console.log( (ddbg()), "error calling hub: ", hub.hubId, hub.hubName, swid, swtype, swval, swattr, subid, " error: ", e);
                }
                break;

            default:
                response = "error";
        }


    }

    async function urlCallback(err, res, body) {
        var webresponse = {};
        if ( err ) {
            webresposne[command] = command + ": error";
        } else if ( typeof body === "object" ) {
            // add any fields returned as an object
            // for ( var bkey in body ) {
            //     if ( typeof body[bkey]==="string" ) {
            //         webresponse[bkey] = body[bkey]
            //     } else if ( typeof body[bkey]==="object" ) {
            //         webresponse[bkey] = JSON.stringify(body[bkey]);
            //     }
            // }
            console.log( (ddbg()), "URL callback returned: ", UTIL.inspect(body, false, null, false));
            // pushClient(swid, swtype, subid, webresponse);
        } else if ( typeof body === "string" && body!=="" && body!=="success" ) {
            // webresponse[command] = body;
            // pushClient(swid, swtype, subid, webresponse);
            console.log( (ddbg()), "URL callback returned: ", body);
        }
        if ( DEBUG13 ) {
            console.log( (ddbg()), "URL callback response: ", UTIL.inspect(body, false, null, false) );
        }
    }

    // while (!finished) { }
    return response;
}

async function doQuery(hubid, swid, swtype, tileid, protocol) {
    var result;
    if ( swid==="all" || swid==="fast" || swid==="slow" ) {
        if ( swid==="all" ) {
            var rtype = "normal";
        } else {
            rtype = swid;
        }
        result = {};
        var res;
        for (var idx in (allthings || {}) ) {
            res = allthings[idx];
            var refresh = "normal";
            if ( array_key_exists("refresh", res) ) {
                refresh = res["refresh"];
            }
            if ( array_key_exists("refresh", res.value) ) {
                refresh = res.value["refresh"];
            }
            if ( refresh===rtype ) {
                var item = GLB.options["index"][idx];
                result[item] = res;
            }
        }

        for ( var i=0; i < result.length; i++ ) {
            res = result[i];

            // deal with audio tiles
            if ( res.type==="audio" ) {
                res.value = translateAudio(res.value);
            } else if ( res.type==="music" ) {
                res.value = translateMusic(res.value);
            // deal with accuweather
            } else if ( res.type==="weather" ) {
                res.value = translateWeather(res.name, res.value);
            }

            res.value = getCustomTile(res.value, res.type, res.id);
            res.value = returnFile(res.value, res.type);
            result[i] = res;
            
        }
    } else {
        if ( (swid==="none" || swtype==="none" || !swtype || !swid || swid==="0") && tileid )  {
            idx = array_search(tileid, GLB.options["index"]);
            if ( idx===false || idx.indexOf("|")===-1 ) {
                return "error - invalid tile: " + tileid;
            }
            var items = idx.split("|");
            swtype = items[0];
            swid = items[1];
        } else {
            idx = swtype + "|" + swid;
        }

        if ( allthings && array_key_exists(idx, allthings) && array_key_exists("value", allthings[idx]) ) {
            // return current value and send updated value after hub call to clients and popup window
            if ( hubid==="auto" ) {
                hubid = allthings[idx]["hubnum"];
            }
            var hub = findHub(hubid);
            result = allthings[idx]["value"];
            if ( result["password"] ) {
                delete result["password"];
            }

            // only query the hub which pushes update to GUI if we queried using POST
            // which normally is only from GUI but user could use POST so beware
            // that if you use the HP api in POST mode that all clients will be updated
            // whenever you query a tile. To avoid this use the GET method to query a tile
            // note that actions will always update clients to keep them in sync
            if ( protocol==="POST" ) {
                queryHub(hub, swid, swtype, false);
            }
        } else {
            result = "error - invalid api request. hubid= " + hubid + " id= " + swid + " type= " + swtype + " tile= " + tileid;
        }
    }
    return result;
}

function setOrder(uname, swid, swtype, swval, swattr) {
    var updated = false;
    var result = "error";
    var options = clone(GLB.options);

    // if the options file doesn't exist here something went wrong so skip
    if (options) {
        // now update either the page or the tiles based on type
        switch(swtype) {
            case "rooms":
                options["rooms"] = {};
                for (var roomname in swval) {
                    var roomid = parseInt(swval[roomname]);
                    options["rooms"][roomname] = roomid;
                }
                updated = true;
                result = options["rooms"];
                break;

            // we no longer use name from the gui since we have the real name here
            // reordering doesn't work properly for duplicate tiles on a page
            // if detected then all duplicates will be set to relative and home positions
            case "things":
                if (array_key_exists(swattr, options["rooms"])) {
                    var oldarr = GLB.options["things"][swattr];
                    options["things"][swattr] = [];
                    var zindex = 1;
                    swval.forEach(function(val) {
                        var oldtile = tile_search(val, oldarr);
                        var newthing = [oldtile[0], oldtile[1], oldtile[2], zindex, oldtile[4]];
                        zindex++;
                        if ( newthing ) {
                            options["things"][swattr].push(newthing);
                        }
                    });
                    updated = true;
                    result = options["things"][swattr];
                }
                break;

            case "reset":
                if (array_key_exists(swattr, options["rooms"])) {
                    var oldarr = clone(options["things"][swattr]);
                    options["things"][swattr] = [];
                    oldarr.forEach(function(valarr) {
                        var val = parseInt(valarr[0]);
                        var vname = valarr[4];
                        var newthing = [val,0,0,1,vname];
                        options["things"][swattr].push(newthing);
                    });
                    updated = true;
                    result = options["things"][swattr];
                }
                break;
                
            default:
                result = "error";
                break;
        }

        if (updated) {
            writeRoomThings(options, uname);
        }
    }
    
    return result;
}

function setPosition(uname, swid, swtype, panel, swattr, tile) {
    
    var updated = false;
    var options = GLB.options;
    tile = parseInt(tile);
    
    // first find which index this tile is
    // note that this code will not work if a tile is duplicated on a page
    // such duplication is not allowed by the UI anyway but in the
    // event that a user edits hmoptions.cfg to have duplicates
    // the code will get confused here and in other places
    // $i = array_search($tile, options["things"][$panel]);
    var moved = false;
    var idx;
    var oldname = "";

    var thetile = tile_search(tile, options.things[panel]);
    if ( thetile ) {

        // change the room index to an array of tile, top, left
        // now we also save zindex and a tile custom name
        var top = parseInt(swattr["top"]);
        var left = parseInt(swattr["left"]);
        var zindex = parseInt(swattr["z-index"]);

        // change the tile directly in the master array
        thetile[1] = top;
        thetile[2] = left;
        thetile[3] = zindex;

        // var newtile = [thetile[0], top, left, zindex, thetile[4]];
        // options["things"][panel][moved] = newtile;
        writeRoomThings(options, uname);
        if ( DEBUG6 ) {
            console.log( (ddbg()), "new tile position for tile: ", tile," to: (", top, ",", left, ",", zindex, ")");
        }
    } else {
        thetile = "error";
        console.log( (ddbg()), "error - position for tile: ", tile," was not found to change");
    }
    return thetile;
    
}

function addThing(uname, bid, thingtype, panel, pos, flag) {
    
    var idx = thingtype + "|" + bid;
    var options = GLB.options;
    var tilenum = parseInt(options["index"][idx]);
    var thesensor = allthings[idx];
    // new additions come in with the default name now
    // var tilename = thesensor["name"];
    var cnt;
    
    // get max thing number for new tiles dragged here
    if ( flag==="auto" ) {
        cnt = 0;
        for (var room in options.things) {
            var len = options.things[room].length;
            cnt = cnt + len;
        }
        cnt++;
    } else {
        cnt = parseInt(flag);
        if ( isNaN(cnt) ) {
            cnt = 0;
        }
    }
    // var lastid = options["things"][panel].length - 1;
    // var lastitem = options["things"][panel][lastid];

    var ypos = pos.top;        // parseInt(lastitem[1]);
    var xpos = pos.left;       // parseInt(lastitem[2]);
    var zindex = pos["z-index"];   //  parseInt(lastitem[3]);

    // protect against invalid positions
    if ( xpos<0 || xpos > 1200 || ypos<0 || ypos>1200 ) {
        xpos = 0;
        ypos = 0;
    }

    // protect against out of bounds zindex values
    if ( zindex < 0 || zindex > 499 ) {
        zindex = 1;
    }

    // add it to our system in the requested room/panel
    options["things"][panel].push([tilenum, ypos, xpos, zindex, ""]);
    
    // make a new tile based on the dragged information
    var thing = makeThing(cnt, tilenum, thesensor, panel, ypos, xpos, zindex, "", "");
    writeRoomThings(options, uname);
    
    return thing;
}

function delThing(uname, bid, thingtype, panel, tile) {
    
    var idx = thingtype + "|" + bid;
    var retcode = "error";
    
    if ( panel && array_key_exists(panel, GLB.options["things"]) &&
                   array_key_exists(idx, GLB.options["index"]) ) {

        var optionthings = clone(GLB.options["things"][panel]);

        // as a double check the options file tile should match
        // if it doesn't then something weird triggered drag drop
        // note - if there are duplicates the first one will be deleted
        var tilenum = parseInt(GLB.options["index"][idx]);
        if ( parseInt(tile) === tilenum ) {

            // remove tile from this room
            for (var key in optionthings) {
                var thing = optionthings[key];
                if ( (is_array(thing) && parseInt(thing[0]) === tilenum) ||
                     (!is_array(thing) && parseInt(thing) === tilenum) ) {

                    delete optionthings[key];
                    retcode = "success";
                    break;
                }
            }   

            if ( retcode === "success" ) {
                // options.things[panel] = array_values(options["things"][panel]);
                GLB.options["things"][panel] = [];
                optionthings.forEach(function(orderthing) {
                    GLB.options["things"][panel].push(orderthing);
                })
                writeRoomThings(GLB.options, uname);
            } else {
                console.log( (ddbg()), "error - could not safely delete tile: ", tile, " with id: ", bid, " from room: ", panel);
            }
        }
    }
    return retcode;
}

function delPage(uname, pagename) {
    
    var options = GLB.options;
    var retcode;

    // check if room exists - ignore number matches
    if ( utils.count(options["rooms"]) <= 1 ) {
        retcode = "error - page= " + pagename + " is the only page remaining. Cannot delete the last page.";
    } else if ( array_key_exists(pagename, options["rooms"]) &&
                array_key_exists(pagename, options["things"]) ) {
        delete options["rooms"][pagename];
        delete options["things"][pagename];
        writeRoomThings(options, uname);
        retcode = "success";
    } else {
        retcode = "error - cannot find page= " + pagename + " to delete.";
    }
    return retcode;
}

function addPage(uname) {
    var pagenum = 0;
    var options = GLB.options;
    
    // get the largest room number
    for ( var roomname in options["rooms"] ) {
        var roomnum = parseInt(options["rooms"][roomname]);
        pagenum = roomnum > pagenum ? roomnum : pagenum;
    }
    pagenum++;

    // get new room default name in sequential order
    var newname = "Newroom1";
    var num = 1;
    while ( array_key_exists(newname, options["rooms"]) ) {
        $num++;
        $newname = "Newroom" + num.toString();
    }
    options["rooms"][newname] = pagenum;
    
    // put a digital clock in all new rooms so they are not empty
    var clockid = options["index"]["clock|clockdigital"];
    var clock = [clockid, 0, 0, 1, ""];
    options["things"][newname] = [clock];
    writeRoomThings(options, uname);
    return newname;
}

function getInfoPage(uname, returnURL, pathname) {

    var configoptions = GLB.options["config"];
    var hubs = configoptions["hubs"];
    var specialtiles = getSpecials();
    
    var $tc = "";
    var skin = getSkin(uname);
    $tc += utils.getHeader(skin, true);
    $tc += "<h3>" + utils.APPNAME + " Information Display</h3>";

    if ( DONATE===true ) {
        $tc += '<br /><h4>Donations appreciated for HousePanel support and continued improvement, but not required to proceed.</h4> \
            <br /><div><form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
            <input type="hidden" name="cmd" value="_s-xclick"> \
            <input type="hidden" name="hosted_button_id" value="XS7MHW7XPYJA4"> \
            <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
            <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
            </form></div>';
    }

    $tc += "<form>";
    $tc += utils.hidden("returnURL", returnURL);
    $tc += utils.hidden("pathname", pathname);
    $tc += utils.hidden("pagename", "info");
    $tc += "</form>";
    $tc += "<div class=\"infopage\">";
    $tc += "<div class='bold'>Site url = " + returnURL + "</div>";
    $tc += "<div id='infoname' class='bold'>Current user = " + uname + "</div>";
    $tc += "<div class='bold'>Skin folder = " + skin + "</div>";
    $tc += "<div class='bold'>" + hubs.length + " Hubs active</div>";
    $tc += "<hr />";
    
    var num = 0;
    hubs.forEach (function(hub) {
        // putStats(hub);
        var hubType = hub["hubType"];
        var hubName = hub["hubName"];
        var hubHost = hub["hubHost"];
        var hubId = hub["hubId"];
        var clientId = hub["clientId"];
        var clientSecret = hub["clientSecret"];
        var access_token = hub["hubAccess"];
        var endpt = hub["hubEndpt"];
        $tc += "<div class='bold'>Hub #" + num + "</div>";
        $tc += "<div class='bold'>Hub Name = " + hubName + "</div>";
        $tc += "<div>Type = " + hubType + "</div>";
        $tc += "<div>Hub ID = " + hubId + "</div>";
        $tc += "<div>Hub Host URL = " + hubHost + "</div>";
        $tc += "<div>Client ID = " + clientId + "</div>";
        $tc += "<div>Client Secret = " + clientSecret + "</div>";
        $tc += "<div>AccessToken = " + access_token + "</div>";
        $tc += "<div>Endpoint = " + endpt + "</div>";
        if ( (num + 1) < hubs.length ) {
            $tc += "<hr />";
        }
        num++;
    });

    $tc += "</div>";

    if ( clients.length > 0 ) {
        var str = "<p>Currently connected to " + clients.length + " clients.</p>";
        str = str + "<br><hr><br>";
        for (var i=0; i < clients.length; i++) {
            str = str + "Client #" + i + " host= " + clients[i].socket.remoteAddress + " <br>";
        }
        str = str + "<br><hr><br>";
        $tc +=  str;
    }
    

    $tc += "<button id=\"listhistory\" class=\"showhistory\">Show Dev Log</button>";
    $tc += "<div id=\"showhistory\" class=\"infopage hidden\">";
    $tc += "<pre>" + utils.DEV + "</pre>";
    $tc += "</div>";
    
    $tc += "<br><button id=\"listthing\" class=\"showhistory\">Authorized Things</button>";
    $tc += "<div id=\"showthing\" class=\"infopage\">";
    $tc += "<table class=\"showid\">";
    $tc += "<thead><tr><th class=\"thingname\">Name" + 
        "</th><th class=\"infotype\">Nickname" + 
        "</th><th class=\"thingarr\">Value Array" + 
        "</th><th class=\"infoid\">Thing id" +
        "</th><th class=\"infotype\">Type" + 
        "</th><th class=\"hubid\">Hub" +
        "</th><th class=\"infonum\">Tile Num</th></tr></thead>";

    var sensors = sortedSensors("hubnum", "name", "type");
    for (var i in sensors) {
        var thing = sensors[i];
        var idx = thing.type + "|" + thing.id;
        var value = "";
        if ( is_object(thing["value"]) ) {
            for (var key in thing["value"] ) {
                var val = thing["value"][key];
                value += " ";
                if ( key==="name" ) {
                    continue;  // value = value;
                } else if ( array_key_exists(key, specialtiles) ) {
                    value += key + "= <strong>embedded " + key + "</strong><br/>";
                } else if ( thing["type"]==="custom" && typeof val==="object" ) { 
                    value += "Custom Array..."; 
                } else if ( typeof val==="object" ) {
                    value += key + "=" + JSON.stringify(val);
                // } else if ( typeof val === "string" && val.length > 128 ) {
                //     val = val.substr(0,124) + " ...";
                //     value += key + "=" + val + "<br/>";
                } else if ( typeof val==="string" ) {
                    value += key + "=" + val;
                } else {
                    value += key + "=" + val.toString();
                }
            }
        } else {
            value = thing["value"];
            // if ( value.length > 128 ) {
            //     value = value.substr(0,124) + " ...";
            // }
        }
        // limit size of the field shown
        
        var hubnum = thing["hubnum"];
        if ( hubnum === -1 || hubnum === "-1" ) {
            var hubstr = "None<br><span class=\"typeopt\"> (" + hubnum + ": None)</span>";
        } else {
            var hub = findHub(hubnum);
            var hubType = hub["hubType"];
            var hubName = hub["hubName"];
            var hubstr = hubName + "<br><span class=\"typeopt\"> (" + hubnum + ": " + hubType + ")</span>";
        }
        
        $tc += "<tr><td class=\"thingname\">" + thing["name"] +
            "</td><td class=\"thingname\">" + thing.value.name +
            "</td><td class=\"thingarr\">" + value +
            "</td><td class=\"infoid\">" + thing["id"] +
            "</td><td class=\"infotype\">" + thing["type"] +
            "</td><td class=\"hubid\">" + hubstr + 
            "</td><td class=\"infonum\">" + GLB.options["index"][idx] + "</td></tr>";
    }
    $tc += "</table></div>";

    // show all the customizations
    var customList = [];
    for ( var key in GLB.options ) {
        if ( key.startsWith("user_") ) {

            var ruleid = key.substr(5);
            var lines = GLB.options[key];

            if ( lines && is_array(lines) ) {
        
                // allow user to skip wrapping single entry in an array
                // the GUI will never do this but a user might in a manual edit
                if ( !is_array(lines[0]) ) {
                    lines = [lines];
                }

                lines.forEach(function(line) {
                    var customType = line[0];
                    var customValue = line[1];
                    var customSubid = line[2];

                    if ( customType==="LINK" ) {
                        var linktile = array_search(customValue, GLB.options.index);
                        if ( linktile && allthings[linktile] ) {
                            customValue = "Link tile #" + customValue + " index= " + linktile + " name= " + allthings[linktile]["name"];
                        } else {
                            customValue = "Broken link #" + customValue;
                        }
                    }
                    customList.push( [customType, ruleid, customValue, customSubid] );
                });
            }
        }
    }
            
    // sort the list by type
    if ( customList.length ) {
        customList = customList.sort( (a,b) => {
            if ( a[0]===b[0] ) {
                var x = 0;
            } else if ( a[0] < b[0] ) {
                x = -1;
            } else {
                x = 1;
            }
            return x;
        });

        // display the customizations
        $tc += "<br><button id=\"listcustom\" class=\"showhistory\">Show Customizations</button>";
        $tc += "<div id=\"showcustom\" class=\"infopage hidden\">";
        $tc += "<table class=\"showid\">";
        $tc += "<thead><tr><th class=\"infotype\">Type" + 
            "</th><th class=\"thingname\">Rule ID" + 
            "</th><th class=\"thingarr\">Value" +
            "</th><th class=\"infonum\">Field</th></tr></thead>";

        customList.forEach(function(thing) {
            $tc += "<tr><td class=\"infotype\">" + thing[0] +
                "</td><td class=\"thingname\">" + thing[1] +
                "</td><td class=\"thingarr\">" + thing[2] +
                "</td><td class=\"infonum\">" + thing[3] + "</td></tr>";
        });
        $tc += "</table></div>";
    }

    $tc += "<button class=\"infobutton fixbottom\">Return to HousePanel</button>";

    $tc += utils.getFooter();
    return $tc;
}

function hubFilters(hubpick, ncols) {
    var options = GLB.options;
    var useroptions = options["useroptions"];
    var configoptions = options["config"];
    var $hubs = configoptions["hubs"];
    var thingtypes = getTypes();

    var $tc = "";
    $tc+= "<form id=\"filteroptions\" class=\"options\" name=\"filteroptions\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";
    
    // if more than one hub then let user pick which one to show
    var hubpick = "all";
    if ( configoptions["hubpick"] ) {
        hubpick = configoptions["hubpick"];
    }
    if ( utils.count($hubs) > 1 ) {
        $tc+= "<div class=\"filteroption\">Hub Filters: ";
        var $hid = "hopt_all";
        var checked = (hubpick==="all") ? " checked='1'" : "";
        $tc+= "<div class='radiobutton'><input id='" + $hid + "' type='radio' name='huboptpick' value='all'"  + checked + "><label for='" + $hid + "'>All Hubs</label></div>";
        $hid = "hopt_none";
        checked = (hubpick==="-1") ? " checked='1'" : "";
        $tc+= "<div class='radiobutton'><input id='" + $hid + "' type='radio' name='huboptpick' value='-1'" + checked + "><label for='" + $hid + "'>No Hub</label></div>";
        var $hubcount = 0;
        $hubs.forEach(function($hub) {
            var $hubName = $hub["hubName"];
            var $hubType = $hub["hubType"];
            var $hubId = $hub["hubId"];
            $hid = "hopt_" + $hubId;
            checked = (hubpick===$hubId) ? " checked='1'" : "";
            $tc+= "<div class='radiobutton'><input id='" + $hid + "' type='radio' name='huboptpick' value='" + $hubId + "'" + checked + "><label for='" + $hid + "'>" + $hubName + " (" + $hubType + ")</label></div>";
            $hubcount++;
        });
        $tc+= "</div>";
    }

    // buttons for all or no filters
    $tc+= "<div id=\"thingfilters\" class='filteroption'>Select Things to Display:</div>";
    $tc+= "<div id=\"filterup\" class=\"filteroption\">";
    $tc+= "<div id=\"allid\" class=\"smallbutton\">All</div>";
    $tc+= "<div id=\"noneid\" class=\"smallbutton\">None</div>";

    $tc+= "<table class=\"useroptions\"><tr>";
    var $i= 0;
    for (var $iopt in thingtypes) {
        var $opt = thingtypes[$iopt];
        $i++;
        if ( in_array($opt, useroptions ) ) {
            $tc+= "<td><input id=\"cbx_" + $i + "\" type=\"checkbox\" name=\"useroptions[]\" value=\"" + $opt + "\" checked=\"1\">";
        } else {
            $tc+= "<td><input id=\"cbx_" + $i + "\" type=\"checkbox\" name=\"useroptions[]\" value=\"" + $opt + "\">";
        }
        $tc+= "<label for=\"cbx_" + $i + "\" class=\"optname\">" + $opt + "</label></td>";
        if ( $i % ncols == 0 && $i < utils.count(thingtypes) ) {
            $tc+= "</tr><tr>";
        }
    }
    $tc+= "</tr></table>";
    $tc+= "</div>";
    $tc+= "</form>";

    return $tc;
}

// this little gem will sort by up to three things
function sortedSensors(one, two, three) {

    if ( !one ) { one = "name"; }

    // put sensors in an array so we can sort them
    var sensors = Object.values(allthings).sort( function(obja, objb) {
        function test(a, b) {
            if ( typeof a === "object" || typeof b === "object" ) { return 0; }
            else if ( a===b ) { return 0 }
            else if ( a > b ) { return 1; }
            else { return -1; }
        }
        var check = test(obja[one], objb[one]);
        if ( check===0 && two ) {
            check = test(obja[two], objb[two]);
            if ( check===0 && three ) {
                check = test(obja[three], objb[three]);
            }
        }
        return check;
    });
    return sensors;
}

function getCatalog(hubpick) {

    if ( !hubpick ) {
        hubpick = "all";
    }
    var $tc = "";
    var useroptions = GLB.options["useroptions"];
    $tc += "<div id=\"catalog\">";
    $tc += hubFilters(hubpick, 3);

    $tc += "<div class='scrollvtable fshort'><table class=\"catalog\">";

    // put sensors in an array so we can sort them
    var sensors = sortedSensors("hubnum", "name");

    var i= 0;
    // for(var idx in allthings) {
    //     var thesensor = allthings[idx];
    for ( var idx in sensors ) {
        var thesensor = sensors[idx];
        var bid = thesensor["id"];
        var thingtype = thesensor["type"];
        var thingname = thesensor["name"];
        var hubId = thesensor["hubnum"].toString();
        var cat = "cat-" + i.toString();
        // if ( hubId === "-1" ) {
        //     hubId = "none";
        // }

        if ( thingname.length > 23 ) {
            var thingpr = thingname.substr(0,23) + " ...";
        } else {
            thingpr = thingname;
        }
        
        if (in_array(thingtype, useroptions) && (hubpick===hubId || hubpick==="all")) {
            var hide = "";
        } else {
            hide = "hidden ";
        }

        $tc += "<div id=\"" + cat + "\" bid=\"" + bid + "\" type=\"" + thingtype + "\" hubid=\"" + hubId + "\" ";
        $tc += "panel=\"catalog\" class=\"thing " + hide + "catalog-thing\">"; 
        $tc += "<div class=\"thingname\">" +  thingpr + "</div>";
        $tc += "<div class=\"thingtype\">" + thingtype + "</div>";
        $tc +="</div>";
        i++;
    }
    $tc += "</table></div>";
    $tc += "</div>";
    return $tc;
}

// this used to create input blocks for auth page
// it was modified for use now on the options page
function tsk($timezone, $skin, $uname, $port, $webSocketServerPort, $fast_timer, $slow_timer, polisyip) {

    var $tc= "";
    $tc += "<form id=\"userpw\" class=\"options\" name=\"userpw\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

    $tc += "<div class=\"filteroption\">";
    $tc += "<div class='inp'><label class=\"startupinp\">Skin Folder: </label>";
    $tc += "<input id=\"skinid\" class=\"startupinp\" name=\"skin\" width=\"80\" type=\"text\" value=\"" + $skin + "\"/></div>"; 
    
    $tc += "<div><label class=\"startupinp\">Timezone: </label>";
    $tc += "<input id=\"newtimezone\" class=\"startupinp\" name=\"timezone\" width=\"80\" type=\"text\" value=\"" + $timezone + "\"/></div>"; 

    $tc += "<div><label class=\"startupinp\">Main App Port: </label>";
    $tc += "<input id=\"newport\" class=\"startupinp\" name=\"port\" width=\"20\" type=\"text\" value=\"" + $port + "\"/></div>"; 

    $tc += "<div><label class=\"startupinp\">WebSocket Port: </label>";
    $tc += "<input id=\"newsocketport\" class=\"startupinp\" name=\"webSocketServerPort\" width=\"20\" type=\"text\" value=\"" + $webSocketServerPort + "\"/></div>"; 

    $tc += "<div><label class=\"startupinp\">Fast Timer: </label>";
    $tc += "<input id=\"newfast_timer\" class=\"startupinp\" name=\"fast_timer\" width=\"20\" type=\"text\" value=\"" + $fast_timer + "\"/></div>"; 

    $tc += "<div><label class=\"startupinp\">Slow Timer: </label>";
    $tc += "<input id=\"newslow_timer\" class=\"startupinp\" name=\"slow_timer\" width=\"20\" type=\"text\" value=\"" + $slow_timer + "\"/></div>"; 

    $tc += "<div><label class=\"startupinp\">Polisy box IP: </label>";
    $tc += "<input id=\"newpolisyip\" class=\"startupinp\" name=\"polisyip\" width=\"30\" type=\"text\" value=\"" + polisyip + "\"/></div>"; 

    $tc += "<div><label for=\"uname\" class=\"startupinp\">Username: </label>";
    $tc += "<input id=\"uname\" class=\"startupinp\" name=\"uname\" width=\"20\" type=\"text\" value=\"" + $uname + "\"/></div>"; 

    $tc += "<div><label for=\"pword\" class=\"startupinp\">Set New Password: </label>";
    $tc += "<input id=\"pword\" class=\"startupinp\" name=\"pword\" width=\"80\" type=\"password\" value=\"\"/></div>"; 
    
    $tc += "<div><label></label><span class='indent typeopt'>(blank to keep prior)</span></div>";
    $tc += "<div></div><br />";
    $tc += "</div>";
    $tc += "</form>";

    return $tc;
    
}

function getSocketUrl(hostname) {
    var webSocketUrl = "";
    var configoptions = GLB.options.config;
    if ( configoptions.webSocketServerPort && !isNaN(parseInt(configoptions.webSocketServerPort)) ) {
        var icolon = hostname.indexOf(":");
        if ( icolon >= 0 ) {
            webSocketUrl = "ws://" + hostname.substr(0, icolon);
        } else {
            webSocketUrl = "ws://" + hostname;
        }
        webSocketUrl = webSocketUrl + ":" + configoptions.webSocketServerPort;
    }
    return webSocketUrl;
}

function getOptionsPage(uname, hostname, pathname) {
    var specialtiles = getSpecials();
    var options = GLB.options;
    var roomoptions = options["rooms"];
    var thingoptions = options["things"];
    var indexoptions = options["index"];
    var useroptions = options["useroptions"];
    var configoptions = options["config"];
    var skin = getSkin(uname);
    var $port = configoptions["port"];
    var $webSocketServerPort = configoptions["webSocketServerPort"];
    var $fast_timer = configoptions["fast_timer"];
    var $slow_timer = configoptions["slow_timer"];
    var $kioskoptions = configoptions["kiosk"];
    var $blackout = configoptions["blackout"];
    var $ruleoptions = configoptions["rules"];
    var $timezone = configoptions["timezone"];
    var polisyip = configoptions["polisyip"] || "localhost";

    var hubpick = "all";
    if ( configoptions["hubpick"] ) {
        hubpick = configoptions["hubpick"];
    }
    
    var $tc = "";
    $tc += utils.getHeader(skin);
    $tc += "<h3>" + utils.APPNAME + " Options</h3>";
    $tc += "<div class=\"formbutton formauto\"><a href=\"" + GLB.returnURL + "\">Cancel and Return to HousePanel</a></div>";
    
    var webSocketUrl = getSocketUrl(hostname);
    $tc += utils.hidden("pagename", "options");
    $tc += utils.hidden("returnURL", GLB.returnURL);
    $tc += utils.hidden("pathname", pathname);
    $tc += utils.hidden("webSocketUrl", webSocketUrl);

    $tc += hubFilters(hubpick, 7);
    $tc += tsk($timezone, skin, uname, $port, $webSocketServerPort, $fast_timer, $slow_timer, polisyip);

    $tc += "<form id=\"optionspage\" class=\"options\" name=\"options\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

    $tc += "<div class=\"filteroption\">";
    $tc += "Specify number of special tiles: <br/>";
    for (var $stype in specialtiles) {
        var sid = specialtiles[$stype];
        var $customcnt = getCustomCount($stype, sid[3]);
        var $stypeid = "cnt_" + $stype;
        $tc+= "<br /><label for=\"$stypeid\" class=\"kioskoption\"> " + $stype +  " tiles: </label>";
        $tc+= "<input class=\"specialtile\" id=\"" + $stypeid + "\" name=\"" + $stypeid + "\" width=\"10\" type=\"number\"  min='0' max='99' step='1' value=\"" + $customcnt + "\" />";
    }
    $tc+= "</div>";

    $tc += "<div class=\"filteroption\">";
    $tc += "Other options: <br/>";
    $tc += "<br/><label for=\"kioskid\" class=\"kioskoption\">Kiosk Mode: </label>";    
    var $kstr = ($kioskoptions===true || $kioskoptions==="true" || $kioskoptions==="1" || $kioskoptions==="yes") ? "checked" : "";
    $tc+= "<input id=\"kioskid\" width=\"24\" type=\"checkbox\" name=\"kiosk\"  value=\"" + $kioskoptions + "\" " + $kstr + "/>";
    $tc += "<br/><label for=\"clrblackid\" class=\"kioskoption\">Blackout on Night Mode: </label>";    
    $kstr = ($blackout===true || $blackout==="true") ? "checked" : "";
    $tc+= "<input id=\"clrblackid\" width=\"24\" type=\"checkbox\" name=\"clrblackid\"  value=\"" + $blackout + "\" " + $kstr + "/>";
    if ( ENABLERULES ) {
        $tc += "<br/><label for=\"ruleid\" class=\"kioskoption\">Enable Rules? </label>";
        var $rstr = ($ruleoptions===true || $ruleoptions==="true" || $ruleoptions==="1" || $ruleoptions==="yes") ? "checked" : "";
        $tc += "<input id=\"ruleid\" width=\"24\" type=\"checkbox\" name=\"rules\"  value=\"" + $ruleoptions + "\" " + $rstr + "/>";
    }
    $tc += "</div>";

    var fcastcity = configoptions["fcastcity"] || "ann-arbor";
    var fcastregion = configoptions["fcastregion"] || "";
    var fcastcode = configoptions["fcastcode"] || "";   //  ann-arbor code is 42d28n83d74
    var $accucity = configoptions["accucity"];
    var $accuregion = configoptions["accuregion"];
    var $accucode = configoptions["accucode"];      // ann-arbor-mi code is 329380
    $tc += "<div class=\"filteroption\">";
    $tc += "<table>";
    $tc += "<tr>";
    $tc += "<td><label for=\"fcastcityid\" class=\"kioskoption\">Forecast City: </label></td>";
    $tc += "<td><input id=\"fcastcityid\" width=\"180\" type=\"text\" name=\"fcastcity\"  value=\"" + fcastcity + "\" /></td>";
    $tc += "<td><label for=\"fcastregionid\" class=\"kioskoption\">Forcast Region: </label></td>";
    $tc += "<td><input id=\"fcastregionid\" width=\"40\" type=\"text\" name=\"fcastregion\"  value=\"" + fcastregion + "\"/></td>";
    $tc += "<td><label for=\"fcastcodeid\" class=\"kioskoption\">Forecast Code: </label></td>";
    $tc += "<td><input id=\"fcastcodeid\" width=\"20\" type=\"text\" name=\"fcastcode\"  value=\"" + fcastcode + "\"/>";
    $tc += "<span class='typeopt'>(for Frame1 tiles)</span></td>";
    $tc += "</tr><tr>";
    $tc += "<td><label for=\"accucityid\" class=\"kioskoption\">Accuweather City: </label></td>";
    $tc += "<td><input id=\"accucityid\" width=\"180\" type=\"text\" name=\"accucity\"  value=\"" + $accucity + "\" /></td>";
    $tc += "<td><label for=\"accuregionid\" class=\"kioskoption\">Accuweather Region: </label></td>";
    $tc += "<td><input id=\"accuregionid\" width=\"6\" type=\"text\" name=\"accuregion\"  value=\"" + $accuregion + "\"/></td>";
    $tc += "<td><label for=\"accucodeid\" class=\"kioskoption\">AccuWeather Code: </label></td>";
    $tc += "<td><input id=\"accucodeid\" width=\"40\" type=\"text\" name=\"accucode\"  value=\"" + $accucode + "\"/>";
    $tc += "<span class='typeopt'>(for Frame2 tiles)</span></td>";
    $tc += "</tr></table></div>";
    
    // now display the table of all the rooms and thing options
    $tc += "<table class=\"headoptions\"><thead>";
    $tc += "<tr><th class=\"thingname\">Thing Name (type)</th>";
    $tc += "<th class=\"hubname\">Hub</th>";
   
    // list the room names in the proper order
    for (var roomname in roomoptions) {
        $tc+= "<th class=\"roomname\">" + roomname;
        $tc+= "</th>";
    }
    $tc += "</tr></thead>";
    $tc += "</table>";
    $tc += "<div class='scrollvtable'>";
    $tc += "<table class=\"roomoptions\">";
    $tc += "<tbody>";

    // sort the things
    // uasort(allthings, "mysortfunc");
    
    // now print our options matrix
    // $rowcnt = 0;
    var $evenodd = true;
    var $hub;

    // use a sorted list
    var sensors = sortedSensors("hubnum", "name", "type");

    // for (var $thingid in allthings) {
    //     var $thesensor = allthings[$thingid];
    for ( var i in sensors) {
        var $thesensor = sensors[i];
        var idx = $thesensor.type + "|" + $thesensor.id;
        // if this sensor type and id mix is gone, skip this row
        
        var $thingname = $thesensor["name"];
        var nickname = $thesensor.value["name"] || "";
        var $thetype = $thesensor["type"];
        var $hubnum = $thesensor["hubnum"];
        if ( $hubnum === -1 || $hubnum==="-1" ) {
            $hub = null;
            var $hubType = "None";
            var $hubStr = "None";
            var $hubId = "-1";
        } else {
            $hub = findHub($hubnum);
            $hubType = $hub["hubType"];
            $hubStr = $hub["hubName"];
            $hubId = $hub["hubId"];
        }

        // get the tile index number
        try {
            var $thingindex = indexoptions[idx].toString();
        } catch (e) {
            console.log( (ddbg()), " idx: ", idx, " is invalid. error: ", e);
            return;
        }
        
        // write the table row
        if ( array_key_exists($thetype, specialtiles) ) {
            var $special = " special";
        } else {
            $special = "";
        }
        var $odd = $evenodd = false;
        if (in_array($thetype, useroptions)) {
            $evenodd = !$evenodd;
            $evenodd ? $odd = " odd" : $odd = "";
            $tc+= "<tr type=\"" + $thetype + "\" tile=\"" + $thingindex + "\" class=\"showrow" + $odd + $special + "\">";
        } else {
            $tc+= "<tr type=\"" + $thetype + "\" tile=\"" + $thingindex + "\" class=\"hiderow" + $special + "\">";
        }
        
        $tc+= "<td class=\"thingname\">";
        $tc+= $thingname + "<span class=\"typeopt\"> (" + $thetype + ")";
        if ( nickname && nickname!==$thingname ) { 
            $tc+= "<br>custom: " + nickname; 
        } else {
            $tc+= "<br>custom: none"; 
        }
        $tc+= " (tile #" + $thingindex + ")";
        $tc+= "</span>";
        $tc+= "</td>";
        
        $tc+= "<td class=\"hubname\" hubId=\"" + $hubId + "\">";
        $tc+= $hubStr + " (" + $hubType + ")";
        $tc+= "</td>";

        // loop through all the rooms
        // this addresses room bug
        for ( var roomname in roomoptions ) {
            
            // get the name of this room for this column
            if ( array_key_exists(roomname, thingoptions) ) {
                var $things = thingoptions[roomname];
                                
                // now check for whether this thing is in this room
                $tc+= "<td>";
                
                var $ischecked = false;
                var $idx;
                for (var i in $things) {
                    var $arr = $things[i];
                    if ( is_array($arr) ) {
                        $idx = $arr[0].toString();
                    } else {
                        $idx = $arr.toString();
                    }
                    if ( $idx === $thingindex ) {
                        $ischecked = true;
                        break;
                    }
                }
                
                if ( $ischecked ) {
                    $tc+= "<input type=\"checkbox\" name=\"" + roomname + "[]\" value=\"" + $thingindex + "\" checked=\"1\" >";
                } else {
                    $tc+= "<input type=\"checkbox\" name=\"" + roomname + "[]\" value=\"" + $thingindex + "\" >";
                }
                $tc+= "</td>";
            }
        }
        $tc+= "</tr>";
    }

    $tc+= "</tbody></table>";
    $tc+= "</div>";
    $tc+= "<div id='optionspanel' class=\"processoptions\">";
    $tc +='<div id="optSave" class="formbutton">Save</div>';
    $tc +='<div id="optReset" class="formbutton">Reset</div>';
    $tc +='<div id="optCancel" class="formbutton">Cancel</div><br>';
    $tc+= "</div>";
    $tc+= "</form>";
    
    // $tc+= "</div>";

    $tc += utils.getFooter();

    return $tc;
}

// renders the main page
function mainPage(uname, hostname, pathname) {
    var $tc = "";
    var thingoptions = GLB.options["things"];
    var roomoptions = GLB.options["rooms"];
    var config = GLB.options.config;
    var skin = getSkin(uname);
    var kioskmode = GLB.options.config["kiosk"];
    if ( kioskmode===true || kioskmode==="true" || kioskmode===1 || kioskmode==="yes" ) {
        kioskmode = true;
    } else {
        kioskmode = false;
    }
    console.log(  "\n****************************************************************",
                  "\n", (ddbg()), "Serving page at: ", GLB.returnURL,
                  "\n****************************************************************");

    $tc += utils.getHeader(skin);

    if ( GLB.newuser ) {
        $tc += "<div class=\"greeting\"><strong>Welcome New User!</strong><br/ >You should first try to link your smart home hubs, using the Hub Auth button below. ";
        $tc += "You can also explore all that HousePanel has to offer by experimenting with the two clock tiles placed in each room. ";
        $tc += "When you are done, they can be removed in Edit mode or from the Options page. Click on the ? mark in the upper right corner. ";
        $tc += "to access the full online manual. Have fun!</div>";
        GLB.newuser = false;
    }

    if ( DEBUG4 ) {
        console.log( (ddbg()), GLB.options);
    }
    // make sure our active skin has a custom file
    if ( !fs.existsSync(skin + "/customtiles.css") ) {
        writeCustomCss(skin, "");
    }
    
    // new wrapper around catalog and things but excluding buttons
    $tc += '<div id="dragregion">';
    $tc += '<div id="tabs"><ul id="roomtabs">';

    // show all room with whatever index number assuming unique
    for (var room in roomoptions) {
        var k = roomoptions[room];
        if ( thingoptions[room] ) {
            var adder= "<li roomnum=\"" + k + "\" class=\"tab-" + room + "\"><a href=\"#" + room + "-tab\">" + room + "</a></li>";
            $tc += adder;
        }
    }
    $tc += '</ul>';

    // changed this to show rooms in the order listed
    // this is so we just need to rewrite order to make sortable permanent
    var cnt = 0;
    for (var room in roomoptions) {
        var k = roomoptions[room];
        if ( thingoptions[room] ) {
            var things = thingoptions[room];
            var pgobj = getNewPage(cnt, room, k, things);
            $tc += pgobj.tc;
            cnt = pgobj.cnt;
        }
    }

    // include doc button and username that is logged in
    $tc += '<div id="showversion" class="showversion">';
    $tc += '<span id="infoname">' + uname + "</span><span> - V" + utils.HPVERSION + '</span>';
    $tc += '<div id="showdocs"><a href="http://www.housepanel.net" target="_blank">?</a></div>';
    $tc += "</div>";

    // end of the tabs
    $tc += "</div>";

    // set the websock servername as same as hosted page but different port
    var webSocketUrl = getSocketUrl(hostname);
    
    // include form with useful data for js operation
    $tc += "<form id='kioskform'>";
    var erstr =  ENABLERULES ? "true" : "false"
    $tc += utils.hidden("enablerules", erstr);

    // save the socket address for use on js side
    // save Node.js address for use on the js side
    $tc += utils.hidden("pagename", "main");
    $tc += utils.hidden("returnURL", GLB.returnURL);
    $tc += utils.hidden("pathname", pathname);
    $tc += utils.hidden("webSocketUrl", webSocketUrl);
    $tc += utils.hidden("skinid", skin, "skinid");

    // show user buttons if we are not in kiosk mode
    if ( !kioskmode ) {
        $tc += "<div id=\"controlpanel\">";
        $tc +='<div id="showoptions" class="formbutton">Options</div>';
        $tc +='<div id="refreshpage" class="formbutton">Refresh</div>';
        // $tc +='<div id="refactor" class="formbutton confirm">Refactor</div>';
        $tc +='<div id="userauth" class="formbutton confirm">Hub Auth</div>';
        $tc +='<div id="showid" class="formbutton">Show Info</div>';
        $tc +='<div id="toggletabs" class="formbutton">Hide Tabs</div>';
        $tc +='<div id="blackout" class="formbutton">Blackout</div>';

        $tc += "<div class=\"modeoptions\" id=\"modeoptions\"> \
          <input id=\"mode_Operate\" class=\"radioopts\" type=\"radio\" name=\"usemode\" value=\"operate\" checked><label for=\"mode_Operate\" class=\"radioopts\">Operate</label> \
          <input id=\"mode_Reorder\" class=\"radioopts\" type=\"radio\" name=\"usemode\" value=\"reorder\" ><label for=\"mode_Reorder\" class=\"radioopts\">Reorder</label> \
          <input id=\"mode_Edit\" class=\"radioopts\" type=\"radio\" name=\"usemode\" value=\"edit\" ><label for=\"mode_Edit\" class=\"radioopts\">Edit</label> \
          <input id=\"mode_Snap\" class=\"radioopts\" type=\"checkbox\" name=\"snapmode\" value=\"snap\"><label for=\"mode_Snap\" class=\"radioopts\">Grid Snap?</label> \
        </div><div id=\"opmode\"></div>";
        $tc +="</div>";
    }
    $tc += "</form>";

    // end drag region enclosing catalog and main things
    $tc += "</div>";

    $tc += utils.getFooter();
    return $tc;
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}


function saveFilters(body) {
    if ( DEBUG4 ) {
        console.log( (ddbg()), "filters save request: ", body);
    }
    var result = {};

    if ( body.useroptions ) {
        GLB.options["useroptions"] = body.useroptions;
        result.useroptions = body.useroptions;
    }

    if ( typeof body.huboptpick !== "undefined" ) {
        GLB.options["config"]["hubpick"] = body.huboptpick;
        result.huboptpick = body.huboptpick;
    }

    return result;
}

// process username and password edits on Options page and Login page
function saveUserPw(res, body, uname) {
    if ( DEBUG3 ) {
        console.log( (ddbg()), "password save request: ", body, " uname: ", uname);
    }

    // get the username and passwords
    var olduname = uname;
    var oldhash = "";
    var hash = "";
    var defskin = "skin-housepanel";
    var polisyip = GLB.options.config["polisyip"] || "localhost";
    
    // get default pw and its skin
    // or set up default if isn't configured
    if (array_key_exists("pword", GLB.options.config)) {
        if ( array_key_exists(uname, GLB.options.config["pword"]) ) {
            var pwords = GLB.options.config["pword"];
            oldhash = pwords[uname][0];
            defskin = pwords[uname][1];
        }
    } else {
        GLB.options.config["pword"] = {};
        GLB.options.config["pword"][uname] = [oldhash, defskin];
    }

    var skin = defskin;
    var result = {};

    for (var key in body) {
        var val = body[key];

        //skip the returns from the submit button and the flag
        if (key==="skin") {
            skin = val;
        } else if ( key==="timezone" ) {
            GLB.options.config["timezone"] = val;
        } else if ( key==="port" ) {
            var port = parseInt(val);
            if ( !isNaN(port) ) {
                GLB.options.config["port"] = port;
                var loc = GLB.returnURL.indexOf(":", 7);
                result.port = port;
                result.returnURL = GLB.returnURL.substr(0, loc) + ":" + port.toString();
            }
        } else if ( key==="webSocketServerPort" ) {
            var wsport = parseInt(val);
            if ( !isNaN(wsport) ) {
                GLB.options.config["webSocketServerPort"] = wsport;
            }
        } else if ( key==="fast_timer" ) {
            var fast_timer = parseInt(val);
            if ( isNaN(fast_timer) ) {
                fast_timer = 0;
            }
            GLB.options.config["fast_timer"] = fast_timer;
        } else if ( key==="slow_timer" ) {
            var slow_timer = parseInt(val);
            if ( isNaN(slow_timer) ) {
                slow_timer = 0;
            }
            GLB.options.config["slow_timer"] = slow_timer;
        } else if ( key==="polisyip" ) {
            var newip = val.trim();
            if ( newip ) {
                polisyip = newip;
            }
        } else if ( key==="uname" ) {
            // we use this only to set the options file
            // cookies are now used to check the client
            uname = val.trim();
            if ( uname==="" ) {
                uname = olduname;
            }
        } else if ( key==="pword" ) {
            hash = pw_hash(val.trim());
        }
    }
    // if password field is blank and user name is the same, keep old password
    if ( olduname===uname && hash==="" ) {
        hash = oldhash;
    }

    // set the skin and replace the custom file with that skin's version
    // but first check to make sure it is a valid name
    if ( !fs.existsSync(skin + "/housepanel.css") ) {
        skin = defskin;
        if ( !fs.existsSync(skin + "/housepanel.css") ) {
            skin = "skin-housepanel";
        }
    }

    // make sure our default skin has a custom file
    if ( !fs.existsSync(skin + "/customtiles.css") ) {
        writeCustomCss(skin, "");
    }

    // save the skin in my user specific setting
    GLB.options.config["uname"] = uname;
    GLB.options.config["pword"][uname] = [hash, skin];
    GLB.options.config["skin"] = skin;
    GLB.options.config["polisyip"] = polisyip;

    // set some return values
    result.uname = uname;
    result.hashname = pw_hash(uname);
    result.pword = hash;
    result.skin = skin;
    if ( DEBUG3 ) {
        console.log( (ddbg()), "saveuserpw processed: ", result, " uname: ", uname, " oldpw: ", oldhash, " newpw: ", hash, " polisyip: ", polisyip);
    }

    // load the new room settings
    if ( uname!== olduname ) {
        setCookie(res, "uname", result.hashname);
        readRoomThings("saveUserPw", uname);
    }

    return result;
}

// process user options page
function processOptions(uname, optarray) {

    if (DEBUG4) {
        console.log( (ddbg()), "Process Options - Before Processing");
        console.log( (ddbg()), UTIL.inspect(GLB.options, false, null, false));
    }
    // save existing uname options
    writeRoomThings(GLB.options, uname);
    var options = clone(GLB.options);

    // start with a blank slate
    options["things"] = {};
    for( var room in GLB.options["rooms"]) {
        options["things"][room] = [];
    }

    var specialtiles = getSpecials();
    var configoptions = options["config"];
    var roomnames = Object.keys(options["rooms"]);
    if ( !is_object(configoptions["specialtiles"]) ) {
        configoptions["specialtiles"] = {};
    }

    // // use clock instead of blank for default only tile
    var onlytile = GLB.options["index"]["clock|clockdigital"];
    var onlyarr = [onlytile,0,0,1,""];

    // // checkbox items simply will not be there if not selected
    configoptions["kiosk"] = "false";
    configoptions["rules"] = "false";
    configoptions["blackout"] = "false";

    // force all three to be given for change to happen
    var city = "";
    var region = "";
    var code = "";
    var fcastcity = "";
    var fcastregion = "";
    var fcastcode = "";

    // // get all the rooms checkboxes and reconstruct list of active things
    // // note that the list of checkboxes can come in any random order
    for (var key in optarray) {
        var val = optarray[key];

        //skip the returns from the submit button and the flag
        if (key==="options" || key==="api" || key==="useajax" ) {
            continue;
        } else if ( key==="kiosk") {
            configoptions["kiosk"] = "true";
        } else if ( key==="clrblackid") {
            configoptions["blackout"] = "true";
        } else if ( key==="rules") {
            configoptions["rules"] = ENABLERULES ? "true" : "false";
        } else if ( key==="accucity" ) {
            city = val.trim();
            configoptions["accucity"] = city;
        } else if ( key==="accuregion" ) {
            region = val.trim();
            configoptions["accuregion"] = region;
        } else if ( key==="accucode" ) {
            code = val.trim();
            configoptions["accucode"] = code;
        } else if ( key==="fcastcity" ) {
            fcastcity = val.trim();
            configoptions["fcastcity"] = fcastcity;
        } else if ( key==="fcastregion" ) {
            fcastregion = val.trim();
            configoptions["fcastregion"] = fcastregion;
        } else if ( key==="fcastcode" ) {
            fcastcode = val.trim();
            configoptions["fcastcode"] = fcastcode;
        
        // handle user selected special tile count
        } else if ( key.substr(0,4)==="cnt_" ) {
            var stype = key.substr(4);
            if ( array_key_exists(stype, specialtiles) ) {
                var spid = specialtiles[stype][0];
                var customcnt = parseInt(val);
                createSpecialIndex(customcnt, stype, spid);
                configoptions["specialtiles"] = clone(GLB.options["config"]["specialtiles"]);
                
            }
        
        // made this more robust by checking room name being valid
        } else if ( in_array(key, roomnames) && is_array(val) ) {
            var roomname = key;
            
            // first put all existing tiles in the room
            // this retains the existing order
            GLB.options["things"][roomname].forEach(function(newtile) {
                var tnum = parseInt(newtile[0]);
                var rnum = array_search(tnum, val);
                if ( rnum!==false ) {
                    options["things"][roomname].push(newtile);
                }
            });

            // add any new ones that were not there before
            val.forEach(function(tilestr) {
                var tilenum = parseInt(tilestr);
                if ( inroom(tilenum, GLB.options["things"][roomname]) === false ) {
                    var arrtile = [tilenum, 0, 0, 1, ""];
                    options["things"][roomname].push(arrtile);
                }
            });

            // put a clock in a room if it is empty
            if ( options["things"][roomname].length === 0  ) {
                options["things"][roomname].push(onlyarr);
            }
        }
    }
    
    // everything from this point on is after processing the options table
    // start by handling the weather
    if ( city && region && code ) {
        writeAccuWeather(city, region, code);
    }
    
    // guess the region based on the city if left blank
    if ( !fcastregion && fcastcity ) {
        var words = fcastcity.replace("-"," ").split(" ");
        fcastregion = "";
        for ( var i in words ) {
            fcastregion += words[i].substr(0,1).toUpperCase() + words[i].substr(1).toLowerCase() + " ";
        }
        fcastregion = fcastregion.trim();
        configoptions["fcastregion"] = fcastregion;
    }
    if ( fcastcity && fcastregion && fcastcode ) {
        writeForecastWidget(fcastcity, fcastregion, fcastcode);
    }
    
    // save the configuration parameters in the main options array
    options["config"] = configoptions;
    
    if (DEBUG4) {
        console.log( (ddbg()), "Process Options - After Processing");
        console.log( (ddbg()), UTIL.inspect(options, false, null, false));
    }

    // save options
    GLB.options = clone(options);
    return "success";
}

function changePageName(uname, oldname, newname) {
 
    var retcode = "success - testing";
    var options = GLB.options;

    if ( oldname && newname && oldname!==newname && array_key_exists(oldname, options["rooms"]) ) {

        // set new room to the number of the old room
        options["rooms"][newname] = options["rooms"][oldname];

        // create a new set of things tied to the new room name
        options["things"][newname] = [];
        var things = options["things"][oldname];
        things.forEach(function(tile, k) {
            if ( is_array(tile) ) {
                var newtile = clone(tile);
                options["things"][newname].push(newtile);
            }
        });

        // delete the old room and thing list
        delete options["rooms"][oldname];
        delete options["things"][oldname];
        retcode = "success - Renamed room: " + oldname + " to: " + newname;
        if ( DEBUG1 ) {
            console.log( (ddbg()), retcode);
        }
        writeRoomThings(options, uname);
    } else {
        retcode = "error - old page: " + oldname + " new page: " + newname;
        console.log( (ddbg()), retcode);
    }
    return retcode;
}

function updateNames(uname, type, tileid, newname) {
    var result;
    var oldname = "";
    if ( type === "page" ) {
        newname = newname.replace(/ /g, "_");
        oldname = tileid;
        result = changePageName(uname, oldname, newname);
    } else {
        var options = GLB.options;
        var updcss = false;
        var nupd = 0;
        tileid = parseInt(tileid);

        // if the name is blank, reset it to original
        newname = newname.trim();
        var resetname = false;
        var idx = array_search(tileid, options["index"]);
        if ( newname==="" ) {
            newname = allthings[idx]["name"];
            resetname = true;
        } else {
            allthings[idx].value.name = newname;
        }

        for (var room in options["things"]) {
            var things = options["things"][room];
        
            // look for matching options item
            // and update to new value if it changed
            // also guard against old style that wasn't an array
            // or arrays that were not at least 4 elements long
            // the 4th element of the array is the custom name
            things.forEach(function(tiles, k) {
                if ( is_array(tiles) && parseInt(tiles[0]) === tileid && 
                     (resetname || (tiles.length>3 && tiles[4]!==newname))  ) {

                    oldname = tiles[4];
                    tiles[4] = newname;

                    // update the things names in room lists
                    options["things"][room][k] = tiles;

                    nupd++;
                    updcss = true;
                }

            });
        }
        if ( updcss ) {
            writeRoomThings(options, uname);
            result = "success " + nupd.toString() + " names changed for type= " + type + " oldname= " + oldname + " newname= " + newname;
        } else {
            result = "warning - nothing updated for type= " + type + " oldname= " + oldname + " newname= " + newname;
        }
    }
    return result;
}

function getIcons(uname, icondir, category) {
    var skin = getSkin(uname);

    if ( !icondir ) {
        icondir = "icons";
    }
    if ( !category ) {
        category = "";
    }

    // change over to where our icons are located
    var activedir = path.join(__dirname, skin, icondir);

    // TODO - get function to return a directory listing
    // $dirlist = scandir($activedir);
    var dirlist = fs.readdirSync(activedir);
    var allowed = ["png","jpg","jpeg","gif"];
    var $tc = "";

    dirlist.forEach( function(filename) {
        var froot = path.basename(filename);
        var ext = path.extname(filename).slice(1);
        var filedir = path.join(skin, icondir, froot);

        if ( in_array(ext, allowed) ) {
            $tc += '<div class="cat ' + category + '">';
            $tc += '<img src="' + filedir +'" class="icon" title="' + froot + '" />';
            $tc += '</div>';
        }
    });
    return $tc;
}

function pw_hash(pword, algo) {
    if (!algo) { algo = "sha256"; }
    var hash;
    if ( typeof pword !== "string"  || !pword || !pword.trim() ) {
        hash = "";
    } else {
        pword = pword.trim();
        var thehash = crypto.createHash(algo);
        thehash.update(pword);
        hash = thehash.digest('hex');
    }
    return hash;
}

function pw_verify(pword, hash, algo) {
    return (pw_hash(pword, algo) === hash);
}

// the swval here is actually custom type
function addCustom(uname, swid, swtype, customtype, customval, subid) {
    var reserved = ["index","rooms","things","config","control","time","useroptions"];
    var userid = "user_" + swid;

    // legacy custom types
    if ( array_key_exists(swid, GLB.options) && 
            !in_array (swid, reserved) && 
            !array_key_exists(userid, GLB.options) ) {
        userid = swid;
    }

    var oldcustoms;
    if ( array_key_exists(userid, GLB.options) ) {
        oldcustoms = clone(GLB.options[userid]);
    } else {
        oldcustoms = [];
    }

    // handle encryption
    customval = customval.toString();
    subid = subid.toString();
    if ( subid==="password" ) {
        customval = pw_hash(customval);
    }
    
    var newitem = [customtype, customval, subid];
    var newoptitem = [];
    var doneit = false;

    oldcustoms.forEach( function(val) {
        if ( val[2].toString() === subid ) {
            if ( !doneit ) {
                newoptitem.push(newitem);
                doneit = true;
            }
        } else {
            newoptitem.push(val);
        }
    });

    if ( !doneit ) {
        newoptitem.push(newitem);
    }

    GLB.options[userid] = newoptitem;
    writeOptions(GLB.options);
    // writeRoomThings(options, uname);
    var idx = swtype + "|" + swid;
    
    // make the new custom field using the updated options above
    var thingval = allthings[idx]["value"];
    thingval = getCustomTile(thingval, swtype, swid);
    thingval = returnFile(thingval, swtype);

    // save it in the main array - no need for sessions in Node
    allthings[idx]["value"] = thingval;

    return thingval;
}

function delCustom(uname, swid, swtype, swval, swattr, subid) {
    var reserved = ["index","rooms","things","config","control","useroptions"];
    var userid = "user_" + swid;

    swattr = swattr.toString();
    subid = subid.toString();

    // legacy custom types
    if ( array_key_exists(swid, GLB.options) && 
            !in_array (swid, reserved) && 
            !array_key_exists(userid, GLB.options) ) {
        userid = swid;
    }

    if ( array_key_exists(userid, GLB.options) ) {

        var oldlines = clone(GLB.options[userid]);
        if ( ! is_array(oldlines[0]) ) {
            oldlines = [oldlines];
        }

        // make new list of customs without the deleted item
        var lines = [];
        oldlines.forEach( function(newitem) {
            if ( newitem[2].toString() !== subid ) {
                lines.push(newitem);
            }
        });

        // either remove or update the main options array
        if ( lines.length === 0 ) {
            delete GLB.options[userid];
        } else {
            GLB.options[userid] = lines;
        }
        writeOptions(GLB.options);
        // writeRoomThings(GLB.options, uname);
    }
    
    var idx = swtype + "|" + swid;
    var companion = "user_" + subid;
    var thingval = allthings[idx]["value"];
    
    // remove this field and any companion if it exists
    delete thingval[subid];
    if ( array_key_exists(companion, thingval) ) {
        delete thingval[companion];
    }

    // save here before calling because these routines use this array
    allthings[idx]["value"] = thingval;

    // make the new custom field using the updated options above
    // thingval = returnFile(thingval, swtype);
    thingval = getCustomTile(thingval, swtype, swid);
    thingval = returnFile(thingval, swtype);
   
    // save it in the main array - no need for sessions in Node
    allthings[idx]["value"] = thingval;
    return thingval;
}

function apiCall(body, protocol, req, res) {

    if ( DEBUG8 ) {
        console.log( (ddbg()), protocol + " api call, body: ", UTIL.inspect(body, false, null, true) );
    }
    var hubs = GLB.options.config["hubs"];

    var api = body['useajax'] || body['api'] || "";
    var swid = body["id"] || "none";
    var swtype = body["type"] || "none";
    var swval = body["value"] || "";
    var swattr = body["attr"] || "";
    var subid = body["subid"] || "";
    var tileid = body["tile"] || body["tileid"] || "";
    var command = body["command"] || "";
    var linkval = body["linkval"] || "";

    // get the user name from GUI first and cookies next and last used
    var uname = body["uname"] || getUserName(req.cookies);
    if ( !uname ) {
        if ( typeof GLB.options!=="undefined" && typeof GLB.options["config"]!=="undefined" && array_key_exists("uname", GLB.options["config"]) ) {
            uname = GLB.options["config"]["uname"];
            console.log( (ddbg()), "*** warning *** using user= [" + uname + "] from options file for API call");
        } else {
            uname = "default";
            console.log( (ddbg()), "*** warning *** using user= [default] for API call");
        }
    }

    // if this is a different user than what is loaded then load up our user
    // this shouldn't happen too often unless there are people pushing panels at same time
    if ( !GLB.options.config.uname || uname !== GLB.options.config.uname ) {
        GLB.options.config.uname = uname;
        readRoomThings("apiCall", uname);
    }

    // send mqtt message
    if ( udclient && udclient.connected ) {
        udclient.publish("housepanel/apiCall", JSON.stringify(body, null, 1));
    }
 
    var hubid = body["hubid"] || "auto";
    if ( body["hubnum"] ) {
        var hubnum = parseInt(body["hubnum"]);
        if ( !isNaN(hubnum) && hubnum >=0 && hubnum < hubs.length ) {
            hubid = hubs[hubnum]["hubId"];
        } else {
            hubid = "auto";
        }
    }

    // handle multiple api calls but only for tiles since nobody would ever give a list of long id's
    if ( tileid && tileid.indexOf(",") !== -1 ) {
        var multicall = true;
        var tilearray = tileid.split(",");
    } else {
        multicall = false;
    }

    var result;
    switch (api) {
        
        case "doaction":
        case "action":
            if ( multicall ) {
                result = [];
                tilearray.forEach(function(atile) {
                    if ( DEBUG8 ) {
                        console.log( (ddbg()), "doaction multicall: hubid: ", hubid, " swid: ", swid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid, " atile: ", atile);
                    }
                    var aresult = doAction("auto", "", "", swval, swattr, subid, atile, "", "", protocol);
                    result.push(aresult);
                });
            } else {
                if ( DEBUG8 ) {
                    console.log( (ddbg()), "doaction: hubid: ", hubid, " swid: ", swid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid, " tileid: ", tileid);
                }
                result = doAction(hubid, swid, swtype, swval, swattr, subid, tileid, command, linkval, protocol);
            }
            break;
            
        case "doquery":
        case "query":
            if ( multicall ) {
                result = [];
                tilearray.forEach(function(atile) {
                    var aresult = doQuery("auto", "", "", atile, protocol);
                    result.push(aresult);
                });
            } else {
                result = doQuery(hubid, swid, swtype, tileid, protocol);
            }
            break;

        case "status":
        case "dostatus":
            var activehubs = GLB.options.config ? utils.count(GLB.options.config.hubs) : 0;
            var thingcount = utils.count(allthings);
            var username = GLB.options.config.uname || "";
            result = {"state": "active", "hubs": activehubs, "clients": clients.length, "things": thingcount, "username": username};
            break;

        case "wysiwyg":
            if ( swtype==="page" ) {
                // make the fake tile for the room for editing purposes
                var faketile = {"panel": "panel", "name": swval, "tab": "Tab Inactive", "tabon": "Tab Selected"};
                var thing = { "id": "r_" + swid, "name": swval, 
                              "hubnum": "-1", "type": "page", "value": faketile};
                result = makeThing(0, tileid, thing, "wysiwyg", 0, 0, 500, "", "te_wysiwyg");
            } else {
                var idx = swtype + "|" + swid;
                var thing = allthings[idx];
                var customname = swattr;
                
                // load customizations
                // thing.value = getCustomTile(thing.value, swtype, swid);
                // allthings[idx] = thing;            
                result = makeThing(0, tileid, thing, "wysiwyg", 0, 0, 500, customname, swval);
            }
            break;

        case "pageorder":
        case "setorder":
            if ( protocol==="POST" ) {
                result = setOrder(uname, swid, swtype, swval, swattr);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "dragdrop":
        case "setposition":
            if ( protocol==="POST" ) {
                result = setPosition(uname, swid, swtype, swval, swattr, tileid);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "dragmake":
        case "addthing":
            if ( protocol==="POST" ) {
                result = addThing(uname, swid, swtype, swval, swattr, "auto");
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;
    
        case "dragdelete":
            if ( protocol==="POST" ) {
                result = delThing(uname, swid, swtype, swval, swattr);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "pagedelete":
            if ( protocol==="POST" ) {
                result = delPage(uname, swval);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;
    
        case "pageadd":
            if ( protocol==="POST" ) {
                result = addPage(uname);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "catalog":
        case "getcatalog":
            result = getCatalog(swattr);
            break;
            
        case "refactor":
            if ( protocol==="POST" ) {
                // TODO: this does not yet work so it was removed from menu
                // note really needed any more given how reorder and absolute positioning now works
                // refactorOptions(uname);
                result = "success";
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;
    
        case "refreshpage":
            if ( protocol==="POST" ) {
                readOptions("refresh");
                getAllThings(true);
                result = "success";
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;
        
        // the GUI will never ask to reload options but a user might when making an api call
        case "options":
        case "getoptions":
            if ( swattr==="reload" ) {
                readOptions("getoptions");
                readRoomThings("getoptions", uname);
            }
            result = GLB.options;
            break;

        case "sortupdate":
            if ( protocol==="POST" ) {
                var idx = swtype + "|" + swid;
                var uid = swattr;
                if ( uid && array_key_exists(uid, GLB.options) && swval && is_array(swval) ) {
                    GLB.options[uid] = swval;
                    allthings[idx]["value"] = getCustomTile(allthings[idx]["value"], swtype, swid);
                    writeOptions(GLB.options);
                    // writeRoomThings(GLB.options, uname);
                    result = allthings[idx]["value"];
                } else {
                    result = "error - invalid request to update user Options";
                }
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        // this returns the existing things and optionally updates them
        // the update will not be returned but could be retrieved on a second separate call
        case "getallthings":
        case "getthings":
        case "things":
            result = clone(allthings);
            if ( swattr==="reload" ) {
                allthings = {};
                getAllThings(true);
            }
            break;
                
        case "hubs":
        case "gethubs":
           result = hubs;
           break;

        case "filteroptions":
            if ( protocol==="POST" ) {
                result = saveFilters(body);
                writeOptions(GLB.options);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
        break;

        case "saveuserpw":
        case "userpw":
            if ( protocol==="POST" ) {
                result = saveUserPw(res, body, uname);
                writeOptions(GLB.options);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "saveoptions":
            if ( protocol==="POST" ) {
                result = processOptions(uname, body);
                if ( DEBUG4 ) {
                    console.log( (ddbg()), "Process options: ", result, GLB.options);
                }
                if ( result === "success" ) {
                    writeOptions(GLB.options);
                    writeRoomThings(GLB.options, uname);
                }
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "savetileedit":
            if ( protocol==="POST" ) {
                var n1 = parseInt(body["n1"]);
                var nlen = parseInt(body["nlen"]);
                var n2 = parseInt(body["n2"]);
                if ( isNaN(n1) || isNaN(n2) || isNaN(nlen) ) {
                    result = "error - invalid call to savetileedit. n1= " + n1 + " n2= " + n2 + " nlen= " + nlen;
                } else {
                    if ( DEBUG16 ) {
                        console.log( (ddbg()), "savetile: n1= " + n1 + " n2= " + n2 + " nlen= " + nlen );
                    }
                    if ( n1=== 0 ) {
                        GLB.newcss = "";
                    }
                    GLB.newcss += decodeURI(swval);

                    // write if this is last segment
                    result = "success - " + n2.toString();
                    if ( n2=== nlen ) {
                        if ( DEBUG16 ) {
                            console.log( (ddbg()), "----------------------------------------------------------");
                            console.log( (ddbg()), GLB.newcss );
                            console.log( (ddbg()), "----------------------------------------------------------");
                        }
                        writeCustomCss(getSkin(uname), GLB.newcss);
                    }
                }
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "updatenames":
            // value (swval) is new name, tileid is oldname for pages
            if ( protocol==="POST" ) {
                result = updateNames(uname, swtype, tileid, swval);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;
        
        // rewritten to use cookies
        case "dologin":
            if ( protocol==="POST" ) {
                // change the user name and password based on login form data
                uname = body["uname"].trim();
                var pword = pw_hash(body["pword"]);

                // check to see if the provided username is valid
                // and that the passwords match
                result = "error";
                var pwords = GLB.options["config"]["pword"];

                if ( DEBUG3 ) {
                    console.log( (ddbg()), "dologin: uname= ", uname, " pword: ["+pword+"] body: ", body, " pwords: ", pwords);
                }

                // check for matching passwords - if record exists, login password must match
                if ( array_key_exists(uname, pwords ) ) {
                    var pw = pwords[uname];
                    if ( pw[0] === pword || IGNOREPW ) {
                        // save the username in the cookie session
                        setCookie(res, "uname", pw_hash(uname));
                        readRoomThings("dologin", uname);
                        if ( DEBUG3 ) {
                            console.log( (ddbg()), "logged in and set cookie successfully for uname: ", uname, " to: ", pw_hash(uname));
                        }
                        result = {uname: uname, pword: pword};
                    } else {
                        // clear the cookie to force repeat of login page
                        res.clearCookie("uname");
                        if ( DEBUG3 ) {
                            console.log( (ddbg()), "login failed. cleared cookie for uname: ", uname, " hash: ", pw_hash(uname));
                        }
                        uname = "default";
                        pword = "";
                        result = "error";
                    }

                // name does exist so create it and log in
                // TODO - make a more elegant way of creating and managing users
                } else {
                    pwords[uname] = [pword, "skin-housepanel"];
                    setCookie(res, "uname", pw_hash(uname));
                    GLB.options["config"]["pword"] = pwords;
                    writeOptions(GLB.options);
                    writeRoomThings(GLB.options, uname);
                    result = {uname: uname, pword: pword};
                }
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "pwhash":
            result;
            if ( swtype==="hash" ) {
                result = pw_hash(swval);
            } else if ( swtype==="verify" ) {
                if ( pw_verify(swval, swattr) ) {
                    result = "success";
                } else {
                    result = "error";
                }
            } else {
                result = "error";
            }
            break;

        case "addcustom":
            if ( protocol==="POST" ) {
                result = {}
                result.value = addCustom(uname, swid, swtype, swval, swattr, subid);
                result.options = GLB.options;
                result.things = allthings;
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "delcustom":
            if ( protocol==="POST" ) {
                result = {}
                result.value = delCustom(uname, swid, swtype, swval, swattr, subid);
                result.options = GLB.options;
                result.things = allthings;
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        case "icons":
        case "geticons":
            result = getIcons(uname, swval, swattr);
            break;

        // this api call starts the oauth flow process
        // the actual redirection to the first auth site is done in js file
        case "hubauth":

            if ( protocol==="POST" ) {

                // now load the new data
                var hub = {};
                hub["hubType"] = body.hubType;
                hub["hubHost"] = body.hubHost;
                hub["clientId"] = body.clientId;

                if ( DEBUG2 ) {
                    console.log( (ddbg()), "raw user provided clientSecret = ", body.clientSecret);
                }
                hub["clientSecret"] = body.clientSecret;
                hub["userAccess"] = body.userAccess;
                hub["userEndpt"] = body.userEndpt;
                hub["hubName"] = body.hubName;
                hub["hubId"] = body.hubId;
                hub["hubAccess"] = body.hubAccess;
                hub["hubEndpt"] = body.hubEndpt;
                hub["hubTimer"] = body.hubTimer;

                // fix up host if http wasn't given
                if ( !hub["hubHost"].toLowerCase().startsWith("http") ) {
                    hub["hubHost"] = "http://" + hub["hubHost"];
                }

                // if user provides hub access info, use it
                // for ISY hubs we know the endpoint as /rest so use it
                if ( body.hubType==="ISY" ) {
                    body.userAccess = body.clientId + ":" + body.clientSecret;
                    body.userEndpt = hub["hubHost"] + "/rest";
                    hub["userAccess"] = body.userAccess;
                    hub["userEndpt"] = body.userEndpt;
                }

                // if this is a new hub and no name given, give it one
                if ( hub["hubName"].trim()==="" ) {
                    hub["hubName"] = hub["hubType"];
                }

                // no oauth flow if access code and end points are given
                if ( body.userAccess && body.userEndpt ) {
                    // remove trailing slash if it is there
                    if ( body.userEndpt.substr(-1) === "/" ) {
                        body.userEndpt = body.userEndpt.substr(0, body.userEndpt.length -1);
                        hub["userEndpt"] = body.userEndpt;
                    }
                    if (body.hubType==="ISY") {

                        // get the number of ISY hubs already configured
                        // if the id is given this means the hub exists
                        if ( !body.hubId.startsWith("isy") ) {
                            var newhubnum = 1;
                            hubs.forEach(function(ahub) {
                                if ( ahub.hubType==="ISY" && ahub.hubId.startsWith("isy") ) {
                                    newhubnum++;
                                }
                            });
                            
                            if ( newhubnum < 10 ) {
                                hub.hubId = "isy0" + newhubnum.toString();
                            } else {
                                hub.hubId = "isy" + newhubnum.toString();
                            }
                            body.hubId = hub.hubId;

                        } else {
                            hub.hubId = body.hubId;
                        }

                    }

                    hub["hubAccess"] = body.userAccess;
                    hub["hubEndpt"] = body.userEndpt;
                }

                // update existing or add a new hub
                updateHubs(hub, body.hubId);
                writeOptions(GLB.options);
                hubs = GLB.options.config.hubs;

                if (DEBUG2) {
                    console.log( (ddbg()), "There are " + hubs.length + " hubs available after hubauth.");
                    console.log( (ddbg()), "hubs: ", hubs);
                }

                // now authorize them
                // handle direct access including ISY hubs first
                var hubnum = hub["hubId"];
                var hubName = hub["hubName"];
                var hubType = hub["hubType"];
                var host = hub["hubHost"];
                var clientId = hub["clientId"];
                var clientSecret = hub["clientSecret"];
                GLB.defhub = hubnum;

                // no oauth if user provides access info
                if ( hub["userAccess"] && hub["userEndpt"] ) {

                    // get all new devices and update the options index array
                    // this forces page reload with all the new stuff
                    // notice the reference to /reauth in the call to get Devices
                    // this makes the final read redirect back to reauth page
                    var accesstoken  = hub["userAccess"];
                    var hubEndpt = hub["userEndpt"];
                    hub["hubAccess"] = accesstoken;
                    hub["hubEndpt"] = hubEndpt;

                    // for ISY we can go right to getting devices
                    // for others we need to use getHubInfo to first get hubId and hubName
                    // and then we call devices from there given the async nature of Node
                    // this is much like what happens in the OAUTH flow
                    result = {action: "things", hubType: hubType, hubName: hubName};
                    if ( hubType==="ISY" ) {
                        getDevices(hub, true, "/reauth");
                    } else if ( hubType==="SmartThings" || hubType==="Hubitat" ) {
                        getHubInfo(hub, accesstoken, hubEndpt, clientId, clientSecret, false);
                    } else {
                        result = "error - invalid attempt to use user access and user endpoint settings.";
                    }
                    if ( DEBUG2 ) {
                        console.log( (ddbg()), "Device retrieval initiated: ", result);
                    }

                // oauth flow for Ford and Lincoln vehicles
                // we complete the flow later when redirection happens back to /oauth GET call
                } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
                    var fordloc = GLB.returnURL + "/oauth";
                    var model = hubType.substr(0,1);
                    if ( DEBUG2Ford ) {
                        getAccessToken( "fakedebugcode", hub );
                        result = "Debugging Ford oauth settings...";
                    } else {
                        result = {action: "fordoauth", host: host, model: model, hubName: hubName, hubId: hubnum, clientId: clientId, clientSecret: clientSecret, url: fordloc};
                    }

                // oauth flow for ST and HE hubs
                // we complete the flow later when redirection happens back to /oauth GET call
                } else {
                    var returnloc = GLB.returnURL + "/oauth";
                    result = {action: "oauth", host: host, hubName: hubName, clientId: clientId, clientSecret: clientSecret, url: returnloc};
                }
                if ( DEBUG2 ) {
                    console.log( (ddbg()), "OAUTH flow for " + hubType + " initiated: ", result);
                }
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
    
            break;
    
        case "hubdelete":
            // TODO - implement hubDelete() function
            console.log( (ddbg()), "Hub deletion is not yet supported...");
            result = "success";
            break;

        case "getclock":
            if ( !swid || swid==="none" ) { swid = "clockdigital"; }
            result = getClock(swid);
            result = getCustomTile(result, "clock", swid);
            // replace any links with stored link values
            // otherwise update the main array with new time info
            for (var rsubid in result) {
                var rvalue = result[rsubid];
                var idx = "clock|" + swid;
                if ( rvalue && rvalue.startsWith("LINK::") ) {
                    result[rsubid] = allthings[idx]["value"][rsubid];
                } else {
                    allthings[idx]["value"][rsubid] = rvalue;
                }
            }

            // process rules
            processRules(swid, "clock", "time", result, "getclock");

            break;

        case "cancelauth":
        case "showoptions":
        case "showid":
        case "reauth":
        case "logout":
        case "trackupdate":
                var result = "error - [" + api + "] API call is no longer supported. Try loading browser with: " + GLB.returnURL + "/" + api;
                console.log( (ddbg()), result);
                break;

        case "reload":
            // pushClient("reload", "/");
            break;

        case "reset":
            if ( protocol==="GET" ) {
                // force reading main settings
                readOptions("reset");
                
                uname = "default";
                setCookie(res, "uname", pw_hash(uname));
                GLB.options.config["pword"] = {};
                GLB.options.config["pword"][uname] = ["", "skin-housepanel"];
                GLB.options.config["uname"] = uname;
                writeOptions(GLB.options);
                readRoomThings("reset", uname);
                pushClient("reload", "/logout");
                result = getLoginPage(uname);
            } else {
                result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
            }
            break;

        default:
            result = "error - unrecognized " + protocol + " api call: " + api;
            break;
    }
    return result;

}

function setupSockets() {

    var wsServer;
    var serverlistening;
    var config = GLB.options.config;

    // create the HTTP server for handling sockets
    var server = http.createServer(function(req, res) {});

    // set up server for a two way socket communication with the browser
    if ( server && config.webSocketServerPort ) {
        // create the webSocket server
        wsServer = new webSocketServer({httpServer: server });
        server.listen(config.webSocketServerPort, function() {
            console.log( (ddbg()), "webSocket Server is listening on port: ", config.webSocketServerPort);
        });
        serverlistening = true;
    } else {
        serverlistening = false;
        console.log( (ddbg()), "webSocket could not be established. webSocketServerPort= ", config.webSocketServerPort);
    }

    // This function handles new connections, messages from connections, and closed connections
    if ( wsServer && serverlistening ) {
        wsServer.on('request', function(wsrequest) {
            console.log( (ddbg()), 'Requesting websocket connection: ', wsrequest.origin);
            wsrequest.accept(null, wsrequest.origin); 
        });

        wsServer.on('message', function(wsrequest) {
            console.log( (ddbg()), 'websocket msg data: ', wsrequest.data );
        });

        wsServer.on('connect', function(connection) {
            console.log( (ddbg()), 'Connecting websocket. Addresses: ', connection.remoteAddresses );

            // shut down any existing connections to same remote host
            var host = connection.socket.remoteAddress;
            var i = 0;
            while ( i < clients.length ) {
                var oldhost = clients[i].socket.remoteAddress;
                if ( oldhost===host ) {
                    clients.splice(i, 1);
                } else {
                    i++;
                }
            }

            // report index of the connection
            // we no longer rely on this to close prior connections
            // instead we just shut down any that match
            var index = clients.push(connection) - 1;
            console.log( (ddbg()), 'Connection accepted. Client #' + index, " host: ", host, " Client count: ", clients.length);

            // send client number to the javascript so it knows its index
            // pushClient("client", "client");

            // user disconnected - remove all clients that match this socket
            connection.on('close', function(reason, description) {
                var host = connection.socket.remoteAddress;
                console.log( (ddbg()), "Peer: ", host, " disconnected. for: ", reason, " desc: ", description);

                // remove clients that match this host
                // clients.splice(indexsave, 1);
                var i = 0;
                while ( i < clients.length ) {
                    var oldhost = clients[i].socket.remoteAddress;
                    if ( oldhost===host ) {
                        clients.splice(i, 1);
                    } else {
                        i++;
                    }
                }
            });

        });
    }

    // make websocket connection to any ISY hub
    // unlike ST and HE below, communication from ISY happens over a real webSocket
    var wshost;
    for (var h in GLB.options.config["hubs"]) {
        var hub = GLB.options.config["hubs"][h];
        wshost = false;
        if ( hub["hubType"]==="ISY" && hub["hubEndpt"] && hub["hubAccess"] ) { 

            var hubhost = hub["hubEndpt"];
            if ( hubhost.startsWith("https://") ) {
                wshost = "wss://" + hubhost.substr(8);
            } else if ( hubhost.startsWith("http://") ) {
                wshost = "ws://" + hubhost.substr(7);
            }
        }

        // set up socket for ISY hub if one is there
        if ( wshost ) {
            var wsclient = new webSocketClient();
            var buff = Buffer.from(hub["hubAccess"]);
            var base64 = buff.toString('base64');
            var origin = "com.universal-devices.websockets.isy";
            var header = {"Authorization": "Basic " + base64, "Sec-WebSocket-Protocol": "ISYSUB",  
                        "Sec-WebSocket-Version": "13", "Origin": "com.universal-devices.websockets.isy"};
            wshost = wshost + "/subscribe";

            wsclient.on("connectFailed", function(err) {
                console.log( (ddbg()), "Connection failure to ISY socket: ", err.toString(), " wshost: ", wshost, " header: ", header);
            });

            wsclient.on("connect", function(connection) {
                console.log( (ddbg()), "Success connecting to ISY socket. Listening for messages...");

                // handle incoming state messages from ISY
                // this will be ignored if the node isn't in our list
                connection.on("message", function(msg) {
                    if ( msg.type==="utf8" ) {
                        processIsyMessage(msg.utf8Data);
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

}

// ***************************************************
// beginning of main routine
// ***************************************************
var d = new Date();
var hpcode = d.getTime();
GLB.hpcode = hpcode.toString();

// read the basic config info
readOptions("startup");
readRoomThings("startup", "default");

if ( DEBUG4 ) {
    console.log( (ddbg()), "Options: ", UTIL.inspect(GLB.options, false, null, false));
}

var config = GLB.options.config;
var port = config["port"];
if ( !port ) {
    port = 3080;
    config["port"] = 3080;
}
GLB.defhub = "-1";

// start our main server
try {
    // the Node.js app loop - can be invoked by client or back end
    app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    var dir = path.join(__dirname, '');
    app.use(express.static(dir));
    app.use(cookieParser());

    var httpServer = http.createServer(app);

    // list on the port
    httpServer.listen(port, function () {
        console.log( (ddbg()), "HousePanel insecure server is running at location: ", dir, " on port: ", port);
    });
    if ( fs.existsSync("client-1.local.key") && fs.existsSync("client-1.local.crt") ) {
        try {
            var intport = parseInt(port);
            if ( isNaN(intport) || intport < 3000 ) {
                var s_port = 3843;
            } else {
                s_port = intport - (intport % 100) + 43;
            }
            var key = fs.readFileSync("client-1.local.key");
            var crt = fs.readFileSync("client-1.local.crt");
            var credentials = {ca: crt, key: key, cert: crt};
            var httpsServer = https.createServer(credentials, app);
            httpsServer.listen(s_port, function () {
                console.log( (ddbg()), "HousePanel secure server is running on port: ", s_port);
            });
        } catch (e) {
            console.log( (ddbg(), "Error attempting to start secure server", e));
        }
    }
    applistening = true;
    
} catch (e) {
    console.log( (ddbg()), "HousePanel server could not be started at location: ", dir, " on port: ", port);
    app = null;
    applistening = false;
}

// retrieve all nodes/things
// client pages are refreshed when each hub is done reading
if ( app && applistening ) {
    allthings = {};
    getAllThings(true);
    resetRules();
    resetRuleTimers();

    // handler functions for HousePanel
    // this is where we render the baseline web page for the dashboard
    // define all the mime types that can be rendered
    var mime = {
        html: 'text/html',
        txt: 'text/plain',
        css: 'text/css',
        gif: 'image/gif',
        jpg: 'image/jpeg',
        png: 'image/png',
        svg: 'image/svg+xml',
        js: 'application/javascript'
    };

    app.get('*', function (req, res) {
        
        var $tc = "";
        GLB.returnURL = req.protocol + "://" + req.headers.host;
        var uname;
        var checkpw;

        // handle new users
        if ( GLB.newuser || !GLB.options.config || !GLB.options.config["pword"] ) {
            uname = "default";
            checkpw = true;
            setCookie(res, "uname", pw_hash(uname));
            GLB.options.config["pword"] = {};
            GLB.options.config["pword"][uname] = ["", "skin-housepanel"];
            GLB.options.config["uname"] = uname;
            writeOptions(GLB.options);
            writeRoomThings(GLB.options, uname);
            GLB.newuser = true;
        } else {
            uname = getUserName(req.cookies);
            GLB.newuser = false;
        }

        if ( DEBUG3 ) {
            console.log( (ddbg()), "pw check: uname=["+uname+"]", " codeuser: ", codeuser, " checkpw= ["+checkpw+"]");
        }

        // if ( !IGNOREPW && !checkpw ) {
        //     $tc = getLoginPage(uname);
        //     res.send($tc);
        //     res.end();

        if ( req.path==="/" || typeof req.path==="undefined" || req.path==="/undefined" || req.path==="undefined" ) {

            // set the global variable so other functions can return here
            var queryobj = req.query || {};
            var isquery = (utils.count(queryobj) > 0);
            GLB.defhub = "-1";

            // first check for a valid login
            uname = getUserName(req.cookies);
            if ( uname && GLB.options.config["pword"][uname] ) {
                checkpw = true;
            } else {
                uname = "default";
                checkpw = false;
            }

            // allow user to manually reset things with this code
            // the hub auth flow is handled with the /reauth path later below
            // this removes all user accounts and logs everyone out
            if ( isquery && queryobj.code && (queryobj.code==="reset") ) {
                // readOptions("reset", req.cookies);
                uname = "default";
                setCookie(res, "uname", pw_hash(uname));
                GLB.options.config["pword"] = {};
                GLB.options.config["pword"][uname] = ["", "skin-housepanel"];
                GLB.options.config["uname"] = uname;
                writeOptions(GLB.options);
                readRoomThings("manual reset", uname);
                pushClient("reload", "/logout");
                $tc = "Logging out all clients...";

            // display the main page if user is in our database
            // don't check password here because it is checked at login
            // and the cookie is set which means all is okay
            // if the username is not returned in the cookie then we
            // know the login was not successful
            // however it can be bypassed with the IGNOREPW constant
            // but actually that is also checked in the login so not really needed here too
            } else if ( IGNOREPW || GLB.newuser || checkpw ) {
                
                // set this to always see new user welcome message
                // otherwise, comment it out
                // GLB.newuser = true;
                if ( DEBUG15 ) {
                    console.log( (ddbg()), "login accepted. uname = ", uname);
                    console.log( (ddbg()), "allthings before render: \n", UTIL.inspect(allthings, false, null, false) );
                    console.log( (ddbg()), "options before render: \n", UTIL.inspect(GLB.options, false, null, false) );
                }
                // load our user setup and render page
                readRoomThings("main", uname);
                $tc = mainPage(uname, req.headers.host, req.path);

            } else {
                console.log( (ddbg()), "login rejected. uname= ", uname);
                $tc = getLoginPage(uname);
            }
            res.send($tc);
            res.end();

        } else if ( req.path==="/showid") {
            readRoomThings("main", uname);
            $tc = getInfoPage(uname, GLB.returnURL, req.path);
            res.send($tc);
            res.end();

        } else if ( req.path==="/showoptions") {
            readRoomThings("main", uname);
            $tc = getOptionsPage(uname, req.headers.host, req.path);
            res.send($tc);
            res.end();

        } else if ( req.path==="/logout") {
            // clear the cookie to force repeat of login page
            res.clearCookie("uname");
            uname = "default";
            $tc = getLoginPage(uname);
            res.send($tc);
            res.end();

        } else if ( req.path==="/reauth") {
            var $tc = getAuthPage(uname, req.headers.host, req.path, "");
            res.send($tc);
            res.end();

        } else if ( req.path==="/userauth") {
            GLB.defhub = "-1";
            var $tc = getAuthPage(uname, req.headers.host, "/reauth", "");
            res.send($tc);
            res.end();

        // this is where the oauth flow returns from the first auth step
        } else if ( req.path==="/oauth") {
            if ( req.query && req.query["code"] ) {
                var hubId = GLB.defhub;
                var hub = findHub(hubId);
                if ( hub ) {
                    var rmsg = "Retrieving devices from Hub: " + hub.hubName;
                    if ( DEBUG2 ) {
                        console.log( (ddbg()), "Getting access_token for hub: ", hub);
                    }

                    // get access_token, endpt, and retrieve devices
                    // this goes through a series of callbacks
                    // and ends with a pushClient to update the auth page
                    getAccessToken(req.query["code"], hub);
                } else {
                    console.log( (ddbg()), "error - hub not found during authorization flow. hubId: ", hubId);
                    GLB.defhub = "-1";
                    rmsg = "";
                }
            } else {
                GLB.defhub = "-1";
                rmsg = "";
            }
            var $tc = getAuthPage(uname, req.headers.host, "/reauth", rmsg);

            res.send($tc);
            res.end();

        } else if ( req.path==="/reset") {
            readOptions("reset");
            allthings = {};
            getAllThings(true);
            res.send("Resetting...");
            res.end();

            // handle user provided get api calls
        } else if ( isquery ) {
            $tc = apiCall(queryobj, "GET", req, res);

        } else {
            var file = path.join(dir, req.path.replace(/\/$/, '/index.html'));
            if (file.indexOf(dir + path.sep) !== 0) {
                res.status(403).end('Forbidden');
            }
            if ( DEBUG1 ) {
                console.log( (ddbg()), " Loading module: ", req.path, " as: ", file);
            }
            var type = mime[path.extname(file).slice(1)] || 'text/plain';
            var s = fs.createReadStream(file);
            s.on('open', function () {
                res.set('Content-Type', type);
                // res.type(type)
                s.pipe(res);
            });
            s.on('error', function () {
                res.set('Content-Type', 'text/plain');
                res.status(404).end(req + ' Not found');
            });
        }
    });
    
    app.put('*', function(req, res) {
        console.log( (ddbg()), "PUT api calls are not supported. Use POST instead. Requested put: ", req.path);
        res.end();
    });

    // *********************************************************************************************
    // POST api calls are handled here including those sent from ST and HE hubs
    // to process changes made outside of HP
    // from SmartThings and Hubitat hubs this is done in the "changeHandler" function
    // found in the HousePanel.groovy application with this line
    //     postHub(state.directIP, state.directPort, "update", deviceName, deviceid, attr, value)
    // *********************************************************************************************
    
    app.post("/", function (req, res) {

        // handle two types of messages posted from hub
        // the first initialize type tells Node.js to update elements
        if ( req.body['msgtype'] === "initialize" ) {
            res.json('hub info updated');
            if ( DEBUG2 ) {
                console.log( (ddbg()), "New hub authorized; updating things in hpserver.");
            }
            getAllThings(true);
        
        // handle callbacks from ST and HE here
        // for ISY this is done via websockets above
        } else if ( req.body['msgtype'] === "update" ) {
            var msg = processHubMessage(req.body);
            if ( DEBUG19 ) {
                console.log( (ddbg()), "Received update msg from hub: ", req.body["hubid"], " body: ", req.body, " msg: ", msg);
            }
            res.json(msg);

        // handle all api calls upon the server from js client and external api calls here
        } else if ( typeof req.body['useajax']!=="undefined" || typeof req.body["api"]!=="undefined" ) {
            var result = apiCall(req.body, "POST", req, res);
            res.json(result);
        
        // handle unknown requests
        } else {
            console.log( (ddbg()), "hpserver received unknown message: ", req.body);
            res.json('hpserver received unknown message.');
        }

    });

    // set up sockets
    setupSockets();
}

// set up a MQTT connections to Polisy broker to listen in on Polyglot messages
// also use this to send debug notices about HousePanel to myself
// setup mqtt client
var udclient = null;
var polisyip = GLB.options.config["polisyip"] || "";

var hostname;
if ( os.hostname()==="polisy" && os.platform()==="freebsd" ) {
    hostname = "localhost";
} else if ( polisyip ) {
    hostname = polisyip;
} else {
    hostname = null;
}

if ( MQTTHP || MQTTPOLY ) {
    try {
        if ( hostname && fs.existsSync("ssl/polyglot.crt") && fs.existsSync("ssl/client.crt") && fs.existsSync("ssl/client_private.key") ) {
            var ca = fs.readFileSync("ssl/polyglot.crt");
            var cert = fs.readFileSync("ssl/client.crt");
            var key = fs.readFileSync("ssl/client_private.key");
            var udopts = {host: hostname, port: "1883",
                        ca: ca, cert: cert, key: key,
                        checkServerIdentity: () => { return null; },
                        rejectUnauthorized: false};
            udclient = mqtt.connect("mqtts://" + polisyip, udopts);
        } else if ( polisyip ) {
            udclient = mqtt.connect("mqtt://" + polisyip );
        }
    } catch (e) {
        console.log( (ddbg()), "Cannot establish MQTT connection. ", e);
        udclient = null;
    }
}

if ( udclient ) {
    udclient.on("message", function(topic, msg) {
        if ( topic.startsWith("udi/polyglot/frontend/nodeservers") ) {
            try {
                var frontend = JSON.parse(msg.toString());
                console.log( (ddbg()), topic,  " ", frontend.nodeservers.length + " nodeservers");
                frontend.nodeservers.forEach( function(node) {
                    console.log( (ddbg()), "slot: ", node.profileNum, " name: ", node.name, " file: ", node.homeDir + node.executable);
                });
            } catch(e) {
                console.log( (ddbg()), "error - trying to decipher MQTT message from polyglot frontend", e);
            }
        } else {
            if ( topic.startsWith("housepanel/") ) {
                console.log( (ddbg()), topic, "msg: ", msg.toString() );
            } else if ( topic.startsWith("udi/polyglot/") ) {
                var str = JSON.parse(msg.toString());
                console.log( (ddbg()), topic, "msg: ", JSON.stringify(str, null, 1) );
            } else {
                console.log( (ddbg()), "mqtt topic: ", topic, " msg: ", msg.toString() );
            }
        }
    });

    udclient.on("error", function(err) {
        console.log( (ddbg()), "UDI MQTT error: ", err);
    });

    udclient.on("connect", function() {
        if ( MQTTPOLY ) {
            udclient.subscribe("udi/#", {qos: 0}, function(err, granted) {
                if ( !err ) {
                    console.log( (ddbg()), "MQTT subscribed to: ", granted );
                    udclient.publish("udi", "UDI mqtt setup and listening...");
                } else {
                    console.log( (ddbg()), "UDI MQTT error subscribing to udi topic: ", err);
                }
            });
        }

        // lets also subscribe to our own HP publishing calls
        if ( MQTTHP ) {
            udclient.subscribe("housepanel/#", {qos: 0}, function(err, granted) {
                if ( !err ) {
                    console.log( (ddbg()), "MQTT subscribed to: ", granted );
                    udclient.publish("housepanel", "HousePanel mqtt setup and listening...");
                } else {
                    console.log( (ddbg()), "MQTT error subscribing to housepanel topic: ", err);
                }
            });
        }

        console.log( (ddbg()), "UDI mqtt status: ", udclient.connected);
    });
}
