"use strict";
process.title = 'hpserver';

// debug options
const DEBUG1 = false;               // basic debug info - file loading, hub loading
const DEBUGisy = false;             // ISY node return details
const DEBUG2 = false;               // authorization flow and ISY programs
const DEBUG3 = false;               // passwords
const DEBUG4 = false;               // filters and options
const DEBUG5 = false;               // hub node detail
const DEBUG6 = false;               // tile position moves
const DEBUG7 = false;               // hub responses
const DEBUGvar = false;             // ISY variables
const DEBUG8 = false;               // API calls
const DEBUG9 =  false;              // ISY webSocket success
const DEBUG9a = false;              // ISY webSocket details
const DEBUG10 = false;              // sibling tag
const DEBUG11 = false;              // rules
const DEBUG12 = false;              // hub push updates
const DEBUG13 = false;              // URL callbacks
const DEBUG14 = false;              // tile link details
const DEBUG15 = false;              // new user and forgot password
const DEBUG16 = false;              // customtiles writing and custom names
const DEBUG17 = false;              // push client
const DEBUG18 = false;              // ST, HE, and Ford messages in callHub -> getHubResponse
const DEBUG19 = false;              // ST and HE callback from Groovy or new ST Event Sink
const DEBUG19s = false;             // New ST sink message debug
const DEBUG20 = false;              // New SmartThings detail
const DEBUGcurl = false;            // detailed _curl inspection
const DEBUGtmp =  true;             // used to debug anything temporarily using ||

// various control options
const MQTTHP = false;                 // subscribe to and log HP via MQTT
const DONATE = false;                  // set this to true to enable donation section
const ENABLERULES = true;             // set this to false to neuter all rules
const FORDAPIVERSION = "2020-06-01";  // api version number to use for Ford api calls

// websocket and http servers
const webSocketServer = require('websocket').server;
const webSocketClient = require('websocket').client;
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js').parseString;
const crypto = require('crypto');
const UTIL = require('util');
const mqtt = require('mqtt');
const os = require('os');
const cookieParser = require('cookie-parser');
const request = require('request');
const url = require('url');
const nodemailer = require('nodemailer');
const countrytime = require('countries-and-timezones');

// load supporting modules
var utils = require("./utils");
var sqlclass = require("./mysqlclass");

// global variables are all part of GLB object
var GLB = {};

GLB.port = 3080;
GLB.webSocketServerPort = 8181;

GLB.defaultrooms = {
    "Kitchen": "clock|kitchen|sink|pantry|dinette" ,
    "Family": "clock|family|mud|fireplace|casual|thermostat",
    "Living": "clock|living|dining|entry|front door|foyer",
    "Office": "clock|office|computer|desk|work",
    "Bedroom": "clock|bedroom|kid|kids|bathroom|closet|master|guest",
    "Outside": "clock|garage|yard|outside|porch|patio|driveway|weather",
    "Music": "clock|sonos|music|tv|television|alexa|echo|stereo|bose|samsung|pioneer"
};

// set fixed name for event sinks and hub authorizations for New SmartThings
GLB.sinkalias = "house.panel.alpha.alias";
GLB.clientid = "140b41bb-a5d6-4940-8731-7382e9311b96";
GLB.clientsecret = "ed65ed1e-85a4-41ff-be49-3ed5cd2134e0";

// any attribute here will be ignored for events and display
// this now includes ignoring washer and robot crazy fields
GLB.ignoredAttributes = [
    'sensor', 'actuator', 'DeviceWatch-DeviceStatus', 'DeviceWatch-Enroll', 'checkInterval', 'healthStatus', 'devTypeVer', 'dayPowerAvg', 'apiStatus', 
    'yearCost', 'yearUsage','monthUsage', 'monthEst', 'weekCost', 'todayUsage', 'groupPrimaryDeviceId', 'groupId', 'presets',
    'maxCodeLength', 'maxCodes', 'readingUpdated', 'maxEnergyReading', 'monthCost', 'maxPowerReading', 'minPowerReading', 'monthCost', 'weekUsage', 'minEnergyReading',
    'codeReport', 'scanCodes', 'verticalAccuracy', 'horizontalAccuracyMetric', 'distanceMetric', 'closestPlaceDistanceMetric',
    'closestPlaceDistance', 'codeChanged', 'codeLength', 'lockCodes', 'horizontalAccuracy',
    'verticalAccuracyMetric', 'indicatorStatus', 'todayCost', 'previousPlace','closestPlace', 'minCodeLength',
    'arrivingAtPlace', 'lastUpdatedDt', 'custom.disabledComponents',
    'disabledCapabilities','enabledCapabilities','supportedCapabilities',
    'supportedPlaybackCommands','supportedTrackControlCommands','supportedButtonValues','supportedThermostatModes','supportedThermostatFanModes',
    'dmv','di','pi','mnml','mnmn','mnpv','mnsl','icv','washerSpinLevel','mnmo','mnos','mnhw','mnfv','supportedCourses','washerCycle','cycle'
];

// this map contains the base capability for each type and all valid commands for that capability
// the keys here are unique to HousePanel and are used to define the type of thing on the panel
GLB.capabilities = { 
    switch: [ ["switch"], ["_on","_off"]],
    switchlevel: [ ["switchLevel","switch"], ["_on","_off"]],
    bulb: [ ["colorControl","switch"],["_on","_off","color"]], 
    button: [ ["button"],null],
    presence: [ ["presenceSensor"],null], 
    motion: [ ["motionSensor"],null], 
    contact: [ ["contactSensor"],null], 
    door: [ ["doorControl"],["_open","_close"]], 
    garage: [ ["garageDoorControl"],["_open","_close"] ],
    dust: [ ["dustSensor"],null], 
    fanspeed: [ ["fanSpeed"],null],
    acceleration: [ ["accelerationSensor"],null], 
    airquality: [ ["airQualitySensor"],null], 
    alarm: [ ["alarm"],["_both","_off","_siren","_strobe"]], 
    illuminance: [ ["illuminanceMeasurement"],null],
    lock: [ ["lock"],["_unlock","_lock"]],
    thermostat: [ ["temperatureMeasurement","thermostatMode","thermostatHeatingSetpoint","thermostatCoolingSetpoint","thermostatOperatingState"],null],
                //   ["heatingSetpoint-up","heatingSetpoint-dn","coolingSetpoint-up","coolingSetpoint-dn"]], 
    temperature: [ ["temperatureMeasurement"],null], 
    power: [ ["powerMeter"],null],
    energy: [ ["energyMeter"],null],
    fan: [ ["fanSpeed"],null],
    smoke: [ ["smokeDetector"],null], 
    sound: [ ["soundSensor"],null], 
    tamper: [ ["tamperAlert"],null], 
    cosensor: [ ["carbonMonoxideMeasurement"],null], 
    co2sensor: [ ["carbonDioxideMeasurement"],null], 
    valve: [ ["valve"],["_open","_close"]], 
    weather: [ ["temperatureMeasurement","relativeHumidityMeasurement","stsmartweather.astronomicalData","illuminanceMeasurement","ultravioletIndex"],null],
    audio: [ ["mediaPlayback","audioVolume","audioMute"],["_previousTrack","_pause","_play","_stop","_nextTrack","_volumeDown","_volumeUp","_mute","_unmute"]], 
    shade: [ ["windowShade","switchLevel"],["_open","_close","_presetPosition"]], 
    tone: [ ["tone"],["_beep"]], 
    uvindex: [["ultravioletIndex"],null],
    voltage: [["voltageMeasurement"],null],
    washer: [ ["washerOperatingState","washerMode","switch"],["_on","_off","_pause","_run","_stop","_setWasherMode"]],
    vacuum: [ ["robotCleanerCleaningMode"],["_auto","_part","_repeat","_manual","_stop"]],
    water: [ ["waterSensor"],null]
    // , other: ["sensor",null], 
    // actuator: ["actuator",null] 
};

// list of capabilities that generate an event
GLB.trigger1 = [
    "audioMute", "audioVolume", "colorControl", "contactSensor", "doorControl",
    "lock", "motionSensor", "mediaInputSource", 
    "powerMeter", "presence", "switch", "switchLevel", 
    "windowShade", "windowShadeLevel"
];
GLB.trigger2 = [
    "thermostat", "thermostatSetpoint", "robotCleanerMovement", "robotCleanerCleaningMode",
    "temperatureMeasurement", "thermostatMode", "thermostatHeatingSetpoint", "thermostatCoolingSetpoint",
    "mediaTrackControl", "mediaPlayback", "audioTrackData",
    "illuminanceMeasurement", "smokeDetector", "valve", "waterSensor", "tvChannel"
];

// list of currently connected clients (users)
var clients = {};

// TODO - remove this once I update everything to the DB version
// array of all tiles in all hubs
// var allthings = {};

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

function jsonshow(obj) {
    return UTIL.inspect(obj, false, null, false);
}

function encodeURI2(str) {
    str = str.replace(/'/g,"");
    return encodeURI(str);
}

function decodeURI2(str) {
    return decodeURI(str);
}

function getConfigItem(configoptions, tag) {
    var result = null;
    configoptions.forEach(function(opt) {
        if ( opt.configkey === tag ) {
            result = opt.configval;
        }
    });

    // try converting to object
    if ( (result && typeof result === "string") || (tag==="useroptions" || tag==="specialtiles" || tag.startsWith("user_")) ) {
        var original = result;
        try {
            result = JSON.parse(result);
        } catch (e) {
            result = original;
        }
    }
    return result;
}

function addConfigItem(userid, key, value) {
    var updval = {userid, userid, configkey: key, configval: JSON.stringify(value)};
    return mydb.addRow("configs", updval)
    .then(result => {
        if ( result ) {
            updval.id = result.getAutoIncrementValue();
            return updval;
        } else {
            console.log( (ddbg()), "error - could not add configuration parameters for userid:", userid, " key:", key, " value:", value);
            return null;
        }
    });
}

// this function gets the user name and panel name that matches the hashes
async function getUserName(cookies) {
    // read user names from Database
    if ( is_object(cookies) && typeof cookies.uname==="string" ) {
        var uhash = cookies.uname;
    } else {
        uhash = null;
    }

    // if a panel is named then we use it, otherwise we use the first panel in the user record
    if ( is_object(cookies) && typeof cookies.pname==="string"  ) {
        var phash = cookies.pname;
    } else {
        phash = null;
    }

    // get all the users and check for one that matches the hashed email address
    // emails for all users must be unique
    var joinstr = mydb.getJoinStr("panels", "userid", "users", "id");
    var result = await mydb.getRows("panels", "*", "", joinstr)
    .then(rows => {
        var therow = null;
        if ( uhash && rows ) {
            for ( var i=0; i<rows.length; i++ ) {
                var row = rows[i];

                // if username hash matches uname hash or email hash and if panel name hash match then proceed
                if ( ( pw_hash(row["users_email"]) === uhash || pw_hash(row["users_uname"]) === uhash ) && 
                        ( pw_hash(row["panels_pname"]) === phash ) ) {
                    // var panelid = row["panels_id"];
                    // var pname = row["panels_pname"];
                    // var skin = row["panels_skin"];
                    // var userid = row["users_id"];
                    // var useremail = row["users_email"];
                    // var usertype = row["users_usertype"];
                    // result = {userid: userid, uname: useremail, panelid: panelid, pname: pname, skin: skin, usertype: usertype};
                    therow = row;
                    break;
                }
            }
        }
        return therow;
    }).catch(reason => {console.log("dberror 1 - getUserName - ", reason);});
    return result;
}

// TODO - use DB query on devices table
function getTypes() {
    // var thingtypes = [
    //     "actuator", "audio", "blank", "bulb", "button", "clock", "contact", "control", "custom", "door", "ford", "frame", "hsm", 
    //     "illuminance", "image", "isy", "lock", "mode", "momentary", "motion", "music", 
    //     "other", "piston", "power", "presence", "shade", "shm", "smoke", "switch", "switchlevel", "temperature", "thermostat", 
    //     "vacuum", "valve", "video", "washer", "water", "weather"
    // ];

    // add capabilities from the new SmartThings list
    var thingtypes = Object.keys(GLB.capabilities);

    // add unique things to HousePanel, ISY, Ford, and other hubs
    thingtypes.push("blank");
    thingtypes.push("custom");
    thingtypes.push("frame");
    thingtypes.push("image");
    thingtypes.push("video");
    thingtypes.push("control");
    thingtypes.push("momentary");
    thingtypes.push("actuator");
    thingtypes.push("sensor");
    thingtypes.push("other");
    thingtypes.push("clock");
    thingtypes.push("ford");
    thingtypes.push("isy");
    thingtypes.push("hsm");
    thingtypes.push("shm");
    thingtypes.push("mode");
    thingtypes.push("music");
    thingtypes.push("piston");

    thingtypes.sort();
    return thingtypes;
}

function readCustomCss(userid, pname) {
    // var fname = skin + "/customtiles.css";
    var fname = "user" + userid + "/" + pname + "/customtiles.css";
    var contents = fs.readFileSync(fname, 'utf8');
    return contents;
}

function writeCustomCss(userid, pname, str) {

    if ( typeof str === "undefined" ) {
        str = "";
    } else if ( typeof str !== "string" ) {
        str = str.toString();
    }

    // proceed only if there is a custom css file in this skin folder
    if ( userid && pname ) {
        var fname = "user" + userid + "/" + pname + "/customtiles.css";
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
            fs.writeFileSync(fname, fixstr, {encoding: "utf8", flag: opts});
            if ( DEBUG16 ) {
                console.log( (ddbg()), "custom CSS file saved to file:", fname, " of size: ", fixstr.length);
            }
        } catch (e) {
            console.log( (ddbg()), e);
            console.log( (ddbg()), "error - failed to save custom CSS file in panel folder: ", panel);
        }
    } else {
        console.log( (ddbg()), "custom CSS file not saved to file:", fname);
    }
}

function writeOptions() {
    console.log( (ddbg()), "error - writeOptions no longer supported");
    return;
}

function _curl(host, headers, nvpstr, calltype, callback) {
    const myURL = url.parse(host);
    if ( !calltype ) {
        calltype = "GET";
    }

    // add query string if given separately
    var formbuff;
    if ( nvpstr && (typeof nvpstr === "string" || typeof nvpstr === "number") ) {
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
            callback(errmsg, res, null);
        } else {
            console.log((ddbg()), e);
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
            if ( callback ) {
                callback(statusCode, res, totalbody);
            }
            if ( DEBUGcurl ) {
                console.log((ddbg()), "end of _curl message. status: ", statusCode, statusMsg, " body: ", totalbody);
            }
        });
    }

}

async function curl_call(host, headertype, nvpstr, formdata, calltype, callback) {
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
    await request(opts, callback);
}

function getHubInfo(hub, reload) {

    var access_token = hub.hubaccess;
    var clientId = hub.clientid;
    var clientSecret = hub.clientsecret;
    var endpt = hub.hubendpt;
    var hubindex = hub.id;
    var userid = hub.userid;
    if ( DEBUG2 ) {
        console.log( (ddbg()), "in getHubInfo - hubid: ", hub.hubid," id: ", hub.id);
    }
    
    // for legacy ST and Hubitat hubs we make a call to get hub name and other info
    if ( hub.hubtype==="SmartThings" || hub.hubtype==="Hubitat" ) {
        var namehost = endpt + "/gethubinfo";
        var header = {"Authorization": "Bearer " + access_token};
        var nvpreq = {"scope": "app", "client_id": clientId, "client_secret": clientSecret};
        curl_call(namehost, header, nvpreq, false, "POST", nameidCallback);

    // this branch is for New SmartThings and other hubs that don't need to get their name via a hub call
    } else {

        // set name and id if not given by user or returned by api
        if ( !hub["hubname"] ) {
            hub["hubname"]  = hub["hubtype"];
        }
        if ( hub.hubid==="new" || !hub.hubid ) {
            var rstr = getRandomInt(1001, 9999);
            hub["hubid"] = hub["hubyype"] + rstr.toString();
        }

        if ( DEBUG2 ) {
            console.log( (ddbg()), "getHubInfo - hub: ", UTIL.inspect(hub,false,null,false));
        }

        // save the hubid in our user default for use later
        mydb.updateRow("users",{defhub: hub.hubid},"id = "+userid)
        .then(result => {
            if ( DEBUG2 ) {
                console.log( (ddbg()), "update user to default hubid = ", hub.hubid, " result: ", result);
            }

            mydb.updateRow("hubs", hub, "userid = " + userid + " AND id = " + hubindex)
            .then( function(result) {

                if ( DEBUG2 ) {
                    console.log( (ddbg()), "update hubs result: ", result);
                }

                // now get all the devices
                getDevices(hub, reload, "/reauth");
            });

        });

    }

    function nameidCallback(err, res, body) {
        var jsonbody;
        var hubName = hub.hubname;;
        var access_token = hub.hubaccess;
        var endpt = hub.hubendpt;
        var hubId = hub.hubid;
        var endpt = hub.hubendpt;
        var hubindex = hub.id;
        var userid = hub.userid;
        if ( err ) {
            console.log( (ddbg()), "error - attempting to make hub name request.");
            return;
        }

        var iserror = false;
        try {
            jsonbody = JSON.parse(body);
            hubName = jsonbody["sitename"];
            hubId = jsonbody["hubId"];
            if ( DEBUG2 ) {
                console.log( (ddbg()), "hubName request return: ", jsonbody);
            }

            // save the hubid in our user default for use later
            mydb.updateRow("users",{defhub: hub.hubid},"id = " + userid);

        } catch(e) {
            console.log( (ddbg()), "error retrieving hub ID and name. ", e, "\n body: ", body);
            iserror = true;
            hubName = hub.hubname
            hubId = hub.hubid;
        }

        if ( DEBUG2 ) {
            console.log( (ddbg()), "hub info: access_token= ", access_token, " endpt= ", endpt, " hubName= ", hubName, " hubId= ", hubId);
        }

        // now save our info
        hub["hubname"]  = hubName;
        hub["hubid"] = hubId;

        // save the hubid in our user default for use later
        mydb.updateRow("users",{defhub: hub.hubid},"id = "+hub.userid);

        if ( DEBUG2 ) {
            console.log( (ddbg()), "Finished updating users. Ready to update hub: ", hubindex, hub);
        }

        if ( iserror || !hubindex ) {
            pushClient(userid, "reload", "auth", "/reauth");
        } else {
            // we know the actual index of the hub at this point
            mydb.updateRow("hubs", hub, "userid = " + userid+" AND id = "+hubindex)
            .then(result => {
                // retrieve all devices and go back to reauth page
                getDevices(hub, reload, "/reauth");
            }).catch(reason => {console.log("dberror 2 - nameidCallback - ", reason);});
        }
    }
}

function getAccessToken(userid, code, hub) {

    // these are the parameters determined here using a series of curl calls and callbacks
    var access_token = "";
    var endpt = "";
    var refresh_token = "";
    var hubType = hub["hubtype"];
    var hubName = hub["hubname"];
    var hubHost = hub["hubhost"];
    var clientId = hub["clientid"];
    var clientSecret = hub["clientsecret"];

    var redirect = GLB.returnURL + "/oauth";
    var header = {'Content-Type' : "application/x-www-form-urlencoded"};

    // Ford and Lincoln tokens
    if ( hubType === "Ford" || hubType === "Lincoln" ) {
        endpt = "https://api.mps.ford.com/api/fordconnect/vehicles/v1";
        var policy = "B2C_1A_signup_signin_common";
        if ( hub.hubtype==="Lincoln" ) {
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
        curl_call(tokenhost, header, nvpreq, formData, "POST", fordCallback);

    // new SmartThings function to get accesstoken and refreshtoken
    } else if ( hubType === "NewSmartThings" ) {
        endpt = hubHost;
        // var nohttp = hubHost.substr(8);
        var nohttp = "api.smartthings.com";
        tokenhost = "https://" + clientId + ":" + clientSecret + "@" + nohttp + "/oauth/token";
        // var nvpreq = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
        //               "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};
        var nvpreq = "grant_type=authorization_code&code=" + code + "&client_id=" + clientId + 
                     "&client_secret=" + clientSecret + "&redirect_uri=" + encodeURI(redirect);
        if ( DEBUG2 ) {
            console.log( (ddbg()), "calling with nvpreq: ", nvpreq);
        }
        _curl(tokenhost, header, nvpreq, "POST", tokenCallback);

    // ST and HE functions to get accesstoken and endpoint
    } else {
        tokenhost = hubHost + "/oauth/token";
        var nvpreq = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
                      "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};
        if ( DEBUG2 ) {
            console.log( (ddbg()), "obtaining accesstoken by calling host: ", tokenhost, " with nvpreq: ", nvpreq);
        }
        curl_call(tokenhost, header, nvpreq, false, "POST", tokenCallback);
        // _curl(tokenhost, header, nvpreq, "POST", tokenCallback);
    }

    function fordCallback(err, res, body) {
        var jsonbody = JSON.parse(body);
        access_token = jsonbody["access_token"] || "";
        refresh_token = jsonbody["refresh_token"] || "";
        var newexpire = jsonbody["expires_in"] || "";

        var expiresin;        
        if ( hub.hubtimer && hub.hubtimer!=="0" && !isNaN(parseInt(hub.hubtimer)) ) {
            expiresin = parseInt(hub.hubtimer);
        } else {
            expiresin = "";
        }
    
        // if an expire in is returned from api then set hubTimer to it minus two minutes
        if ( newexpire  && !isNaN(parseInt(newexpire)) && parseInt(newexpire)>120 ) {
            expiresin = (parseInt(newexpire) - 120) * 1000;
            hub.hubtimer = expiresin.toString();
        }
        endpt = "https://api.mps.ford.com/api/fordconnect/vehicles/v1";

        if ( access_token && refresh_token ) {
            if ( DEBUG2 ) {
                console.log( (ddbg()),"Ford access_token: ", access_token, " refresh_token: ", refresh_token, " endpoint: ", endpt);
            }

            // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
            if ( expiresin ) {
                setTimeout( function() {
                    console.log( (ddbg()), "Ford access_token will be refreshed in ", expiresin," msec");
                    fordRefreshToken(hub, access_token, endpt, refresh_token, clientId, clientSecret, true);
                }, expiresin);
            }
            hub.hubaccess = access_token;
            hub.hubrefresh = refresh_token;
            hub.hubendpt = endpt;

            // note - for Ford API the hubId must be provided by the user and match the Ford App ID assigned to them

            getHubInfo(hub, true);

        } else {
            console.log( (ddbg()), "fordCallback error authorizing " + hub.hubtype + " hub. bad access_token: ", access_token, " or endpt: ", endpt, " or refresh: ", refresh_token, " err: ", err, "\n body: ", body);
            pushClient(userid, "reload", "auth", "/reauth");
        }
    }

    function tokenCallback(err, res, body) {
        // save the access_token
        try {
            var jsonbody = JSON.parse(body);
        } catch(e) {
            jsonbody = null;
        }
        if ( DEBUG2 ) {
            console.log( (ddbg()), hubType + " access_token return: ", jsonbody);
        }

        if ( (err && err!==200) || ( jsonbody && typeof jsonbody==="object" && jsonbody["error"]) ) {
            console.log( (ddbg()), "error authorizing ", hubType, " hub: ", hubName, " error: ", err, jsonbody["error"]);
            console.log( (ddbg()), "calling params: ", nvpreq, " body: ", body );
            pushClient(userid, "reload", "auth", "/reauth");

        } else if ( is_object(jsonbody) && jsonbody["access_token"] ) {
            access_token = jsonbody["access_token"];
            refresh_token = "";
            if (access_token) {
                var ephost;
                if ( hubType==="SmartThings" ) {
                    hub.hubaccess = access_token;
                    hub.hubrefresh = "";
                    header = {"Authorization": "Bearer " + access_token};
                    ephost = hubHost + "/api/smartapps/endpoints";
                    curl_call(ephost, header, false, false, "GET", endptCallback);
                } else if ( hubType ==="Hubitat" ) {
                    hub.hubaccess = access_token;
                    hub.hubrefresh = "";
                    header = {"Authorization": "Bearer " + access_token};
                    ephost = hubHost + "/apps/api/endpoints";
                    curl_call(ephost, header, false, false, "GET", endptCallback);
                } else if ( hubType ==="NewSmartThings" ) {
                    refresh_token = jsonbody["refresh_token"];
                    hub.hubaccess = access_token;
                    hub.hubrefresh = refresh_token;
                    hub.hubendpt = hubHost;
                    hub.hubtype = hubType;
                    // hub["sinkFilterId"] = "";
                    if ( !hub.hubname ) {
                        hub.hubname = hub.hubtype;
                    }

                    // we can safely ignore the legacy device_id field
                    hub.hubid = jsonbody["installed_app_id"];
                    var expiresin = jsonbody["expires_in"];

                    // convert refresh token from seconds to msec and two minutes before expiration
                    expiresin = (parseInt(expiresin) - 3600) * 1000;
                    hub.hubtimer = expiresin.toString();

                    if ( DEBUG2 ) {
                        console.log( (ddbg()),"tokenCallback: New SmartThings access_token: ", access_token, " refresh_token: ", refresh_token, 
                                              " endpoint: ", endpt, " expiresin: ", expiresin);
                    }

                    // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
                    if ( expiresin ) {
                        setTimeout( function() {
                            newSTRefreshToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, true, null);
                        }, expiresin);
                    }

                    // register the sinks to cause events to come back to me
                    newSTRegisterEvents(hub);

                    // save our info - could skip this and save options and reload screen
                    getHubInfo(hub, true);

                } else {
                    console.log( (ddbg()), "Invalid hub type: ", hubType, " in access_token request call");
                    pushClient(userid, "reload", "auth", "/reauth");
                    return;
                }

            }
        } else {
            console.log( (ddbg()), "Unknown error authorizing hub: ", hubName, " error: ", err, " body: ", body);
            pushClient(userid, "reload", "auth", "/reauth");
        }
    }
    
    function newSTRegisterEvents(hub) {

        var host = hub.hubendpt + "/sink-filters";
        const filterName = "HousePanel.Sink.Filter";
        var header = {
            "Authorization": "Bearer " + hub.hubaccess,
            "Content-Type": "application/json",
            "Accept": "application/vnd.smartthings+json;v=20200812"
        };

        // get all existing sinks and
        // check for a prior registration tied to our sink and this hub
        _curl(host, header, null, "GET", function(err, res, body) {
            if (err && err !== 200) { 
                console.log((ddbg()), "error - attempting to check for previously registered sink events: ", err);
            } else {
                console.log((ddbg()), "Sink listing returned: ", body);

                var sinkexist = false;
                for (var i in body) {
                    var sink = body[i];
                    if ( sink.filterName === filterName ) {
                        sinkexist = true;
                    }
                }

                // now that we know if a sink doesn't exist, let's add one
                if ( !sinkexist ) {
                    regNewFilter();
                }
            }
        });

        function regNewFilter() {

            // gather all the capability events as groups
            // for now just get a few categories to limit things
            var qitem1 = [
                {"field": "deviceEvent.capability", "value": GLB.trigger1, "operator": "IN"},
                {"field": "deviceEvent.stateChange", "value": true, "operator": "EQ"}
            ];
            var qitem2 = [
                {"field": "deviceEvent.capability", "value": GLB.trigger2, "operator": "IN"},
                {"field": "deviceEvent.stateChange", "value": true, "operator": "EQ"}
            ];
            var qgroups = [
                {queryItems: qitem1}, 
                {queryItems: qitem2} 
            ];

            // set up event sinks for the new ST app
            // this uses the sink provided by ST staff
            var sinkdata = {
                filterName: filterName,
                forEntity: { entityType: "INSTALLEDAPP", entityId: hub.hubid},
                sink: GLB.sinkalias,
                query: {queryGroups: qgroups}
            };

            header = {
                "Authorization": "Bearer " + hub.hubaccess,
                "Content-Type": "application/json",
                "Accept": "application/vnd.smartthings+json;v=20200812"
            };

            _curl(host, header, sinkdata, "POST", function(err, res, body) {
                if ( err && err !== 200 ) {
                    // hub["sinkFilterId"] = "";
                    console.log((ddbg()), "error in registerEvents: ", err);
                } else {
                    // save the filter ID for use in confirming events for this user
                    try {
                        var jsonbody = JSON.parse(body);
                        // hub["sinkFilterId"] = jsonbody["sinkFilterId"];
                        if ( DEBUG2 ) {
                            console.log( (ddbg()), "registerEvents result: ", UTIL.inspect(jsonbody, false, null, false));
                        }
                    } catch(e) {
                        // hub["sinkFilterId"] = "";
                        console.log( (ddbg()), "error in registerEvents: ", body);
                    }
                }
            });
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
            console.log( (ddbg()), "getEndpoint error authorizing " + hub.hubtype + " hub.\n error: ", err, "\n JSON body: ", body);
            pushClient(userid, "reload", "auth", "/reauth");
        } else {
            var endptzero = jsonbody[0];
            endpt = endptzero.uri;
        }

        if ( access_token && endpt ) {
            if ( DEBUG2 ) {
                console.log( (ddbg()),"endptCallback - access_token: ", access_token," endpoint: ", endpt);
            }
            hub.hubaccess = access_token;
            hub.hubendpt = endpt;
            getHubInfo(hub, true);

        } else {
            console.log( (ddbg()), "getEndpoint error authorizing " + hub.hubtype + " hub. bad access_token: ", access_token, " or endpt: ", endpt);
            pushClient(userid, "reload", "auth", "/reauth");
        }
    }
}


function newSTRefreshToken(userid, hub, refresh_token, clientId, clientSecret, refresh, postCallback) {
    // var nohttp = hub.hubhost.substr(8);
    var nohttp = "api.smartthings.com";
    var header = {'Content-Type' : "application/x-www-form-urlencoded"};
    var tokenhost = "https://" + clientId + ":" + clientSecret + "@" + nohttp + "/oauth/token";
    var nvpreq = "grant_type=refresh_token" + "&client_id=" + clientId + 
                 "&refresh_token=" + refresh_token;
     if ( DEBUG2 ) {
        console.log( (ddbg()), "Refreshing ST token via call with nvpreq: ", nvpreq);
    }

    _curl(tokenhost, header, nvpreq, "POST", function(err, res, body) {
        if ( err && err !== 200 ) {
            if ( postCallback && typeof postCallback === "function" ) {
                postCallback("_curl error status = " + err.toString());
            }
            return;
        }

        try {
            var jsonbody = JSON.parse(body);
        } catch(e) {
            var errmsg = "error - attempting parsing JSON from refresh of new ST token";
            console.log( (ddbg()), errmsg, "\n", e, "\n body: ", body);
            // if we requested a post hub updated callback do it with an error message
            if ( postCallback && typeof postCallback === "function" ) {
                postCallback(errmsg);
            }
            return;
        }

        // save our refreshed values
        hub.hubaccess = jsonbody["access_token"];
        hub.hubrefresh = jsonbody["refresh_token"];
        
        // handle refresh expiration times
        var newexpire = jsonbody["expires_in"];
        var expiresin;
        if ( newexpire  && !isNaN(parseInt(newexpire)) && parseInt(newexpire) > 3600 ) {
            expiresin = (parseInt(newexpire) - 3600) * 1000;
        } else {
            expiresin = (23 * 3600000);
        }
        hub.hubtimer = expiresin.toString();

        if ( DEBUG2 ) {
            console.log( (ddbg()),"New SmartThings refresh results. access_token: ", hub.hubaccess, " refresh_token: ", hub.hubrefresh, " expiresin: ", expiresin, " jsonbody: ", jsonbody, " hub: ", hub);
        }

        // now update the hub info in our DB
        mydb.updateRow("hubs", hub, "userid = "+userid+" AND id = "+hub.id)
        .then(result => {
            // if we provided a callback to do something after hub updates, do it
            // but send back null if the update failed for whatever reason
            if ( postCallback && typeof postCallback === "function" ) {
                if ( result ) {
                    postCallback(null);
                } else {
                    postCallback("error - hub update to DB failed");
                }
            }
        })

        // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
        if ( refresh && hub.hubtimer ) {
            setTimeout( function() {
                newSTRefreshToken(userid, hub, hub.hubrefresh, clientId, clientSecret, true, null);
            }, expiresin);
        }

    });

}


// handle refresh tokens which happens over and over again
function fordRefreshToken(hub, access_token, endpt, refresh_token, clientId, clientSecret, refresh) {

    var header = {'Content-Type' : "application/x-www-form-urlencoded"};
    var policy = "B2C_1A_signup_signin_common";
    if ( hub.hubtype==="Lincoln" ) {
        policy = policy + "_Lincoln";
    }
    var tokenhost = "https://dah2vb2cprod.b2clogin.com/914d88b1-3523-4bf6-9be4-1b96b4f6f919/oauth2/v2.0/token";
    var nvpreq = "p=" + policy;
    var formData = {"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": clientId, "client_secret": clientSecret};

    if ( DEBUG2 ) {
        console.log( (ddbg()), "clientId, clientSecret: ", clientId, clientSecret);
        console.log( (ddbg()), "tokenhost: ", tokenhost, " nvpreq: ", nvpreq, " formData: ", formData);
    }
    var expiresin;
    if ( hub.hubtimer && hub.hubtimer!=="0" && !isNaN(parseInt(hub.hubtimer)) ) {
        expiresin = parseInt(hub.hubtimer);
    } else {
        expiresin = "";
    }

    curl_call(tokenhost, header, nvpreq, formData, "POST", function(err, res, body) {
        try {
            var jsonbody = JSON.parse(body);
            access_token = jsonbody["access_token"] || "";
            refresh_token = jsonbody["refresh_token"] || "";
            var newexpire = jsonbody["expires_in"] || "";
            
            // save the updated tokens
            if ( access_token && refresh_token ) {
                hub["hubaccess"] = access_token;
                hub["hubrefresh"] = refresh_token;
                
                // if an expire in is returned from api then set hubTimer to it minus two minutes
                // but only is user refresh is zero or not a number
                if ( expiresin==="" && newexpire  && !isNaN(parseInt(newexpire)) && parseInt(newexpire)>120 ) {
                    expiresin = (parseInt(newexpire) - 120) * 1000;
                    hub.hubtimer = expiresin.toString();
                }
                writeOptions();

                // get vehicles again and reload main page if requested with new token
                // getDevices(hub, reload, "/");
            }

            if ( DEBUG2 ) {
                console.log( (ddbg()),"Refresh return... access_token: ", access_token, 
                "\n refresh_token: ", refresh_token, "\n expiresin: ", expiresin, "\n endpoint: ", endpt, "\n body: ", body);
            }

            if ( refresh && expiresin ) {
                setTimeout( function() {
                    fordRefreshToken(hub, access_token, endpt, refresh_token, clientId, clientSecret, true);
                }, expiresin);
            }
        
        } catch(e) {
            // primary token needs to be redone - the refresh token has expired
            // TODO - find a graceful way to tell the user
            console.log( (ddbg()), "refresh token error for hub: ", hub.hubtype, " access_token: ", access_token, 
            "\n refresh_token: ", refresh_token, "\n expiresin: ", expiresin, "\n endpoint: ", endpt, "\n body: ", body);
        }

    });

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

function getDevices(hub, reload, reloadpath) {

    if ( DEBUG1 ) {
        console.log( (ddbg()), "getDevices debug - hub: ", hub);
    }
    var hubindex = hub.id;
    var userid = hub.userid;
    var hubnum = hub.hubid;
    var hubid = hub.hubid;
    var hubType = hub.hubtype;
    var hubAccess  = hub.hubaccess;
    var hubEndpt = hub.hubendpt;
    var clientId = hub.clientid;
    var clientSecret = hub.clientsecret;
    var hubName = hub.hubname;
    var updated = false;
    var hubRefresh  = hub.hubrefresh;
    var hubTimer = hub.hubtimer;
    var result = null;

    if ( !hubindex ) {
        console.log( (ddbg()), "error - hub index not found in DB");
        pushClient(userid, "reload", "reauth", reloadpath);
    }

    // retrieve all things from ST or HE
    if ( hubType==="SmartThings" || hubType==="Hubitat" ) {
        var result = getGroovyDevices();

    } else if ( hubType==="NewSmartThings") {
        result = getNewSmartDevices();

    // retrieve all things from ISY
    } else if ( hubType==="ISY" ) {
        result = getIsyDevices();
    
    // retrieve all things from Ford of Lincoln
    } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
        result = getFordVehicles();

    } else {
        console.log( (ddbg()), "error - attempt to read an unknown hub type= ", hubType);
        pushClient(userid, "reload", "reauth", reloadpath);
    }

    return result;

    // legacy ST and Hubitat call to Groovy API
    function getGroovyDevices() {
        var stheader = {"Authorization": "Bearer " + hubAccess};
        var params = {client_secret: clientId,
                      scope: "app",
                      client_id: clientSecret};
        curl_call(hubEndpt + "/getallthings", stheader, params, false, "POST", hubInfoCallback);
    }

    // implement logic using new ST api
    function getNewSmartDevices() {
        var stheader = {"Authorization": "Bearer " + hubAccess};

        // first get all the devices
        var doneNewST = {};
        for ( var swtype in GLB.capabilities ) {
            doneNewST[swtype] = false;
        }

        for ( var swtype in GLB.capabilities ) {
            var caparray = GLB.capabilities[swtype];

            // get the list of capabilities this device must have to show up
            // note this approach will 
            var thecapabilityList = caparray[0];
            var params = "";

            // create the "and" filter for the devices to get
            thecapabilityList.forEach(function(thecapability) {
                if ( params ) { params+= "&"; }
                params+= "capability="+thecapability;
            });

            if ( DEBUG2 ) {
                console.log( (ddbg()), "inside getNewSmartDevices and type: ", swtype," params: ", params);
            }

            switch (swtype) {
                case "switch" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("switch", userid, hubindex, err, res, body);
                    });
                    break;

                case "switchlevel" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("switchlevel", userid, hubindex, err, res, body);
                    });
                    break;

                case "bulb" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("bulb", userid, hubindex, err, res, body);
                    });
                    break;

                case "power" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("power", userid, hubindex, err, res, body);
                    });
                    break;

                case "button" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("button", userid, hubindex, err, res, body);
                    });
                    break;

                case "presence" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("presence", userid, hubindex, err, res, body);
                    });
                    break;

                case "motion" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("motion", userid, hubindex, err, res, body);
                    });
                    break;

                case "contact" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("contact", userid, hubindex, err, res, body);
                    });
                    break;

                case "door" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("door", userid, hubindex, err, res, body);
                    });
                    break;

                case "lock" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("lock", userid, hubindex, err, res, body);
                    });
                    break;

                case "thermostat" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("thermostat", userid, hubindex, err, res, body);
                    });
                    break;

                case "temperature" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("temperature", userid, hubindex, err, res, body);
                    });
                    break;

                case "illuminance" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("illuminance", userid, hubindex, err, res, body);
                    });
                    break;

                case "water" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("water", userid, hubindex, err, res, body);
                    });
                    break;

                case "valve" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("valve", userid, hubindex, err, res, body);
                    });
                    break;

                case "smoke" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("smoke", userid, hubindex, err, res, body);
                    });
                    break;
    
                case "audio" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("audio", userid, hubindex, err, res, body);
                    });
                    break;

                case "shade" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("shade", userid, hubindex, err, res, body);
                    });
                    break;
    
                case "weather" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("weather", userid, hubindex, err, res, body);
                    });
                    break;

                case "washer" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("washer", userid, hubindex, err, res, body);
                    });
                    break;

                case "vacuum" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("vacuum", userid, hubindex, err, res, body);
                    });
                    break;
    
                case "other" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("other", userid, hubindex, err, res, body);
                    });
                    break;
    
                case "actuator" :
                    curl_call(hubEndpt + "/devices", stheader, params, false, "GET", async function(err, res, body) {
                        await newSTCallback("actuator", userid, hubindex, err, res, body);
                    });
                    break;

                default:
                    checkNewSTDone(swtype);
                    break;
            }

        }

        // now get all the scenes
        // curl_call(hubEndpt + "/scenes", stheader, false, false, "GET", newSTCallback);

        // if ( updated ) {
        //     writeOptions();
        // }

        // signal clients to reload
        // if ( reload && reloadpath) {
        //     pushClient(userid, "reload", "auth", reloadpath);
        // }

        function checkNewSTDone(thetype) {

            if ( thetype ) {
                doneNewST[thetype] = true;
                if ( DEBUG20 ) {
                    console.log( (ddbg()), "finished reading newST type: ", thetype);
                }
            }

            var alldone = true;
            for ( var cap in GLB.capabilities ) {
                if ( !doneNewST[cap] ) {
                    alldone = false;
                }
            }

            // if we are all done then we can reload our auth page
            if ( alldone ) {
                if ( DEBUG20 ) {
                    console.log( (ddbg()), "finished reading all newST types");
                }
                updateOptions(userid, reload, reloadpath);
            }
        }

        function newSTCallback(swtype, userid, hubindex, err, res, body) {
            try {
                var jsonbody = JSON.parse(body);
            } catch (e) {
                console.log( (ddbg()), "error translating devices", e);
                console.log( (ddbg()), "body: ", body);
                checkNewSTDone(swtype);
                return;
            }
            var items = jsonbody.items;
            if ( ! is_array(items) || items.length===0 ) {
                checkNewSTDone(swtype);
                return;
            }

            // var requestedcap = GLB.capabilities[swtype];
            var caparray = GLB.capabilities[swtype];
            var capabilitiesList = caparray[0];
            var commands = caparray[1];

            // keep track of how many devices complete
            var devicecnt = 0;
            var numdevices = items.length;

            // read each device of this type
            items.forEach(function(device) {

                var pname = device.label;
                pname = pname.replace(/'/g,"");
                var pvalue = {name: pname};
                var st_type = device.type;
                var deviceid = device.deviceId;
                
                // handle Groovy device types
                if ( st_type==="DTH" ) {
                    var dth = device.dth;
                    pvalue["deviceType"] = dth.deviceTypeName;
                    pvalue["localExec"] = dth.executingLocally;
                    if ( dth.installedGroovyAppId ) {
                        pvalue["appId"] = dth.installedGroovyAppId;
                    }
                    
                } else if ( st_type==="ENDPOINT_APP" ) {
                    var stapp = device.app;
                    pvalue["appId"] = stapp.installedAppId;
                    pvalue["externalId"] = stapp.externalId;
                    pvalue["profileId"] = stapp.profile.id;
                }

                // now get the device details
                // curl_call(hubEndpt + "/devices/" + device.deviceId+"/status", stheader, params, false, "GET", function(err, res, bodyStatus) {
                _curl(hubEndpt + "/devices/" + deviceid+"/status", stheader, null, "GET", function(err, res, bodyStatus) {

                    if ( err && err !== 200 ) {
                        jsonStatus = null;
                        return;
                    }

                    try {
                        var jsonStatus = JSON.parse(bodyStatus);
                    } catch (e) {
                        console.log( (ddbg()), "error translating device status", e, " body: ", bodyStatus);
                        jsonStatus = null;
                        return;
                    }

                    // get all the components - this will typically only have "main"
                    var subid;
                    if ( jsonStatus && jsonStatus.components && is_object(jsonStatus.components) ) {
                        for ( var complabel in jsonStatus.components ) {
                            // go through the capabilities
                            var capabilities = jsonStatus.components[complabel];

                            for ( var cap in capabilities ) {
                                
                                // only pull the fields for this specific capability for switches, illuminance, and temperature
                                // or all fields for sensor and actuator - also always get the battery and switch
                                // if we are not reading a switch or illuminance or temperature then get all fields
                                // if ( swtype==="other" || swtype==="actuator" || cap==="battery" || capabilitiesList.includes(cap) ) {
                                if ( swtype==="other" || swtype==="actuator" || cap==="battery" || capabilitiesList.includes(cap) || true ) {

                                    // go through the attributes
                                    var attributes = capabilities[cap];
                                    for ( var attr in attributes ) {

                                        if ( ! GLB.ignoredAttributes.includes(attr ) ) {

                                            // set subid which is usually just the attribute
                                            // but if we are not in the main capability adjust to include component as a prefix
                                            // also use the main attribute if it wasn't defined already
                                            if ( complabel==="main" || typeof pvalue[attr]==="undefined" ) {
                                                subid = attr;
                                            } else {
                                                subid = complabel+"_"+attr;
                                            }
        
                                            if ( typeof attributes[attr]["value"]!=="undefined" && attributes[attr]["value"]!==null ) {
                                                for ( var othersub in attributes[attr] ) {
                                                    if ( othersub==="value" ) {
                                                        pvalue[subid] = attributes[attr]["value"];
                                                        
                                                        if ( swtype==="bulb" && (subid==="hue" || subid==="saturation" || subid==="level" ) ) {
                                                            var h = pvalue.hue || 0;
                                                            var s = pvalue.saturation || 0;
                                                            var l = pvalue.level || 50;
                                                            pvalue.color = utils.hsv2rgb(h, s, l);
                                                        }
                                                    } else if ( othersub === "timestamp" ) {
                                                        if ( pvalue["event_3"] ) { pvalue["event_4"] = pvalue["event_3"]; }
                                                        if ( pvalue["event_2"] ) { pvalue["event_3"] = pvalue["event_2"]; }
                                                        if ( pvalue["event_1"] ) { pvalue["event_2"] = pvalue["event_1"]; }
                                                        pvalue["event_1"] = attributes[attr]["value"] + " " + attributes[attr][othersub];
                                                    } else if ( othersub === "unit" ) {
                                                        pvalue["uom_"+subid] = attributes[attr]["unit"];
                                                    } else if ( othersub === "data" ) {
                                                        try {
                                                            var otherobj = JSON.parse(attributes[attr][othersub]);
                                                            for ( var datasubid in otherobj ) {
                                                                if ( typeof pvalue[datasubid]==="undefined" ) {
                                                                    pvalue[datasubid] = otherobj[datasubid];
                                                                } else {
                                                                    pvalue["data_"+datasubid] = otherobj[datasubid];
                                                                }
                                                            }
                                                        } catch (e) {
                                                        }
                                                    } else {
                                                        console.log(">>>> ignoring othersub=", othersub," for type=",swtype," val=", attributes[attr][othersub]);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // add commands
                    if ( commands ) {
                        for ( var i in commands ) {
                            var csubid = commands[i];
                            if ( csubid.substr(0,1)==="_" ) {
                                pvalue[csubid] = csubid.substr(1);
                            } else {
                                pvalue[csubid] = "";
                            }
                        }
                    }

                    // for audio add placeholders for album info and art if not there
                    if ( swtype === "audio" && pvalue.deviceType && pvalue.deviceType.startsWith("LAN Sonos") && !pvalue.audioTrackData ) {
                        pvalue.audioTrackData = {
                            title: "",
                            artist: "",
                            album: "",
                            albumArtUrl: '<img width="120" height="120" src="media/Electronics/electronics13-icn@2x.png"></img>',
                            mediaSource: "Sonos"
                        };
                    }

                    // // get the health state info
                    // for ( var subid in jsonStatus.healthState ) {
                    //     pvalue[subid] = jsonStatus.healthState[subid];
                    // }
                    if ( DEBUG20 ) {
                        console.log( (ddbg()), "New SmartThings device type: ", swtype, " pvalue: ", pvalue);
                    }

                    var pname = pvalue.name;
                    pvalue = encodeURI2(JSON.stringify(pvalue));
                    var rowdevice = {
                        userid: userid,
                        hubid: hubindex,
                        deviceid: deviceid,
                        name: pname, 
                        devicetype: swtype,
                        hint: hubType, 
                        refresh: "normal",
                        pvalue: pvalue
                    };
                        
                    mydb.updateRow("devices", rowdevice, "userid = "+userid+" AND hubid = "+hubindex+
                        " AND devicetype = '"+swtype+"' AND deviceid = '"+deviceid+"'")
                    .then(result => {
                        devicecnt++;

                        // check if this is our last one
                        if ( devicecnt >= numdevices ) {
                            if ( DEBUG20 ) {
                                console.log( (ddbg()), "new ST numdevices = ", numdevices);
                            }
                            checkNewSTDone(swtype);
                        }
                    }).catch(reason => {console.log("dberror 5 - newSTCallback - ", reason);});
                    
                });  // end of this device node detail curl callback
            

            }); // end of all devices of this type

            // save options if we updated them above
            // if ( updated ) {
            //     writeOptions();
            // }

            // signal clients to reload
            // if ( reload && reloadpath) {
            //     pushClient(userid, "reload", "auth", reloadpath);
            // }
                    
        }  // end of getNewSmartDevices callback

    } // end of new ST 

    // callback for loading ST and HE hub devices
    function hubInfoCallback(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "error retrieving devices: ", err);
            updateOptions(userid, reload, reloadpath);
        } else {
            try {
                var jsonbody = JSON.parse(body);
            } catch (e) {
                console.log( (ddbg()), "error translating devices. body: ", body, " error: ", e);
                return;
            }

            if (DEBUG1) {
                console.log( (ddbg()), "Retrieved ", jsonbody.length, " things from hub: ", hub);
            }    

            // configure returned array with the "id"
            var devicecnt = 0;
            if (jsonbody && is_array(jsonbody) ) {

                var numdevices = jsonbody.length;

                // now add them one at a time until we have them all
                jsonbody.forEach(function(content) {
                    var thetype = content["type"];
                    var deviceid = content["id"];
                    var origname = content["name"] || "";
                    var pvalue = content["value"];
                    var hint = hubType;
                    var refresh = "normal";
                    
                    // if a name isn't there use master name
                    if ( !pvalue.name && !origname ) {
                        origname = "unknown";
                        pvalue.name = origname;
                    } else if ( !pvalue.name ) {
                        pvalue.name = origname;
                    } else if (!origname ) {
                        origname = pvalue.name;
                    }
                    origname = origname.replace(/'/g, "");
                    
                    // deal with presence tiles
                    if ( thetype==="presence" && pvalue["presence"]==="not present" ) {
                        pvalue["presence"] = "absent";
                    }
                    // handle audio tiles
                    if ( thetype==="audio" ) {
                        pvalue = translateAudio(pvalue);
                    } else if ( thetype==="music" ) {
                        pvalue = translateMusic(pvalue);
                    } else if ( thetype==="weather" ) {
                        pvalue = translateWeather(origname, pvalue);
                    }

                    // remove ignored items from pvalue
                    for (var field in pvalue) {
                        if ( GLB.ignoredAttributes.includes(field) || field.startsWith("supportedWasher") ) {
                            console.log(">>>> ignoring: ", field);
                            delete pvalue[field];
                        }
                    }

                    var pvalstr = encodeURI2(JSON.stringify(pvalue));
                    var device = {userid: userid, hubid: hubindex, deviceid: deviceid, name: origname, 
                        devicetype: thetype, hint: hint, refresh: refresh, pvalue: pvalstr};
                    
                    mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+
                                                      " AND devicetype = '"+thetype+"' AND deviceid = '"+deviceid+"'")
                    .then(result => {
                        devicecnt++;

                        // check if this is our last one
                        if ( devicecnt >= numdevices ) {
                            updateOptions(userid, reload, reloadpath);
                        }
                    }).catch(reason => {console.log("dberror 6 - hubInfoCallback - ", reason);});
                });

            } else {
                updateOptions(userid, reload, reloadpath);
            }
        }
    }

    async function getFordVehicles() {

        // now we call vehicle information query to get vehicle ID
        // API version is a defined constant at front of code
        var header = {
            "Authorization": "Bearer " + hubAccess,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-version": FORDAPIVERSION,
            "Application-Id": hub.hubid,
        };
        var endpt = hub.hubendpt;
        curl_call(endpt, header, false, false, "GET", vehicleInfoCallback);

    }

    function vehicleInfoCallback(err, res, body) {

        try {
            var jsonbody = JSON.parse(body);
        } catch(e) {
            console.log(e, " body: ", body);
            pushClient(userid, "reload", "main", reloadpath);
            return;
        }
        var thetype = "ford";

        if ( jsonbody.status === "SUCCESS" && array_key_exists("vehicles", jsonbody) && is_array(jsonbody.vehicles) ) {
            var numdevices = jsonbody.vehicles.length;
            jsonbody.vehicles.forEach(function(obj) {
                var vehicleid = obj.vehicleId;
                var idx = thetype + "|" + vehicleid;
                if ( obj.nickName ) {
                    var vehiclename = obj.nickName;
                } else {
                    vehiclename = obj.modelName;
                    obj.nickName = obj.modelName;
                }
                var pvalue = {name: vehiclename, status: "SUCCESS"};
                for (var subid in obj) {
                    if ( subid!=="vehicleId" ) {

                        // change color to vehicle color since color is special
                        if ( subid==="color" ) {
                            pvalue["vehiclecolor"] = obj[subid];
                        } else if ( subid==="make" ) {
                            if ( obj[subid]==="F" ) {
                                pvalue[subid] = "Ford";
                            } else if ( obj[subid]==="L" ) {
                                pvalue[subid] = "Lincoln";
                            } else {
                                pvalue[subid] = obj[subid];
                            }
                        } else {
                            pvalue[subid] = obj[subid];
                        }
                    }
                }

                // place holders for info detail return values
                // *** note *** inconsistent cases for timestamp and timeStamp
                pvalue.engineTYpe = "";
                pvalue.mileage = "";
                pvalue.info = "";
                pvalue.lastUpdated = "";
                pvalue.fuelLevel_value = "";
                pvalue.fuelLevel_distanceToEmpty = "";
                pvalue.fuelLevel_timestamp = "";
                pvalue.batteryChargeLevel_value = "";
                pvalue.batteryChargeLevel_distanceToEmpty = "";
                pvalue.batteryChargeLevel_timestamp = "";
                pvalue.tirePressureWarning = "";
                pvalue.deepSleepInProgress = "";
                pvalue.firmwareUpgradeInProgress = "";
                pvalue.longitude = "";
                pvalue.latitude = "";
                pvalue.speed = "";
                pvalue.direction = "";
                pvalue.timeStamp = "";
                pvalue.remoteStartStatus_status = "";
                pvalue.remoteStartStatus_remoteStartDuration = "";
                pvalue.remoteStartStatus_remoteStartTime = "";
                pvalue.chargingStatus_value = "";
                pvalue.chargingStatus_timestamp = "";
                pvalue.chargingStatus_chargeStartTime = "";
                pvalue.chargingStatus_chargeEndTime = "";
                pvalue.pingStatus_value = "";
                pvalue.pingStatus_timeStamp = "";

                // place holders for error messages
                pvalue.error = "";
                pvalue.error_description = "";

                // place holders for return status for commands
                pvalue["commandStatus"] = "";
                pvalue["commandId"] = "";

                // add all the api call functions 
                // removed _status and _location since they don't appear to work
                // the location and status are returned in the info call
                pvalue["_info"] = "info";
                pvalue["_unlock"] = "unlock";
                pvalue["_lock"] = "lock";
                pvalue["_startEngine"] = "startEngine";
                pvalue["_stopEngine"] = "stopEngine";
                pvalue["_wake"] = "wake";
                // pvalue["_status"] = "_status";
                // pvalue["_location"] = "_location";

                var pvalstr = encodeURI2(JSON.stringify(pvalue));
                var device = {userid: userid, hubid: hubindex, deviceid: vehicleid, name: vehiclename, 
                    devicetype: thetype, hint: hubType, refresh: "normal", pvalue: pvalstr};
                mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+
                                                  " AND devicetype = '"+thetype+"' AND deviceid = '"+vehicleid+"'")
                .then(result => {
                    devicecnt++;

                    // check if this is our last one
                    if ( devicecnt >= numdevices ) {
                        updateOptions(userid, reload, reloadpath);
                    }
                }).catch(reason => {console.log("dberror 6 - vehicleInfoCallback - ", reason);});

            });
        } else {
            updateOptions(userid, false, reloadpath);
        }

    }

    // function for loading ISY hub devices
    function getIsyDevices() {
        var buff = Buffer.from(hubAccess);
        var base64 = buff.toString('base64');
        var stheader = {"Authorization": "Basic " + base64};
        var pvariables = {name: "ISY Variables"};
        var vardefs = {
            userid: userid,
            name: "ISY Variables", 
            hubid: hubindex,
            deviceid: "vars",
            devicetype: "isy",
            hint: "ISY_variable",
            refresh: "never",
            pvalue: encodeURI(JSON.stringify(pvariables))
        };

        // use this object to keep track of which things are done
        var done = {"Int" : false, "State" : false, "Int_defs" : false, "State_defs" : false, 
                    "Nodes": false, "Progs": false, "Vars": false };

        if ( DEBUGisy ) {
            console.log("endpoint = ", hubEndpt, " stheader = ", stheader, " hubAccess: ", hubAccess);
        }

        // get all the variables to put into a single tile
        curl_call(hubEndpt + "/vars/definitions/1", stheader, false, false, "GET", getIntVarsDef);
        curl_call(hubEndpt + "/vars/definitions/2", stheader, false, false, "GET", getStateVarsDef);
        curl_call(hubEndpt + "/vars/get/1", stheader, false, false, "GET", getIntVars);
        curl_call(hubEndpt + "/vars/get/2", stheader, false, false, "GET", getStateVars);

        // also get programs - each going into its own unique tile
        curl_call(hubEndpt + "/programs?subfolders=true", stheader, false, false, "GET", getAllProgs);

        // now get all the nodes - each going into its own unique tile
        curl_call(hubEndpt + "/nodes", stheader, false, false, "GET", getAllNodes);

        // handle setting the variable tile
        // the four calls to curl above all land here to check if everything is done
        function checkDone( stage ) {

            // mark this stage done if passed in as a parameter
            if ( stage ) {
                done[ stage ] = true;
            }

            // check for finishing all the vars stages
            if ( !done["Vars"] && (done["Int"] && done["State"] && done["Int_defs"] && done["State_defs"]) ) {

                // Now that we have all the isy variables and names, create a mapping of ids to names
                done["Vars"] = true;
                vardefs.pvalue = encodeURI2(JSON.stringify(pvariables));
                if ( DEBUGisy ) {
                    console.log( (ddbg()), "updating vars: ", vardefs);
                }
                mydb.updateRow("devices", vardefs, "userid="+userid+" AND deviceid='vars'")
                .then(resvars => {
                    checkDone();
                });
            }

            if ( done["Vars"] && done["Progs"] && done["Nodes"] ) {
                updateOptions(userid, reload, reloadpath);
            }

        }

        function getIntVarsDef(err, res, body ) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY int definitions: ", err);
                checkDone("Int_defs");
            } else {
                getISY_Defs(body, "Int");
            }
        }
        
        function getStateVarsDef(err, res, body ) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY state definitions: ", err);
                checkDone("State_defs");
            } else {
                getISY_Defs(body, "State");
            }
        }
        
        async function getISY_Defs( body, vartype ) {

            await xml2js(body, function(err, result) {
                if (DEBUGvar) {
                    console.log( (ddbg()), vartype, vartype + " variables defs: ", UTIL.inspect(result, false, null, false) );
                }
                try {
                    var varobj = result.CList.e;
                } catch(e) {
                    return;
                }
                if ( !is_object(varobj) ) {
                    return;
                }

                // convert single variable object into an array of variable objects
                if ( !is_array(varobj) ) {
                    varobj = [varobj];
                }
                varobj.forEach(function( obj) {
                    var defname = vartype + "_";
                    try {
                        var varid = obj["$"]["id"];
                        var varname = obj["$"]["name"];
                        if ( !varname ) {
                            varname = defname + varid;
                        }
                        
                        // remove spaces from name
                        // varname = varname.replace(/ /g,"_");

                        // var prec = obj["val"][0]["_"];
                    } catch (e) {
                        varid = 0;
                        varname = "";
                    }
                    var defaultname = defname+varid;
                    if ( varid > 0 && varname !== defaultname) {
                        pvariables["def_"+defaultname] = varname;
                        // vardefs["prec_" + vartype + "_" + varid] = prec;
                    }
                });
            });
            checkDone(vartype + "_defs");
        }
        
        function getIntVars(err, res, body) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY Int variables: ", err);
                checkDone("Int");
            } else {
                getISY_Vars(body, "Int");
            }
        }
        
        function getStateVars(err, res, body) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY State variables: ", err);
                checkDone("State");
            } else {
                getISY_Vars(body, "State");
            }
        }

        async function getISY_Vars(body, vartype) {
            // make a single tile with all the variables in it
            var vartypes = ["", "Int", "State"];
            if (DEBUGvar) {
                console.log( (ddbg()), body );
            }

            await xml2js(body, function(err, result) {
                if (DEBUGvar) {
                    console.log( (ddbg()), vartype, "variables: ", UTIL.inspect(result, false, null, false) );
                }

                if ( !result || !result.vars ) {
                    return;
                }

                var varobj = result.vars.var;
                if ( !is_object(varobj) ) {
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

                if ( DEBUGvar ) {
                    console.log( (ddbg()), "New variable value: ", pvariables);
                }
            });

            // move this to outside await so it can proceed if async returns prematurely
            // the await ensures everything is done before getting here
            checkDone(vartype);
        }

        // get programs and setup program tiles much like how Piston tiles are done in ST and HE
        function getAllProgs(err, res, body) {
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY programs: ", err);
                checkDone("Progs");
            } else {

                // have to use the full parsing function here
                xml2js(body, function(xmlerr, result) {
                    var thetype = "isy";
                    if ( result ) {
                        try {
                            var programlist = result.programs.program;
                            if ( !is_object(programlist) ) {
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
                                if ( DEBUG7 ) {
                                    console.log( (ddbg()), "Program details: ", UTIL.inspect(prog, false, null, false) );
                                }

                                // if we have a folder don't add it - but flag the count to keep track of load status
                                if ( isfolder==="true" ) {
                                    if ( DEBUG7 ) {
                                        console.log( (ddbg()), "Program ", prog.name, " is a folder. id: ", proginfo.id, " Status: ", proginfo.status);
                                    }
                                    progcount++;
                                    if ( progcount >= numprogs ) {
                                        checkDone("Progs");
                                    }

                                // create tile for programs that are not folders
                                } else {
                                    if ( DEBUG7 ) {
                                        console.log( (ddbg()), "Program ", prog.name, " id: ", proginfo.id, " Status: ", proginfo.status, " Last run: ", prog.lastRunTime );
                                    }
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
                                    var device = {
                                        userid: userid,
                                        name: progname, 
                                        hubid: hubindex,
                                        deviceid: progid,
                                        devicetype: thetype,
                                        hint: "ISY_program",
                                        refresh: "never",
                                        pvalue: encodeURI2(JSON.stringify(pvalue))
                                    };
                                    mydb.updateRow("devices", device, "userid="+userid+" AND deviceid='"+progid+"'")
                                    .then(resprogs => {
                                        progcount++;
                                        if ( progcount >= numprogs ) {
                                            checkDone("Progs");
                                        }
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

        function getAllNodes(err, res, body) {
            var thetype = "isy";
            if ( err ) {
                console.log( (ddbg()), "error retrieving ISY nodes: ", err);
                checkDone("Nodes");
            } else {

                // note - changed to use xml2js
                xml2js(body, function(xmlerr, result) {
                    if ( DEBUG7 && DEBUGisy ) {
                        console.log( (ddbg()), "xml2js nodes: ", body, UTIL.inspect(result, false, null, false) );
                    }
                    if ( !result ) {
                        checkDone("Nodes");
                        return;
                    }

                    // set our flags for handling asyncronous update status
                    var newdevices = {nodecount: 0, groupcount: 0, statuscount: 0, ranstatus: false};
                    var thenodes = result.nodes["node"];
                    var groups = result.nodes["group"];
                    var numnodes = utils.count(thenodes);
                    var numgroups = utils.count(groups);

                    // we run this after every node is updated to see if all are done
                    // and if all are updated then we get status details of each
                    // removing any that failed to update for whatever reason
                    function checkNodesDone() {
                        if ( newdevices.nodecount === numnodes && !newdevices.ranstatus ) {
                            getNodesStatus();
                        }

                        // if we have read in all nodes and all groups, refresh the screen
                        if ( newdevices.nodecount >= numnodes && 
                             newdevices.groupcount >= numgroups &&
                             newdevices.statuscount >= numnodes ) {
                            if ( DEBUGisy ) {
                                console.log( (ddbg()), "finished loading all nodes.");
                            }
                            checkDone("Nodes");
                        }
                    }

                    for ( var obj in thenodes ) {
                        var node = thenodes[obj];
                        var id = fixISYid(node["address"][0].toString());
    
                        // var idx = thetype + "|" + id;
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
                        if ( !name ) {
                            name = pvalue["name"];
                        }
                        
                        // set bare minimum info
                        // this is updated below in the callback after getting node details
                        var device = {
                                userid: userid,
                                name: name, 
                                hubid: hubindex,
                                deviceid: id,
                                devicetype: thetype,
                                hint: hint,
                                refresh: "never",
                                pvalue: encodeURI2(JSON.stringify(pvalue))
                        };
                        if ( DEBUGisy ) {
                            console.log((ddbg()),"updating node after reading device: ", device);
                        }
                        newdevices[id] = device;

                        mydb.updateRow("devices", device, "userid = "+userid + " AND devicetype = '" + thetype +"' AND deviceid = '"+id+"'")
                        .then(result => {
                            if ( !result ) {
                                console.log( (ddbg()), "error - device update failed for id: ", id);
                                newdevices[id] = null;
                            } else {
                                newdevices[id] = device;
                            }
                            newdevices.nodecount++;
                            checkNodesDone();
                        });

                        if (DEBUGisy) {
                            console.log( (ddbg()), "id= ", id," hint= ", hint, " node: ", node, " pvalue: ", pvalue);
                        }
                    }

                    // now that we have all the nodes identified, get the details
                    // this makes a second write to the database for each node
                    function getNodesStatus() {
                        
                        newdevices.ranstatus = true;

                        curl_call(hubEndpt + "/status", stheader, false, false, "GET", callbackStatusInfo);
                        function callbackStatusInfo(err, res, body) {
                            xml2js(body, function(xmlerr, result) {
                                try {
                                    if ( result ) {

                                        var nodes = result.nodes.node;
                                        if ( nodes ) {
                                            nodes.forEach(function(node) {
                                                // var nodename = node["name"][0];
                                                var nodeid = fixISYid(node["$"]["id"]);
                                                var props = node["property"];

                                                var device = newdevices[nodeid];

                                                // if there are props set values
                                                // otherwise just flag that we tried by incrementing the count
                                                if ( props && device ) {
                                                    setIsyFields(userid, nodeid, device, props, false)
                                                    .then(res2 => {
                                                        newdevices.statuscount++;
                                                        checkNodesDone();
                                                    });
                                                } else {
                                                    newdevices.statuscount++;
                                                    checkNodesDone();
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
                        }
                    }

                    // now get groups
                    if ( groups ) {
                        for ( var obj in groups ) {
                            var node = groups[obj];
                            var id = fixISYid(node["address"][0].toString());
                            var hint = "ISY_scene";
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
            
                            if ( !name ) {
                                name = pvalue["name"];
                            }
            
                            // set tile up
                            var device = {
                                userid: userid,
                                name: name, 
                                hubid: hubindex,
                                deviceid: id,
                                devicetype: thetype,
                                hint: hint,
                                refresh: "never",
                                pvalue: encodeURI2(JSON.stringify(pvalue))
                            };
                            if (DEBUGisy) {
                                console.log( (ddbg()), "id= ", id," hint= ", hint, " node: ", node, " pvalue: ", pvalue);
                            }
                            mydb.updateRow("devices", device, "userid="+userid+" AND deviceid='"+id+"'")
                            .then(res3 => {
                                newdevices.groupcount++;
                                checkNodesDone();
                            });
                        }
                    }

                    // in case nothing is done above check here for update
                    checkNodesDone();
            
                });
            }
        }
        // ------ end of getAllNodes

    }
    // ------ end of getIsyDevices
}
// ------ end of getDevices

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

// pvalue = translateIsy(bid, control[0], uom, subid, pvalue, newval, "");
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

// this takes an array of props and updates the database with new values
// it returns a promise which if is not null can be used to signal a refresh
function setIsyFields(userid, nodeid, device, props, screenupd) {

    try {
        var value = JSON.parse(decodeURI2(device.pvalue));
    } catch(e) {
        console.log( (ddbg()),"error parsing existing pvalue for isy node: ", nodeid," value: ", device.pvalue);
        return null;
    }

    if ( is_array(props) ) {
        props.forEach(function(aprop) {
            var obj = aprop['$'];
            // map ISY logic to the HousePanel logic based on SmartThings and Hubitat
            var subid = mapIsy(obj.id, obj.uom);
            value["uom_" + subid] = obj.uom;
            var val = obj.value;
            value = translateIsy(nodeid, obj.id, obj.uom, subid, value, val, obj.formatted);
        });
        
        // update DB
        if ( DEBUGisy ) {
            console.log( (ddbg()), "in setIsyFields - userid: ", userid, " nodeid: ", nodeid, " device: ", device, " value: ", value, " props: ", props);
        }
        device.pvalue = encodeURI2(JSON.stringify(value));
        var pr = mydb.updateRow("devices", device, "userid="+userid+" AND deviceid = '"+nodeid+"'")
        .then(results => {
            if ( results && screenupd ) {
                pushClient(userid, nodeid, "isy", "none", value);
            }
            return results;
        }).catch(reason => {console.log("dberror 7 - setIsyFields - ", reason);});
        return pr;
    } else {
        return null;
    }
    // return device.pvalue;
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
function updateOptions(userid, reload, reloadpath) {

    // signal clients to reload
    if ( reload && reloadpath && reloadpath==="/reauth") {
        pushClient(userid, "reload", "auth", reloadpath);
    } else if ( reload ) {
        pushClient(userid, "reload", "all", reloadpath);
    }
}

function getSpecials(configoptions) {

    var spobj = getConfigItem(configoptions, "specials");
    if ( typeof spobj === "object" ) {
        var obj = spobj;
    } else {
        try {
            obj = JSON.parse(decodeURI2(spobj));
        } catch (e) {
            obj = null;
        }
    }
    
    if ( !obj ) {
        obj = {
            "video": ["vid",480,240, 4, "normal"], 
            "frame": ["frame",480,212, 4, "slow"],
            "image": ["img",480,240, 4, "normal"],
            "blank": ["blank",120,150, 4, "never"],
            "custom": ["custom_",120,150, 8, "normal"]
        };
    }

    return obj;
}

function getLoginPage(userid, usertype, emailid, hostname, skin) {
    var tc = "";
    var pname = "default";
    tc+= utils.getHeader(userid, null, skin, true);


    tc+= "<form id=\"loginform\" name=\"login\" action=\"#\"  method=\"POST\">";
    tc+= utils.hidden("returnURL", GLB.returnURL);
    tc+= utils.hidden("pagename", "login");
    var webSocketUrl = getSocketUrl(hostname);
    tc+= utils.hidden("webSocketUrl", webSocketUrl);
    tc+= utils.hidden("api", "dologin");
    tc+= utils.hidden("userid", userid, "userid");

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + utils.APPNAME + "</h2>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"emailid\" class=\"startupinp\">Email or username: </label><br>";
    tc+= "<input id=\"emailid\" name=\"emailid\" width=\"60\" type=\"text\" value=\"" + emailid + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pword\" class=\"startupinp\">Password: </label><br>";
    tc+= "<input id=\"pword\" name=\"pword\" width=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<hr>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pname\" class=\"startupinp\">Panel Name: </label><br>";
    tc+= "<input id=\"pname\" name=\"pname\" width=\"60\" type=\"text\" value=\"" + pname + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"panelpword\" class=\"startupinp\">Panel Password: </label><br>";
    tc+= "<input id=\"panelpword\" name=\"panelpword\" width=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="dologin" class="formbutton">Sign In</div>';
    tc+= "</div>";

    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "Forgot Password? Enter email address above and then";
    tc+= '<div id="forgotpw" class="inlinebutton">Click Here to Reset</div>';
    tc+= "</div>";

    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "Don't have an account?";
    tc+= '<div id="newuser" class="inlinebutton">Create One Here</div>';
    tc+= "</div>";

    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "<div>By signing in, you are agreeing to our <div id=\"privacypolicy\" class=\"inlinebutton\">Privacy Policy</div></div>";
    tc+= "<br><div>For login instructions<div id=\"moreinfo\" class=\"inlinebutton\">Click Here...</div></div>";
    tc+="<div id=\"loginmore\" class=\" loginmore hidden\">Enter your username or email and password to access HousePanel " +
            "and gain access to your smart home devices. All accounts must be password protected.<br><br>" +

            "Each user can have any number of panels defined with each one having its own password and skin. " + 
            "This allows a single account holder to display their smart devices in different ways on different devices. " +
            "To load a specific panel skin, please enter its name and password. " +
            "If this is left blank, the first panel available that is not password protected in the user's account will be loaded. " +
            "If all panels are password protected you must provide the name and password of a valid panel to sign into HousePanel." +
            "</div><br />";
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= "<form id=\"newuserform\" class=\"hidden\" name=\"newuserform\" action=\"#\"  method=\"POST\">";
    tc+= utils.hidden("returnURL", GLB.returnURL);
    tc+= utils.hidden("pagename", "login");
    var webSocketUrl = getSocketUrl(hostname);
    tc+= utils.hidden("webSocketUrl", webSocketUrl);
    tc+= utils.hidden("api", "newuser");
    tc+= utils.hidden("userid", userid);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + utils.APPNAME + "</h2>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newemailid\" class=\"startupinp\">Email: </label><br>";
    tc+= "<input id=\"newemailid\" name=\"newemailid\" width=\"60\" type=\"text\" value=\"\"/>"; 
    tc+= "</div>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newunameid\" class=\"startupinp\">Username (optional): </label><br>";
    tc+= "<input id=\"newunameid\" name=\"newuname\" width=\"60\" type=\"text\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newpword\" class=\"startupinp\">Password: </label><br>";
    tc+= "<input id=\"newpword\" name=\"newpword\" width=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newpword2\" class=\"startupinp\">Confirm Password: </label><br>";
    tc+= "<input id=\"newpword2\" name=\"newpword2\" width=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="createuser" class="formbutton">Create Account</div>';
    tc+= "</div>";

    tc+= "<br><hr>";
    tc+= "<div class='loginline'>";
    tc+= "Already have an account?";
    tc+= '<div id="olduser" class="inlinebutton">Create Here To Login</div>';
    tc+= "</div>";

    tc+= "<br><hr>";
    tc+= "<div class='loginline'>";
    tc+= "<div>By creating a new account, you are agreeing to our <div id=\"privacypolicy\" class=\"inlinebutton\">Privacy Policy</div></div>";
    tc+= "</div><br>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= utils.getFooter();
    return tc;
}

function makeDefaultFolder(userid, pname) {
    var userfolder = "user"+userid.toString();
    if (!fs.existsSync(userfolder) ) {
        fs.mkdirSync(userfolder);
        
        var panelfolder = userfolder + "/" + pname;
        if ( !fs.existsSync(panelfolder) ) {
            fs.mkdirSync(panelfolder);
        }

        var fname = panelfolder + "/customtiles.css";
        if ( !fs.existsSync(fname) ) {
            writeCustomCss(userid, pname, "");
        }

        // add three folders for custom icons, media, and photos
        var imgfolder = panelfolder + "/icons";
        if ( !fs.existsSync(imgfolder) ) {
            fs.mkdirSync(imgfolder);
        }
        imgfolder = panelfolder + "/media";
        if ( !fs.existsSync(imgfolder) ) {
            fs.mkdirSync(imgfolder);
        }
        imgfolder = panelfolder + "/photos";
        if ( !fs.existsSync(imgfolder) ) {
            fs.mkdirSync(imgfolder);
        }
    }
}

function createNewUser(body) {

    var emailname = body.email;
    var username = body.uname;
    var pword = body.pword;
    var userid;
    var panelid;
    var newuser;
    var nullhub;
    var defaultpanel;

    if ( !emailname ) {
        return "error - A valid email address must be provided to create a new account.";
    }

    // first check to see if this user exists
    return mydb.getRow("users","*","email = '"+emailname+"'")
    .then(row => {
        if ( row ) { return "error - user with email " + emailname + " already exists"; }

        // create confirmation code
        var d = new Date();
        var time = d.toLocaleTimeString();
        var logincode = pw_hash(emailname + ":" + time);

        // change username to email if none given
        if ( !username ) {
            username = emailname;
        }

        // create new user but set type to 0 until we get an email confirmation
        newuser = {email: emailname, uname: username, password: pw_hash(pword), usertype: 0, defhub: "", hpcode: logincode };
        return mydb.addRow("users", newuser)
        .then(result => {

            if ( !result ) { return "error - encountered a problem adding a new user to the HousePanel user community."; }

            userid = result.getAutoIncrementValue();
            newuser.id = userid;
            return newuser;
        })
        .then(result => {

            if ( !result || typeof result !== "object" ) { return result; }

            // make a directory for this user with a default panel folder
            makeDefaultFolder(userid, pname);

            // make a default hub for this user
            nullhub = {userid: userid, hubid: "-1", hubhost: "None", hubtype: "None", hubname: "None", 
                clientid: "", clientsecret: "", hubaccess: "", hubendpt: "", hubrefresh: "", 
                useraccess: "", userendpt: "", hubtimer: "0" };
            return mydb.addRow("hubs", nullhub)
            .then(result => {
                if ( !result || typeof result !== "object" ) { return result; }
                nullhub.id = result.getAutoIncrementValue();
                return nullhub;
            });
        })
        .then(result => {
            if ( !result || typeof result !== "object" ) { return result; }

            addConfigItem(userid, "skin", "skin-housepanel");
            addConfigItem(userid, "kiosk", "false");
            addConfigItem(userid, "blackout", "true");
            addConfigItem(userid, "rules", "true");
            addConfigItem(userid, "timezone", "America/Detroit");
            addConfigItem(userid, "phototimer","0");
            addConfigItem(userid, "fcastcity") || "ann-arbor";
            addConfigItem(userid, "fcastregion","Ann Arbor");
            addConfigItem(userid, "fcastcode","42d28n83d74");
            addConfigItem(userid, "accucity","ann-arbor-mi");
            addConfigItem(userid, "accuregion","us");
            addConfigItem(userid, "accucode", "329380");
            addConfigItem(userid, "hubpick", "all");
            var useroptions = getTypes();
            addConfigItem(userid, "useroptions", useroptions);
            var specials = {video:4, frame:4, image:4, blank:4, custom:8};
            addConfigItem(userid, "specialtiles", specials);
            var d = new Date();
            var timesig = utils.HPVERSION + " @ " + d.getTime();
            addConfigItem(userid, "time", timesig);
            return result;
        })
        .then(result => {
            if ( !result || typeof result !== "object" ) { return result; }

            // now create a default panel and add a default set of rooms with a clock
            defaultpanel = {userid: userid, pname: "default", password: "", skin: "skin-housepanel"};
            return mydb.addRow("panels", defaultpanel)
            .then(result => {

                if ( !result || typeof result !== "object" ) { return result; }

                // if we added a default panel okay create a set of default rooms
                panelid = result.getAutoIncrementValue();
                defaultpanel.id = panelid;

                var k = 1;
                var rooms = [];
                for ( var roomname in GLB.defaultrooms ) {
                    var room = {userid: userid, panelid: panelid, rname: roomname, rorder: k};
                    k++;
                    mydb.addRow("rooms", room)
                    .then(result => {
                        if ( result ) {
                            room.id = result.getAutoIncrementValue();
                            rooms.push(room);
                        }
                    });
                }

                // send email to confirm
                if ( DEBUG15 ) {
                    console.log( (ddbg()), "newuser: ", newuser, "hub: ", nullhub, "panel: ", defaultpanel, "rooms: ", rooms);
                }
                return [newuser, nullhub, defaultpanel, rooms];

            });
        })
        .then(result => {

            // send email to user with information about the new account requesting confirmation
            var transporter;
            if ( GLB.dbinfo.service && GLB.dbinfo.service==="gmail" ) {
                transporter = nodemailer.createTransport({
                    service: GLB.dbinfo.service,
                    auth: {
                        user: GLB.dbinfo.gmailuser,
                        pass: GLB.dbinfo.gmailpass
                    }
                });
            } else {
                transporter = nodemailer.createTransport({
                    secure: false,
                    host: GLB.dbinfo.emailhost,
                    port: GLB.dbinfo.emailport,
                    auth: {
                        user: GLB.dbinfo.emailuser,
                        pass: GLB.dbinfo.emailpass
                    }
                });
            }

            // setup the message
            var textmsg = "If you did not request a new HousePanel acount for user [" + emailname + "] please ignore this email.\n\n";
            textmsg+= "To confirm and activate your HousePanel account, paste this into your browser window:\n\n";
            textmsg+= GLB.returnURL + "/activateuser?userid="+userid+"&hpcode="+logincode;
            textmsg+= "This link expires in 15 minutes.";
            var htmlmsg = "<strong>If you did not request a new HousePanel account for user [" + emailname + "] please ignore this email.</strong><br><br>";
            htmlmsg+= "To confirm and activate your HousePanel account, <a href=\"" + GLB.returnURL + "/activateuser?userid="+userid+"&hpcode="+logincode+"\">click here</a><br><br>";
            htmlmsg+= "This link expires in 15 minutes.";

            var message = {
                from: GLB.dbinfo.emailuser,
                to: emailname,
                subject: "HousePanel new user confirmation",
                text: textmsg,
                html: htmlmsg
            };

            // send the email
            transporter.sendMail(message, function(err, info) {
                if ( err ) {
                    console.log( (ddbg()), "error sending email to: ", emailname, " error: ", err);
                } else {
                    console.log( (ddbg()), "email successfully sent to: ", emailname, " response: ", info.response);
                }
            });

            // make the hpcode expire after 15 minutes
            var delay = 15 * 60000;
            setTimeout(function() {
                mydb.updateRow("users",{hpcode: ""},"id = "+userid);
            }, delay);

            return result;
        });

    });

}

function getNewUserPage(user, hostname) {
    var userid = user.id;
    var tc = "";
    tc+= utils.getHeader(userid, null, null, true);
    tc+= "<h2>Congratulations. You have activated your new HousePanel account.</h2>";
    tc+= "<hr>";

    tc+= "<form name=\"newuserpage\" action=\"#\"  method=\"POST\">";
    tc+= utils.hidden("returnURL", GLB.returnURL);
    tc+= utils.hidden("pagename", "login");
    tc+= utils.hidden("userid", userid);
    // var webSocketUrl = getSocketUrl(hostname);
    // tc+= utils.hidden("webSocketUrl", webSocketUrl);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + utils.APPNAME + "</h2>";

    tc+= "<div class='userinfo'><strong>Email: </strong>" + user.email + "</div>";
    tc+= "<div class='userinfo'><strong>Username:</strong>" + user.uname + "</div>";
    tc+= "<div class='userinfo'><strong>User ID:</strong>" + user.id + "</div>";

    tc+= "<hr><br><div><a href=\"" + GLB.returnURL + "\">Click Here</a> to log in with your new credentials. ";
    tc+= "This will log you into the default panel named \"default\" with a blank password. You can configure your panels later.</div>";

    tc+= "</div>";
    tc+= "</form>";
    tc+= utils.getFooter();

    return tc;
}

function getNewPasswordPage(user, hostname) {
    var userid = user.id;
    var tc = "";
    tc+= utils.getHeader(userid, null, null, true);
    tc+= "<h2>Enter New Credentials Below</h2>";
    tc+= "<hr>";

    // only need to put the userid in a hidden field since email and uname are not updated
    // but we show them in a static field below
    tc+= "<form id=\"newpwform\" name=\"newpwform\" action=\"#\"  method=\"POST\">";
    tc+= utils.hidden("returnURL", GLB.returnURL);
    tc+= utils.hidden("pagename", "login");
    tc+= utils.hidden("userid", userid);
    tc+= utils.hidden("email", user.email);
    tc+= utils.hidden("uname", user.uname);
    // var webSocketUrl = getSocketUrl(hostname);
    // tc+= utils.hidden("webSocketUrl", webSocketUrl);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + utils.APPNAME + "</h2>";

    tc+= "<div class='loginline'>";
    tc+= "<label class=\"startupinp\">Email: " + user.email + "</label><br>";
    tc+= "</div>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newunameid\" class=\"startupinp\">Username: " + user.uname + "</label><br>";
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newpword\" class=\"startupinp\">New Password: </label><br>";
    tc+= "<input id=\"newpword\" name=\"newpword\" width=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newpword2\" class=\"startupinp\">Confirm Password: </label><br>";
    tc+= "<input id=\"newpword2\" name=\"newpword2\" width=\"60\" type=\"password\" value=\"skin-housepanel\"/>"; 
    tc+= "</div>";
    
    tc+= "<hr>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pname\" class=\"startupinp\">Panel Name: </label><br>";
    tc+= "<input id=\"pname\" name=\"pname\" width=\"60\" type=\"text\" value=\"" + "default" + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"panelpword\" class=\"startupinp\">Panel Password: </label><br>";
    tc+= "<input id=\"panelpword\" name=\"panelpword\" width=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="newpassword" class="formbutton">Update Credentials</div>';
    tc+= "</div>";

    tc+= "<br><hr>";
    tc+= "<div class='loginline'>";
    tc+= "Think you remember your password after all?<br>";
    tc+= '<div id="revertolduser" class="inlinebutton">Click here to login with existing credentials</div><br>';
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= utils.getFooter();

    return tc;

}

function forgotPassword(emailname) {

    // get the user from the database and send reminder if user exists
    return mydb.getRow("users","*","email = '"+emailname+"'")
    .then(row => {
        if ( !row ) { return "error - user with email " + emailname + " does not exist"; }

        // compute a special code to check later
        var d = new Date();
        var time = d.toLocaleTimeString();
        var logincode = pw_hash(emailname + ":" + time);
    
        // save this in the DB for confirming later
        var userid = row.id;
        return mydb.updateRow("users",{hpcode: logincode},"id = "+userid)
        .then(result => {
            if ( !result ) { return "error - could not process password reset for user " + emailname; }

            // setup the transport to send email
            var transporter;
            if ( GLB.dbinfo.service ) {
                transporter = nodemailer.createTransport({
                    service: GLB.dbinfo.service,
                    auth: {
                        user: GLB.dbinfo.gmailuser,
                        pass: GLB.dbinfo.gmailpass
                    }
                });
            } else {
                transporter = nodemailer.createTransport({
                    secure: false,
                    host: GLB.dbinfo.emailhost,
                    port: GLB.dbinfo.emailport,
                    auth: {
                        user: GLB.dbinfo.emailuser,
                        pass: GLB.dbinfo.emailpass
                    }
                });
            }

            // setup the message
            var textmsg = "If you did not request a HousePanel login reset for user [" + emailname + "] please ignore this email.\n\n";
            textmsg+= "To reset your HousePanel login, paste this into your browser window:\n\n";
            textmsg+= GLB.returnURL + "/confirmreset?userid="+userid+"&hpcode="+logincode;
            textmsg+= "This link expires in 15 minutes.";
            var htmlmsg = "<strong>If you did not request a HousePanel login reset for user [" + emailname + "] please ignore this email.</strong><br><br>";
            htmlmsg+= "To reset your HousePanel login, <a href=\"" + GLB.returnURL + "/confirmreset?userid="+userid+"&hpcode="+logincode+"\">click here</a><br><br>";
            htmlmsg+= "This link expires in 15 minutes.<br>";

            var message = {
                from: GLB.dbinfo.emailuser,
                to: emailname,
                subject: "HousePanel login reset",
                text: textmsg,
                html: htmlmsg
            };

            // send the email
            transporter.sendMail(message, function(err, info) {
                if ( err ) {
                    console.log( (ddbg()), "error sending email to: ", emailname, " error: ", err);
                } else {
                    console.log( (ddbg()), "email successfully sent to: ", emailname, " response: ", info.response);
                }
            });

            // make the hpcode expire after 15 minutes
            var delay = 15 * 60000;
            setTimeout(function() {
                mydb.updateRow("users",{hpcode: ""},"id = "+userid);
            }, delay);

            row.hpcode = logincode;
            return row;

        });

    });

}

function updatePassword(body) {
    
    var userid = body.userid;
    var pname = body.pname;
    var pword = pw_hash(body.pword);
    var panelpw = pw_hash(body.panelpw);

    if ( !userid ) {
        return "error - existing userid not found - password cannot be updated.";
    }

    // update the designated user
    var upduser = {password: pword, defhub: "", hpcode: ""};
    return mydb.updateRow("users", upduser, "id = " + userid)
    .then( row => {
        if ( row ) {
            var updpanel = {userid: userid, pname: pname, password: panelpw};
            return mydb.updateRow("panels", updpanel, "userid = " + userid + " AND pname = '"+pname+"'")
            .then( row => {
                if ( row ) {
                    return {pword: pword, pname: pname, panelpw: panelpw};
                } else {
                    return "error - problem updating or creating a new panel";
                }
            });
        } else {
            return "error - problem updating user password";
        }
    });

}

function processLogin(body, res) {

    // check the user name and password based on login form data
    var uname = encodeURI(body["emailid"].trim());
    var uhash = pw_hash(body["pword"]);

    if ( !body["pname"] ) {
        var pname = "";
        var phash = "";
    } else {
        pname = encodeURI(body["pname"].trim());
        phash = pw_hash(body["panelpword"]);
    }

    if ( DEBUG3 ) {
        console.log( (ddbg()), "dologin: uname= ", uname, " pword= ", uhash, " pname= ", pname, " panelpword= ", phash, " body: ", body);
    }

    // get all the users and check for one that matches the hashed email address
    // emails for all users must be unique
    if ( pname ) {
        var conditions = "panels.pname = '" + pname + "' AND panels.password = '"+phash+"' AND ( users.email = '"+uname+"' OR users.uname ='"+uname+"' ) AND users.password = '"+uhash+"'";
    } else {
        conditions = "panels.password = '"+phash+"' AND ( users.email = '"+uname+"' OR users.uname ='"+uname+"' ) AND users.password = '"+uhash+"'";
    }
    var joinstr = mydb.getJoinStr("panels", "userid", "users", "id");
    var results = mydb.getRow("panels", "*", conditions, joinstr)
    .then(therow => {
        if ( therow ) {
            // make sure we get the actual email and panel names to store in our cookies
            // since this is what we check for a valid login
            var userid = therow["users_id"];
            uname = therow["users_email"];
            pname = therow["panels_pname"];
            setCookie(res, "uname", pw_hash(uname));
            setCookie(res, "pname", pw_hash(pname));
            if ( DEBUG3 ) {
                console.log((ddbg()), ">>>> Successful login. Username: ", uname, " Panelname: ", pname);
            }

            // lets make sure there is a null hub for this user
            var nullhub = {userid: therow["users_id"], hubid: "-1", hubhost: "None", hubtype: "None", hubname: "None", 
                clientid: "", clientsecret: "", hubaccess: "", hubendpt: "", hubrefresh: "", 
                useraccess: "", userendpt: "", hubtimer: "0" };
            mydb.updateRow("hubs",nullhub,"userid = " + userid + " AND hubid = '-1'");

            // create the user directory and default custom css
            makeDefaultFolder(userid, pname);
        
            // pushClient(userid, "reload", "login", "/");
        } else {
            res.clearCookie("uname");
            res.clearCookie("pname");
            console.log( (ddbg()), ">>>> Failed login attempt. Username: ", uname, " Panelname: ", pname);
            therow = "error - invalid username or password";
            // pushClient(userid, "reload", "login", "/logout");
        }
        return therow;
    }).catch(reason => {console.log("dberror 8 - processLogin - ", reason);});
    return results;
}

function getAuthPage(user, configoptions, hostname, pathname, rmsg) {

    // get the current settings from options file
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var defhub = user["users_defhub"] || "new";
    var usertype = user["users_usertype"];
    var panelid = user["panels_id"];
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    if ( !rmsg ) { rmsg = ""; }
    var conditions = "userid = " + user["users_id"];
    var display = mydb.getRows("hubs","*",conditions)
    .then(hubs => {
        var vals = {};
        vals.configs = configoptions;
        vals.hubs = hubs;
        return vals;
        // });
        // return result;
    })
    .then(vals => {
        // we can't query by hubid because it may not be unique to this user
        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        var result = mydb.getRows("devices","*", "devices.userid = " + userid, joinstr)
        .then(devices => {
            var len = devices ? devices.length : 0;
            vals.devices = devices;
            return vals;
        });
        return result;
    })
    .then(vals => {

        // var configoptions = vals.configs;
        var hubs = vals.hubs;
        var devices = vals.devices;
        return getinfocontents(configoptions, hubs, devices);
    })
    .catch(reason => {
        console.log(">>>> error - ", reason);
    });

    return display;

    function getinfocontents(configoptions, hubs, devices) {

        var $tc = "";

        $tc += utils.getHeader(userid, null, skin, true);
        $tc += "<h2>" + utils.APPNAME + " Hub Authorization</h2>";

        // provide welcome page with instructions for what to do
        // this will show only if the user hasn't set up HP
        // or if a reauth is requested or when converting old passwords
        $tc += "<div class=\"greeting\">";

        $tc +="<p>This is where you link a SmartThings or Hubitat hub to " +
                "HousePanel to gain access to your smart home devices. " +
                "Ford and Lincoln vehicles are also supported if you have a Ford-Connect API developer account. " +
                "You can link any number and combination of hubs. " + 
                "To authorize Legacy SmartThings and Hubitat hubs you must have the following info: " +
                "API URL, Client ID, and Client Secret.  No additional info is needed for New SmartThings hubs " +
                "other than an optional user-provided hub name. Refresh timer is in seconds and is used to reload " +
                "a hub's devices every so often. This applies to all hubs." +
                // "For ISY hubs enter your username in the ClientID field and " +
                // "password in the Client Secret field, and enter the URL of your ISY hub in the API Url field." +
                "</p><br />";
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
        
        var webSocketUrl = getSocketUrl(hostname);
        $tc += utils.hidden("pagename", "auth");
        $tc += utils.hidden("returnURL", GLB.returnURL);
        $tc += utils.hidden("pathname", pathname);
        $tc += utils.hidden("webSocketUrl", webSocketUrl);
        $tc += utils.hidden("userid", userid, "userid");
        $tc += utils.hidden("emailid", useremail, "emailid");
        $tc += utils.hidden("skinid", skin, "skinid");
        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        $tc += utils.hidden("configsid", JSON.stringify(configs), "configsid");
        $tc += "<div class=\"greetingopts\">";
        // $tc += "<h3><span class=\"startupinp\">Last update: " + lastedit + "</span></h3>";
            
        if ( hubs ) {
            var authhubs = clone(hubs);
        } else {
            authhubs = [];
        }

        if ( DEBUG2 ) {
            console.log( (ddbg()), "Hub auth default hub: ", defhub, " hubs: ", UTIL.inspect(authhubs,false,null,false));
        }
        
        // add a new blank hub at the end for adding new ones
        // note: the type must be "New" because js uses this to do stuff
        // hubId must be a unique name and can be anything
        // for ST and HE hubs this is a string obtained from the hub itself
        // for Ford and Lincoln hubs this should be provided by the user
        var newhub = {id: 0, userid: userid, hubid: "new", hubhost: "https://graph.api.smartthings.com", hubtype: "New",
                      hubname: "", clientid: "", clientsecret: "",
                      hubaccess: "", hubendpt: "", hubrefresh: "", 
                      useraccess: "", userendpt: "", hubtimer: 0};
        authhubs.push(newhub);

        // determine how many things are in the default hub
        if ( defhub && defhub !== "new" && devices ) {
            var num = 0;
            devices.forEach(function(device) {
                if ( device["hubs_hubid"] === defhub ) {
                    num++;
                }
            });
            var ntc= "Hub with hubId= " + defhub + " is authorized with " + num + " devices";
            $tc += "<div id=\"newthingcount\">" + ntc + "</div>";
        } else {
            $tc += "<div id=\"newthingcount\">" + rmsg + "</div>";
        }

        $tc += getHubPanels(authhubs, defhub);
        $tc += "<div id=\"authmessage\"></div>";
        $tc += "<br><br>";
        $tc += "<button class=\"infobutton\">Return to HousePanel</button>";
        $tc += utils.getFooter();
        return $tc;
    }

    function getHubPanels(authhubs, defhub) {

        // var allhubtypes = { SmartThings:"SmartThings", NewSmartThings:"New SmartThings", Hubitat: "Hubitat", ISY: "ISY", Ford: "Ford", Lincoln: "Lincoln" };
        var allhubtypes = { SmartThings:"Legacy SmartThings", NewSmartThings:"SmartThings", Hubitat: "Hubitat", Ford: "Ford" };
        var $tc = "";
        $tc += "<div class='hubopt'><label for=\"pickhub\" class=\"startupinp\">Authorize Hub: </label>";
        $tc += "<select name=\"pickhub\" id=\"pickhub\" class=\"startupinp pickhub\">";

        var i= 0;
        var selected = false;
        authhubs.forEach(function(hub) {
            var hubName = hub["hubname"];
            var hubType = hub["hubtype"];
            var hubId = hub["hubid"].toString();
            var hubindex = hub.id || 0;
            var hoptid = "hubopt_"+hubindex;
            var id = i+1;
            if ( !selected && hubId === defhub) {
                var hubselected = "selected";
                selected = true;
            } else {
                hubselected = "";
            }
            $tc += "<option id=\"" + hoptid + "\" hubid=\"" + hubId + "\" value=\"" + hubindex + "\" " + hubselected + ">Hub #" + id + " " + hubName + " (" + hubType + ")</option>";
            i++;
        });
        $tc += "</select></div>";

        $tc +="<div id=\"authhubwrapper\">";
        i = 0;

        selected = false;
        authhubs.forEach(function(hub) {
            
            // putStats(hub);
            var hubType = hub["hubtype"];
            var hubId = hub["hubid"].toString();
            var hubindex = hub.id;
            var id = i+1;
            if ( !selected && hubId === defhub) {
                var hubclass = "authhub";
                selected = true;
            } else {
                hubclass = "authhub hidden";
            }

            // set fixed parameters for New SmartThings
            if ( hubType === "NewSmartThings" || hubType === "None" ) {
                hub.clientid = GLB.clientid;
                hub.clientsecret = GLB.clientsecret;
                var idsecret = "startupinp hidden";
            } else {
                idsecret = "startupinp";
            }

            // for each hub make a section with its own form that comes back here as a post
            $tc +="<div id=\"authhub_" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" hubtype=\"" + hubType + "\" class=\"" + hubclass + "\">";
                $tc += "<form id=\"hubform_" + hubindex + "\" hubnum=\"" + id + "\" class=\"houseauth\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

                // insert the fields neede in the apiCall function
                $tc += utils.hidden("userid", userid);
                $tc += utils.hidden("uname", uname);
                $tc += utils.hidden("panelid", panelid);
                $tc += utils.hidden("pname", pname);
                $tc += utils.hidden("skin", skin);

                // we use this div below to grab the hub type dynamically chosen
                if ( hubId!=="-1" ) {
                    $tc += "<div id=\"hubdiv_" + hubId + "\"><label class=\"startupinp\">Hub Type: </label>";
                    $tc += "<select name=\"hubtype\" class=\"hubtypeinp\">";
                    for (var ht in allhubtypes) {
                        if ( ht === hubType ) {
                            $tc += "<option value=\"" + ht + "\" selected>" + allhubtypes[ht] + "</option>";
                        } else {
                            $tc += "<option value=\"" + ht + "\">" + allhubtypes[ht] + "</option>";
                        }
                    }
                    $tc += "</select>";

                    $tc += "<br><br><label class=\"startupinp\">Host API Url: </label>";
                    $tc += "<input class=\"startupinp\" title=\"Enter the hub OAUTH address here\" name=\"hubhost\" width=\"80\" type=\"text\" value=\"" + hub["hubhost"] + "\"/>"; 
    
                    $tc += "</div>";
                }
                // we load client secret in js since it could have special chars that mess up doing it here
                var csecret = decodeURI(hub.clientsecret);
                $tc += utils.hidden("csecret", csecret, "csecret_"+hubindex);
                    
                // $tc += "<div><label class=\"startupinp required\">Host API Url: </label>";
                // $tc += "<input class=\"startupinp\" title=\"Enter the hub OAUTH address here\" name=\"hubhost\" width=\"80\" type=\"text\" value=\"" + hub["hubhost"] + "\"/></div>"; 

                // wrap all of this in a group that can be hidden for New SmartThings and blanks
                $tc += "<div id=\"hideid_" + hubindex + "\" class=\"" + idsecret + "\">";

                $tc += "<div><label class=\"startupinp\">Client ID: </label>";
                $tc += "<input class=\"startupinp\" name=\"clientid\" width=\"80\" type=\"text\" value=\"" + hub["clientid"] + "\"/></div>";

                $tc += "<div class=\"fixClientSecret\"><label class=\"startupinp\">Client Secret: </label>";
                $tc += "<input class=\"startupinp\" name=\"clientsecret\" width=\"80\" type=\"text\" value=\"\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">Fixed access_token: </label>";
                $tc += "<input class=\"startupinp\" name=\"useraccess\" width=\"80\" type=\"text\" value=\"" + hub["useraccess"] + "\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">Fixed Endpoint: </label>";
                $tc += "<input class=\"startupinp\" name=\"userendpt\" width=\"80\" type=\"text\" value=\"" + hub["userendpt"] + "\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">hub ID or App ID: </label>";
                $tc += "<input class=\"startupinp\" name=\"hubid\" width=\"80\" type=\"text\" value=\"" + hub["hubid"] + "\"/></div>"; 

                $tc += "</div>";

                $tc += "<div><label class=\"startupinp\">Hub Name: </label>";
                $tc += "<input class=\"startupinp\" name=\"hubname\" width=\"80\" type=\"text\" value=\"" + hub["hubname"] + "\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">Refresh Timer: </label>";
                $tc += "<input class=\"startupinp\" name=\"hubtimer\" width=\"10\" type=\"text\" value=\"" + hub["hubtimer"] + "\"/></div>"; 

                $tc += "<input class=\"hidden\" name=\"hubaccess\" type=\"hidden\" value=\"" + hub["hubaccess"] + "\"/>"; 
                $tc += "<input class=\"hidden\" name=\"hubendpt\" type=\"hidden\" value=\"" + hub["hubendpt"] + "\"/>"; 
                $tc += "<input class=\"hidden\" name=\"hubrefresh\" type=\"hidden\" value=\"" + hub["hubrefresh"] + "\"/>"; 
                
                $tc += "<div>";
                $tc += "<input hubindex=\"" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" class=\"authbutton hubauth\" value=\"Authorize Hub #" + id + "\" type=\"button\" />";
                if ( hubindex !== 0 && hubId !== "new" && hubId!=="-1" ) {
                    $tc += "<input hubindex=\"" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" class=\"authbutton hubdel\" value=\"Remove Hub #" + id + "\" type=\"button\" />";
                }
                $tc += "</div>";
                
                $tc += "</form>";
            $tc += "</div>";
            
            i++;
        });
        $tc += "</div>";
        return $tc;
    }

}

function createSpecialIndex(customcnt, stype, spid, options) {
    var oldindex = clone(options["index"]);
    var maxindex = getMaxIndex();

    if ( !array_key_exists("specialtiles", options["config"]) ) {
        options["config"]["specialtiles"] = {};
    }
    options["config"]["specialtiles"][stype] = customcnt;

    // remove special types of this type
    var n = stype.length + 1;
    for (var idx in oldindex) {
        if ( idx.substr(0,n) === stype + "|" ) {
            delete options["index"][idx];
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
        options["index"][sidnum] = theindex;
    }
    return options;
}

// removed routine refactorOptions that renumbers all the things in your options file from 1
// because with the DB version this isn't needed or even possible

// emulates the PHP function for javascript objects or arrays
// new optional pos value will check the field named pos is it is an array of objects
function array_search(needle, arr, pos) {
    var key = false;
    if ( is_object(arr) ) {
        if ( pos ) {
            try {
                for (var t in arr) {
                    var check = arr[t][pos];
                    if ( check===needle || check.toString() === needle.toString() ) {
                        return arr[t];
                    }
                } 
            }
            catch(e) { key = false; }
        } else {
            try {
                for (var t in arr) {
                    if ( arr[t]===needle || arr[t].toString() === needle.toString() ) {
                        return arr[t];
                    }
                } 
            }
            catch(e) { key = false; }
        }
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

// checks if a needle is in an object or an array
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

function getKeyByValue(object, value) {
    // return Object.keys(object).find(key => object[key] === value);
    try {
        for ( var key in object ) {
            if ( object[key] === value || object[key].toString() === value.toString() ) {
                return key;
            }
        }
    } catch (e) {
        return null;
    }
    return null;
}

function is_string(obj) {
    return (typeof obj === "string");
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
        var thingindex = is_array($arr) ? $arr[0] : parseInt($arr);
        if ( $idxint === thingindex ) {
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
function getNewPage(userid, pname, configoptions, cnt, roomid, roomname, kroom, things, alldevices) {
    var $tc = "";
    $tc += "<div id=\"" + roomname + "-tab\">";
    $tc += "<form title=\"" + roomname + "\" action=\"#\">";
    
    // surround all things on a page with a div tied to the room name
    // added roomid from the database since that is now needed to process things
    // if one really wants to style by room number use the panel-kroom class which includes it
    // this will be the actual room order number not the DB roomid value - the DB roomid value is only used internally
    $tc += "<div id=\"panel-" + roomname + "\" roomid=\"" + roomid + "\" title=\"" + roomname + "\" class=\"panel panel-" + kroom + " panel-" + roomname + "\">";

    // the things list can be integers or arrays depending on drag/drop
    // var idxkeys = Object.keys(GLB.options["index"]);
    // var idxvals = Object.values(GLB.options["index"]);
    var zcolor = 200;
    things.forEach(function(thing) {
        
        // get the offsets and the tile id
        var tileid = thing["things_tileid"];
        var postop = thing["things_posy"];
        var posleft = thing["things_posx"];
        var zindex = thing["things_zindex"];
        var customname = thing["things_customname"];
        var id = thing["devices_deviceid"];
        var swtype = thing["devices_devicetype"];
        var thingname = thing["devices_name"];
        var hubid = thing["hubs_hubid"];
        var hint = thing["devices_hint"];
        var refresh = thing["devices_refresh"];
        var pvalue = JSON.parse(decodeURI2(thing["devices_pvalue"]));
        var hubtype = thing["hubs_hubtype"];

        // new id to make it easy to get to this specific thing later
        var thingid = thing["things_id"];

        // for now and testing purposes hack up a sensor
        if ( typeof pvalue !== "object" ) {
            pvalue = {name: ""};
        }

        // construct the old all things equivalent but add the unique thingid and roomid fields
        var thesensor = {id: id, name: thingname, thingid: thingid, roomid: roomid, type: swtype, hubnum: hubid, hubtype: hubtype,
                         hint: hint, refresh: refresh, value: pvalue};

        // if our thing is an object show it
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
            $tc += makeThing(userid, pname, configoptions, cnt, tileid, thesensor, roomname, postop, posleft, zindex, customname, false, alldevices);
        }
    });

    // end the form and this panel
    $tc += "</div></form>";

    // end this tab which is a different type of panel
    $tc +="</div>";
    return $tc;
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
function returnFile(userid, pname, thingvalue, thingtype, configoptions) {

    // do nothing if this isn't a special tile
    if ( !configoptions ) {
        return thingvalue;
    }

    var specialtiles = getSpecials(configoptions);
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

            // otherwise show any web file referenced or a blank just like below
            default:
                if ( $vn.startsWith("http") ) {
                    $v = "<iframe width=\"" + fw + "\" height=\"" + fh + "\" src=\"" + $vn + "\" frameborder=\"0\"></iframe>";
                } else if ( thingtype==="custom" ) {
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

    if ( DEBUG16 ) {
        console.log((ddbg()), "custom name for type: ", thingtype, " vn= ", $vn, " fn= ", fn, " v= ", $v);
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
        iconimg = "media/Weather/na.png";
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
        iconimg = "media/Weather/" + num + ".png";
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

function makeThing(userid, pname, configoptions, cnt, kindex, thesensor, panelname, postop, posleft, zindex, customname, wysiwyg, alldevices) {
    // const audiomap = {"title": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
    //                   "albumArtUrl": "trackImage", "mediaSource": "mediaSource"};
    // const musicmap = {"name": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
    //                   "status": "status", "trackMetaData": "trackImage", "trackImage":"trackImage", "metaData":"trackImage",
    //                   "trackNumber":"", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
    //                   "audioSource": "mediaSource"};
    const mantemp = {"temperature":"", "feelsLike":"", "name":"", "city":"", "weather":"", 
                     "weatherIcon":"", "forecastIcon":"","alertKeys":""};
    var $tc = "";
    var thingtype = thesensor["type"];
    var bid = thesensor["id"];
    if ( thingtype==="audio" ) {
        thesensor.value = translateAudio(thesensor.value);
        // console.log("audio data: ", UTIL.inspect(thesensor.value, false, null, false));
    } else if ( thingtype==="music" ) {
        thesensor.value = translateMusic(thesensor.value);
    }
    
    // add in customizations here
    if ( configoptions ) {
        thesensor.value = getCustomTile(userid, configoptions, thesensor.value, thingtype, bid);
        thesensor.value = setValOrder(thesensor.value);
        thesensor.value = returnFile(userid, pname, thesensor.value, thingtype, configoptions);
    }

    var thingvalue = thesensor.value;
        
    // set type to hint if one is given
    // this is to support ISY nodes that all register as ISY types
    // so we can figure out what type of tile this is closest to
    // this also is used to include the hub type in the tile
    var hint = thesensor["hint"] || "";
    var hubnum = thesensor["hubnum"] || "-1";
    var refresh = "normal";
    var thingid = thesensor.thingid;
    var hubtype = thesensor.hubtype || "None";

    // use override if there
    if ( array_key_exists("refresh", thesensor) && thesensor.refresh ) {
        refresh = thesensor["refresh"];
    }
    if ( array_key_exists("refresh", thingvalue) && thingvalue.refresh ) {
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

    // now swap out cnt for thingid since thingid is guaranteed to be unique
    cnt = thingid;

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
    // include the new thingid value for direct access to the specific thing in the DB
    $tc=   "<div id=\""+idtag+"\" thingid=\""+thingid+"\" aid=\""+cnt+"\" hub=\""+hubnum+"\" hubtype=\""+hubtype+"\" tile=\""+kindex+"\" bid=\""+bid+"\" type=\""+thingtype+"\" ";
    
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
        
        // see comments below about changes to link logic and companion use removal
        var j = 6;
        for ( var tkey in thingvalue ) {
            tkey = tkey.toString();
            if ( !array_key_exists(tkey, mantemp) ) {
                var tval = thingvalue[tkey];
                $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor);
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
            var jsontval;
            if ( is_object(tval) ) {
                jsontval = clone(tval);
            } else if ( typeof tval === "string" ) {
                try {
                    jsontval = JSON.parse(tval);
                } catch(jerr) {
                    jsontval = null;
                }
            }
            
            // skip special audio and music tiles
            if ( tkey==="audioTrackData" || tkey==="trackData" || tkey==="forecast" ) {
                jsontval = null;
                tval = null;
            }

            // handle other cases where the value is an object like audio or music tiles
            // but audio, music, and weather and handled elsewhere so don't do it again here
            if ( jsontval && is_object(jsontval) ) {

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

            else if ( hint==="ISY_scene" && tkey.substring(0,6)==="scene_" ) {
                tval = thingvalue["name"] + "<br>" + tval;
                $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, null, null, twidth, theight);
            }

            // else if ( tkey.substring(0,5)!=="user_" && typeof tval!=="object" ) { 
            else if ( typeof tval!=="object" ) { 
                
                // new logic for links - they all now follow the format LINK::code::content
                // we no longer print the hidden companion since the link details are in the DB now
                // and companion tags are only printed within LINK elements on the browser now
                // print a hidden field for user web calls and links
                // this is what enables customization of any tile to happen
                // this special element is not displayed and sits inside the overlay
                // we only process the non helpers and look for helpers in same list
                // $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, null, null, twidth, theight);

                if ( typeof tval === "string" && tval.startsWith("LINK::") && alldevices ) {
                // if (  array_key_exists(helperkey, thingvalue) ) { // } && thingvalue[helperkey] && thingvalue[helperkey].substr(0,2)==="::" ) {
                    // var helperval = thingvalue[helperkey];
                    // console.log(">>>> helper: ", helperkey, helperval);
                    var helperval = tval;
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

// compare this logic with how siblings are defined
// in the getCustomTile function
function putLinkElement(bid, helperval, kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, twidth, theight) {

    var linktype = thingtype;
    var linkhub = 0;
    var linkbid = bid;
    var subid = tkey;
    var realsubid = subid;
    var linkid = 0;

    var ipos = helperval.indexOf("::");
    var command = helperval.substr(0, ipos);
    var linkval = helperval.substr(ipos+2);

    // get info for links but skip if the link had an error
    // links use format - LINK::subid::tileid
    if ( linkval ) {
        
        var jpos = linkval.indexOf("::");
        if ( jpos !== -1 ) {

            realsubid = linkval.substr(0, jpos)
            var linkid = linkval.substr(jpos+2);
            
            // get the device for this linked tile
            var linkdev = alldevices[linkid];
            // if ( DEBUG10 ) {
            //     console.log(">>>> helperval: ", helperval, " ipos, jpos, realsubid, linkid: ", ipos, jpos, realsubid, linkid);
            //     console.log(">>>> linkdev: ", linkdev);
            // }

            // var lidx = linkval;
            // linkval = GLB.options.index[lidx];
            // var idxitems = lidx.split("|");
            // linktype = idxitems[0];
            // linkbid = idxitems[1];

            if ( linkdev ) {
                
                // replace the place holder value with the linked value
                try {
                    var linktileval = JSON.parse(decodeURI2(linkdev["devices_pvalue"]));
                } catch(e) {
                    linktileval = {};
                }
                linkid = linkdev["devices_id"];
                linkbid = linkdev["devices_deviceid"];
                linktype = linkdev["devices_devicetype"];
                linkhub = linkdev["hubs_id"];
                
                // now look for the real value in this device
                // use the link value - if subid isn't there look for subid's that form the beginning of our link subid
                var goodlink = false;
                if ( array_key_exists(realsubid, linktileval) ) {
                    tval = linktileval[realsubid];
                    goodlink = true;
                } else {
                    for (var ltkey in linktileval) {
                        if ( realsubid.startsWith(ltkey) ) {
                            realsubid = ltkey;
                            tval = linktileval[ltkey];
                            goodlink = true;
                            break;
                        }
                    }
                }

                // handle case where link not found - set error condition
                if ( !goodlink ) {
                    helperval = "LINK::"+realsubid+"::"+linkid+"::error";
                    tval = "LINK::error";
                    // console.log(">>>> linkid, linkbid, linktype, linkpvalue: ", linkid, linktype, linkbid, linktileval);
                }

                // look for width and height and replace if there
                if ( linktileval["width"] && twidth ) {
                    twidth = linktileval["width"];
                }
                if ( linktileval["height"] && theight ) {
                    theight = linktileval["height"];
                }

            } else {
                helperval = "LINK::error";
            }

            var sibling= "<div id=\"sb-"+cnt+"-"+subid+"\""+" aid=\""+cnt+"\" linkid=\""+linkid+"\" linktype=\""+linktype+"\" linkhub=\""+linkhub+"\" linkval=\""+helperval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
        } else {
            sibling = null;
        }
    }

    // use the original type here so we have it for later
    // but in the actual target we use the linktype
    // var sibling= "<div aid=\""+cnt+"\" linktype=\""+linktype+"\" value=\""+tval+"\" linkval=\""+linkval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
    if ( DEBUG10 ) {
        console.log( (ddbg()), "bid: ", bid, " helperval: ", helperval, " sibling: ", sibling,"\n >>>> new tval: ", tval);
    }
    var $tc = putElement(kindex, cnt, j, linktype, tval, tkey, subtype, bgcolor, sibling, realsubid, twidth, theight);
    return $tc;
}

function putElement(kindex, i, j, thingtype, tval, tkey, subtype, bgcolor, sibling, realsubid, twidth, theight) {
    
    // cleans up the name of music tracks for proper html page display
    // no longer trim the name because that breaks album art
    function fixTrack(tval) {
        if ( !tval || tval.trim()==="" ) {
            tval = "None"; 
        }
        return tval;
    }

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
    if ( tval===0 ) { tval = "0"; }
    else if ( typeof tval === "undefined" ) { tval = ""; }

    // do nothing if this is a rule and rules are disabled
    if ( !ENABLERULES && typeof tval==="string" && tval.substr(0,6)==="RULE::" ) {
        return $tc;
    }
        
    // fix thermostats to have proper consistent tags
    // this is supported by changes in the .js file and .css file
    
    if ( tkey==="hue" || tkey==="saturation" ||
         tkey==="heatingSetpoint" || tkey==="coolingSetpoint" || 
         (tkey.startsWith("Int_") && thingtype==="isy") ||
         (tkey.startsWith("State_") && thingtype==="isy") ) {

        var modvar = tkey;

        // fix thermostats to have proper consistent tags
        // this is supported by changes in the .js file and .css file
        // notice we use alias name in actual value and original key in up/down arrows
        $tc += "<div class=\"overlay " + tkey + " " + subtype + " v_" + kindex + "\">";
        if (sibling) { $tc += sibling; }
        $tc += aidi + " subid=\"" + modvar + "-dn\" title=\"" + modvar + " down\" class=\"" + thingtype + " arrow-dn " + modvar + "-dn " + pkindex + "\"></div>";
        $tc += aidi + " subid=\"" + modvar + "\" title=\"" + thingtype + " " + modvar + "\" class=\"" + thingtype + " arrow " + modvar + pkindex + "\"" + colorval + " id=\"" + aitkey + "\">" + tval + "</div>";
        $tc += aidi + " subid=\"" + modvar + "-up\" title=\"" + modvar + " up\" class=\"" + thingtype + " arrow-up " + modvar + "-up " + pkindex + "\"></div>";
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
                    tval = "<img class='" + tkey + "' width='" + twidth + "' height='" + theight + "' src='" + tval + "'>";
                } else {
                    tval = "<img class='" + tkey + "' src='" + tval + "'>";
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
        if ( tkey.startsWith("uom_") ) {
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

}

function getCustomCount(stype, defcount) {
    var customcnt = defcount;
    if ( GLB.options.config && array_key_exists("specialtiles", GLB.options.config) ) {
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

function getFormattedDate(fmtdate, d) {
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
    var retobj = {date: datestr, weekday: weekday};
    return retobj;
}

function getFormattedTime(fmttime, old, tzone) {
    if ( typeof old=== "undefined" || !old ) {
        old = new Date();
    }
    var utc = old.getTime() + (old.getTimezoneOffset() * 60000);
    
    var tz = parseInt(tzone);
    if ( isNaN(tz) ) { tz = old.getTimezoneOffset(); }
    var d = new Date(utc - (tz * 60000));
    // console.log("tz = ", tzone, tz);

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

    // var retobj = {fmt_time: fmttime, time: timestr, timezone: timezone};
    return timestr;
}

function getClock(userid, clockid, configoptions) {
    // set up all defaults here - can change with customizer
    var clockname = "Digital Clock";
    var clockskin = "";
    if ( clockid==="clockanalog" ) {
        clockname = "Analog Clock";
        clockskin = "CoolClock:swissRail:72";
    }
    var d = new Date();
    var fmtdate = "M d, Y";
    var dates = getFormattedDate(fmtdate, d);
    var dateofmonth = dates.date;
    var weekday = dates.weekday;

    // TODO - enable user timezone settings in options
    var fmttime = "h:I:S A";
    var timezone = d.getTimezoneOffset();
    var timeofday = getFormattedTime(fmttime, d, timezone);

    var dclock = {"name": clockname, "skin": clockskin, "weekday": weekday,
        "date": dateofmonth, "time": timeofday, "tzone": timezone,
        "fmt_date": fmtdate, "fmt_time": fmttime};

    // dclock = getCustomTile(userid, configoptions, dclock, "clock", clockid);
    // console.log("in getclock... clock = ", dclock, " ... configoptions: ", configoptions);
    return dclock;
}

function findDevice(bid, swtype, devices) {
    for (var id in devices) {
        var device = devices[id];
        if ( device["devices_deviceid"] === bid && device["devices_devicetype"] === swtype ) {
            return device["devices_id"];
        }
    }
    return null;
}

// the index of the Null hub is passed in to define these items
function updSpecials(userid, configoptions, hubindex, devices, clockonly) {
    // never refresh since clocks have their own refresh timer built into the javascript code
    // you will need to over-ride this with the tile customizer if you add custom fields

    function makeClock(clockid) {
        var clock = getClock(userid, clockid, configoptions);
        var clockname = clock.name;
        clock = encodeURI2(JSON.stringify(clock));
        var device = {userid: userid, hubid: hubindex, deviceid: clockid, name: clockname,
            devicetype: "clock", hint: "clock", refresh: "never", pvalue:  clock};
        return device;
    }

    
    // create promise result to return
    var digitalClock = makeClock("clockdigital");
    var id = findDevice("clockdigital", "clock", devices);
    if ( id ) {
        mydb.updateRow("devices", digitalClock, "id = "+id);
    } else {
        mydb.addRow("devices", digitalClock);        
    }

    var analogClock = makeClock("clockanalog");
    id = findDevice("clockanalog", "clock", devices);
    if ( id ) {
        mydb.updateRow("devices", analogClock, "id = "+id);
    } else {
        mydb.addRow("devices", analogClock);        
    }

    // create the controller tile if not already there for this user
    // keys starting with c__ will get the confirm class added to it
    // TODO - this should move to a new module that creates a new user
    id = findDevice("control_1", "control", devices);
    if ( !id ) {
        var controlval = {"name": "Controller", "showoptions": "Options","refreshpage": "Refresh","c__refactor": "Reset",
            "c__userauth": "Re-Auth","showid": "Show Info","toggletabs": "Toggle Tabs", "showdoc": "Documentation",
            "blackout": "Blackout","operate": "Operate","reorder": "Reorder","edit": "Edit"};
        controlval = encodeURI2(JSON.stringify(controlval));
        var device = {userid: userid, hubid: hubindex, deviceid: "control_1", "name": "Controller",
                      devicetype: "control", hint: "special", refresh: "never", pvalue: controlval};
        mydb.addRow("devices", device);
    }

    // if asked to only do clocks then return
    // we do this upon first page load because the specials will be there already
    // we call with false when specials need updating upon options page processing
    if ( clockonly ) { return; }

    // add special tiles based on type and user provided count
    // this replaces the old code that handled only video and frame tiles
    // this also creates image and blank tiles here that used to be made in groovy
    // putting this here allows them to be handled just like other modifiable tiles
    // these tiles all refresh fast except first 4 frames that are reserved for weather
    // renamed accuweather to forecast2 for simplicity sake and to make sorting work
    var specialtiles = getConfigItem(configoptions, "specialtiles");

    // make sure we have special tiles in our master list updated
    for (var stype in specialtiles) {
        var sid = specialtiles[stype];
        var fcnt = parseInt(sid);
        if ( isNaN(fcnt) ) {
            fcnt = 0;
        }
        
        for (var i=0; i<fcnt; i++) {
            var k = (i + 1).toString();
            var devname = getCustomName(stype, k);;
            if ( stype === "custom") {
                var devid = stype + "_" + k;
            } else {
                devid = stype + k;
            }
            
            var cid = findDevice(devid, stype, devices);
            if ( !cid ) {
                var ftile = encodeURI2(JSON.stringify({"name": devname}));
                device = {userid: userid, hubid: hubindex, deviceid: devid, name: devname,
                            devicetype: stype, hint: "special", refresh: "never", pvalue: ftile};
                // console.log(">>>> simulated add: ", device);
                mydb.addRow("devices", device);
            }
        }

        // TODO - test and debug
        var doneextra = false;
        for (var iextra= fcnt; iextra < 25; iextra++) {
            if ( stype === "custom") {
                var devid = stype + "_" + k;
            } else {
                devid = stype + k;
            }
            mydb.deleteRow("devices", "userid = "+userid+" AND deviceid = '"+devid+"' AND devicetype = '"+stype+"'")
            .then(res3 => {
                if ( !res3 || res3.getAffectedItemsCount() === 0 ) {
                    doneextra = true;
                }
            }).catch(reason => {
                console.log("dberror - updSpecials - ", reason);
                doneextra = true;
            });
            if ( doneextra ) {
                break;
            }
        }

    }
}

// make the default name start with a capital letter if we give a number
function getCustomName(defbase, cnum) {
    var defname;
    if ( cnum ) {
        defname = defbase.substr(0,1).toUpperCase() + defbase.substr(1);
        defname = defname + cnum;
    } else {
        defname = defbase;
    }
    return defname;
}

// create addon subid's for any tile
// this enables a unique customization effect
// we pass in the config options so this function doesn't run async
function getCustomTile(userid, configoptions, custom_val, customtype, bid) {

    var configkey = "user_" + bid;
    var updated_val = clone(custom_val);
    var dodebug = false;
    for ( var i in configoptions ) {

        var key = configoptions[i].configkey;
        var val = configoptions[i].configval;
        if ( key === configkey ) {
            if ( DEBUG14 ) {
                console.log((ddbg()), ">>>> key: ", key, " val: ", val);
            }
            if ( typeof val === "object" ) {
                var lines = val;
                updated_val = processCustom(lines, updated_val);
            } else if ( typeof val === "string" ) {
                try {
                    lines = JSON.parse(decodeURI2(val));
                    updated_val = processCustom(lines, updated_val);
                } catch(e) {
                    console.log( (ddbg()), "error - parsing custom config tile value: ", val, " for key: ", key);
                }
            }
            dodebug = true;
            break;
        }
    }
   
    if ( DEBUG14 && dodebug ) {
        console.log( (ddbg()),"updated tile value: ", updated_val);
    }

    return updated_val;

    function processCustom(lines, custom_val) {
        // allow user to skip wrapping single entry in an array
        // the GUI will never do this but a user might in a manual write to the DB
        if ( !is_array(lines[0]) ) {
            lines = [lines];
        }
        
        // sort the lines and add them back in the requested order
        // replacements of default items will occur in default place
        // usort(lines, sortlinefunc);

        // custom tags were redone to avoid the need for a companion tag
        // we now know from the type passed in and details obtained from DB upon clicking
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
                // var companion = "user_"+subid;

                // process web calls made in custom tiles
                // this adds a new field for the URL or LINK information
                // in a tag called user_subid where subid is the requested field
                // web call results and linked values are stored in the subid field
                if ( content && (calltype==="PUT" || calltype==="GET" || calltype==="POST" || calltype==="URL") )
                {
                    // custom_val[companion] = "::" + calltype + "::" + encodeURI(content);
                    custom_val[subid] = calltype + "::" + subid;
               
                } else if ( calltype==="LINK" ) {
                    // code for enabling mix and match subid's into custom tiles
                    // since DB reads are fast, we can just store the tileid now
                    // custom_val[companion] = "::" + calltype + "::" + content;
                    custom_val[subid]= "LINK::" + subid + "::" + content;
                            
               
                } else if ( calltype==="RULE" ) {
                    // custom_val[companion] = "::" + calltype + "::" + content;
                    custom_val[subid] = "RULE::" + subid;

                } else if ( calltype==="TEXT" ) {
                    // code for any user provided text string
                    // we could skip this but including it bypasses the hub call
                    // which is more efficient and safe in case user provides
                    // a subid that the hub might recognize - this way it is
                    // guaranteed to just pass the text on the browser
                    // custom_val[companion] = "::" + calltype + "::" + content;
                    custom_val[subid] = content;
                }
            }
        });

        try {
            // fix clock date if the format sting is provided
            var d = new Date();
            if ( array_key_exists("date", custom_val) && array_key_exists("fmt_date", custom_val) ) {
                var dates = getFormattedDate(custom_val["fmt_date"], d);
                custom_val["date"] = dates.date;
                custom_val["weekday"] = dates.weekday;
            }
            if ( array_key_exists("time", custom_val) && array_key_exists("fmt_time", custom_val) ) {
                custom_val["time"] = getFormattedTime(custom_val["fmt_time"], d, custom_val["tzone"]);
            }
        } catch (e) {
            console.log((ddbg()), "error - setting custom date format for clock");
        }
        
        if ( DEBUG14 ) {
            console.log((ddbg()), ">>>>  companion: ", companion, " customized tile: ", custom_val);
        }
        return custom_val;
    }
}

// this little gem makes sure items are in the proper order
function setValOrder(val) {
    const order = {"name": 1, "battery": 2, "color": 3, "switch": 7, "momentary": 7, "presence": 7,
                   "contact": 8, "door": 8, "motion": 9, "themode": 10, "temperature": 7, 
                   "make": 11, "modelName":12, "modelYear": 13, "vehiclecolor": 14, "nickName": 15,
                   "coolingSetpoint": 11, "heatingSetpoint": 12,
                   "thermostatMode": 21, "thermostatFanMode": 22, 
                   "thermostatSetpoint": 31, "thermostatOperatingState": 32, "humidity": 33, "thermostat": 34,
                   "mileage": 21, "longitude": 22, "latitude": 23, "distanceToEmpty": 24, 
                   "fuleLevel_value": 31,
                   "trackDescription": 11, "trackImage": 12, "currentAlbum": 13, 
                   "mediaSource": 14, "currentArtist": 15, "playbackStatus": 16, 
                   "_muteGroup": 17, "_unmuteGroup": 18, "_volumeDown": 19, "_volumeUp": 20, 
                   "_previousTrack": 21, "_pause": 22, "_play": 23, "_stop": 24, "_nextTrack": 25,
                   "_number_0":60, "_number_1":61, "_number_2":62, "_number_3":63, "_number_4":64, 
                   "_number_5":65, "_number_6":66, "_number_7":67, "_number_8":68, "_number_9":69, 
                   "onlevel": 150, "level": 151, "volume": 152, "colorTemperature": 153,
                   "allon": 41, "alloff": 42 };

    function getComp(vala) {
        var comp;
        if ( array_key_exists(vala, order) ) {
            comp = order[vala];
        } else if ( vala.startsWith("_number_") ) {
            comp = 60;
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

// TODO - finish updating and testing this
function processHubMessage(userid, hub, hubmsg, newST) {
    // loop through all devices tied to this message for any hub
    // push info to all things that match
    // we don't know the thing types so we have to check all things
    // this uses the format defined in the HousePanel.groovy file
    // that was also used in the old housepanel.push app
    var subid = hubmsg['change_attribute'];
    var hubmsgid = hubmsg['change_device'].toString();
    var origname = hubmsg['change_name'] || "";
    var swval = hubmsg['change_value'];
    if ( newST ) {
        var change_type = hubmsg["change_type"];
    } else {
        change_type = "string";
    }
    // msgtype: "update", 
    // hubid: hubId,
    // change_name: "",
    // change_device: swid,
    // change_attribute: attr,
    // change_type: "",
    // change_value: event.deviceEvent.value

    var pvalue;
    // pvalue[subid] = hubmsg['change_value'];

    // deal with presence tiles
    if ( subid==="presence" && hubmsg['change_value']==="not present" ) {
        hubmsg['change_value'] = "absent";
    }

    // update all devices from our list belonging to this user
    // the root device values are updated in the DB which causes all instances to update when pushClient is called below
    // this should take care of all links too
    var devid = null;

    mydb.getRows("devices","*", "userid = " + userid + " AND deviceid = '" + hubmsgid+"'")
    .then(devices => {

        if ( !devices ) { return; }

        devices.forEach(function(device) {

            if ( device.pvalue && device.pvalue!=="undefined" ) {
                pvalue = JSON.parse(decodeURI2(device.pvalue));
            } else {
                pvalue = {};
            }
            pvalue[subid] = hubmsg['change_value'];

            var swtype = device.devicetype;
            var newval;

            // handle special audio updates
            if ( swtype==="audio" ) {
                newval = translateAudio(pvalue);
            } else if ( swtype==="music" ) {
                newval = translateMusic(pvalue);
            } else if ( swtype==="weather" ) {
                var thisorigname = origname || device.name;
                newval = translateWeather(thisorigname, pvalue);
            } else {
                newval = pvalue;
            }

            if ( DEBUG12 ) {
                console.log( (ddbg()), "processHubMessage - hubmsgid: ", hubmsgid, " swtype: ", swtype, " subid: ", subid, " pvalue: ", newval);
            }

            if ( ! array_key_exists("skip_push", hubmsg) ) {
                pushClient(userid, hubmsgid, swtype, subid, newval);
            }
            newval.subid = subid;
            processRules(userid, device.id, hubmsgid, swtype, subid, newval, "processMsg");
            delete pvalue.subid;

            // update the DB
            device.pvalue = encodeURI2(JSON.stringify(newval));
            mydb.updateRow("devices", device, "id = "+device.id);

            // save the first device that matches
            if ( !devid ) {
                devid = device.id;
                devid = devid.toString();
            }

        });
        return devices;
    })
    .then(devices => {
        if ( DEBUG12 ) {
            console.log( (ddbg()), "processHubMessage - hubmsg: ", hubmsg, " devices: ", devices);
        }
    })
    .catch(reason => {
        console.log( (ddbg()), "processHubMessage - DB error: ", reason);
    });

    // now handle links including checking for triggers that have objects tied to them
    // link triggers are now handled on the javascript side

    // this happens for audio and music tiles and maybe others in the future
    // var newval;
    // try {
    //     newval = JSON.parse(hubmsg['change_value']);
    // } catch (e) { 
    //     newval = null;
    // }

    // if ( newval && strtype==="audio" && subid==="audioTrackData" ) {
    //     newval = translateAudio(newval, false);
    // } else if ( newval && strtype==="music" && subid==="trackData" ) {
    //     newval = translateAudio(newval, false, audiomap);
    // } else if ( newval && strtype==="weather" && subid==="forecast" ) {
    //     newval = translateWeather(origname, newval);
    // } else {
    //     newval = {};
    //     newval[subid] = hubmsg['change_value'];
    // }

    // // get all custom links
    // mydb.getRows("configs","*","userid = "+userid+" AND configkey LIKE 'user_%' AND configval LIKE '%LINK%'")
    // .then(rows => {

    //     if ( !rows ) { return; }
    //     rows.forEach(function(row) {
    //         var configkey = row.configkey;
    //         var bid = configkey.substr(5);
    //         var configval = JSON.parse(row.configval);

    //         configval.forEach(function(line) {
    //             var command = line[0];
    //             var val = line[1].toString();
    //             var linksubid = line[2];

    //             // if there is a link rule that matches this update, show it
    //             if ( command === "LINK" && val===devid.toString() && linksubid.startsWith(subid) ) {
    //                 var updobj = {};
    //                 updobj[linksubid] = newval[subid];
    //                 pushClient(userid, bid, "unknown", linksubid, updobj);
    //             }
    //         });
    //     });

    // })

}

function resetRules(userid) {
    GLB.rules[userid] = {};
    if ( DEBUG11 ) {
        console.log( (ddbg()), "reset dup flag for userid: ", userid);
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
// because ISY hubs are local, this function must be invoked locally
// TODO - figure out a way to support this once the code is on my server
//        one solution will be to provide a local connecter Node.js app
function processIsyMessage(userid, hub, isymsg) {
    var newval;
    var pvalue;

    xml2js(isymsg, function(err, result) {
        if ( !err && result.Event ) {
            var control = result.Event.control;
            var action = result.Event.action;
            var node = result.Event.node;
            var eventInfo = result.Event.eventInfo;
            var uom;
            if ( DEBUG9a ) {
                console.log( (ddbg()), "ISY event json result: ", UTIL.inspect(result, false, null, false) );
            }

            if ( is_array(node) && node.length && node[0]!=="" &&
                 is_array(control) && control.length && control[0]!=="" &&
                 action[0] && action[0]["$"] && action[0]["_"] ) {
                var bid = node[0];

                var conditions = "userid = "+userid+" AND devicetype = 'isy' AND deviceid = '"+bid+"'";
                mydb.getRow("devices", "*", conditions)
                .then(results => {

                    if ( !results ) { return; }

                    var device = results;
                    if ( DEBUGisy ) {
                        console.log( (ddbg()), "in processISYMessage - device: ", device);
                    }
                    try {

                        if ( device.pvalue && device.pvalue!=="undefined" ) {
                            try {
                                pvalue = JSON.parse(decodeURI2(device.pvalue));
                            } catch(e) {
                                pvalue = {};
                            }
                        } else {
                            pvalue = {};
                        }
                        
                        // adjust the value based on precision
                        newval = action[0]["_"];
                        if ( action[0]["$"]["prec"] ) {
                            newval = parseFloat(newval);
                            uom = action[0]["$"]["uom"] || "";
                            var prec = parseInt(action[0]["$"]["prec"]);
                            if ( ! isNaN(prec) && prec > 0 ) {
                                var pow10 = Math.pow(10,prec);
                                newval = newval / pow10;
                            }
                        }
                        newval = newval.toString();
                    } catch (e) {
                        console.log( (ddbg()), "warning - node // processIsyMessage: ", e, device);
                        return;
                    }

                    var subid = mapIsy(control[0], uom);
                    pvalue = translateIsy(bid, control[0], uom, subid, pvalue, newval, "");
                    pushClient(userid, bid, "isy", subid, pvalue);

                    pvalue.subid = subid;
                    processRules(userid, device.id, bid, "isy", subid, pvalue, "processMsg");
                    delete pvalue.subid;
                    
                    // update the DB
                    device.pvalue = encodeURI2(JSON.stringify(pvalue));
                    mydb.updateRow("devices", device, "id = "+device.id);
                    
                    if ( DEBUG9 ) {
                        console.log( (ddbg()), "ISY webSocket updated node: ", bid, " trigger:", control[0], " subid: ", subid, " uom: ", uom, " newval: ", newval, " pvalue: ", pvalue);
                    }
                }).catch(reason => {
                    console.log("dberror 10 - processIsyMessage - ", reason);
                });

            // set variable changes events
            // include test for an init action which is skipped (kudos to @KMan)
            } else if ( is_object(eventInfo[0]) && array_key_exists("var", eventInfo[0]) && action && action[0]==="6" ) {
                var varobj = eventInfo[0].var[0];
                if ( DEBUG9 ) {
                    console.log( (ddbg()), "Action: ", action, " Event info: ", UTIL.inspect(varobj, false, null, false) );
                }
                var bid = "vars";

                mydb.getRow("devices", "*", "userid = "+userid+" AND devicetype = 'isy' AND deviceid = '"+bid+"'")
                .then(results => {

                    if ( !results ) { return; }

                    var device = results;
                    
                    try {
                        if ( device.pvalue && device.pvalue!=="undefined" ) {
                            pvalue = JSON.parse(decodeURI2(device.pvalue));
                        } else {
                            pvalue = {};
                        }
                        var id = varobj["$"]["id"];
                        if ( varobj["$"]["type"] === "1" ) {
                            var subid = "Int_" + id;
                        } else if ( varobj["$"]["type"] === "2" ) {
                            subid = "State_" + id;
                        } else {
                            throw "invalid variable type: " + varobj["$"]["type"];
                        }

                        // make sure there is a val entry
                        if ( array_key_exists("val", varobj) ) {
                            if ( is_array( varobj.val) ) {
                                newval = parseFloat(varobj.val[0]);
                            } else {
                                newval = parseFloat(varobj.val);
                            }
                            if ( array_key_exists("prec", varobj) && is_array(varobj.prec) ) {
                                var prec = parseInt(varobj.prec[0]);
                                if ( !isNaN(newval) && ! isNaN(prec) && prec > 0 ) {
                                    newval = newval / Math.pow(10,prec);
                                }
                            } 
                            pvalue[subid] = newval.toString();
                            pushClient(userid, bid, "isy", subid, pvalue);
                            
                            pvalue.subid = subid;
                            processRules(userid, device.id, bid, "isy", subid, pvalue, "processMsg");
                            delete pvalue.subid;

                            // update the DB
                            device.pvalue = encodeURI2(JSON.stringify(pvalue));
                            mydb.updateRow("devices", device, "id = "+device.id);

                            if ( DEBUG9 ) {
                                console.log( (ddbg()), "ISY webSocket updated node: ", bid, " trigger:", control[0], " subid: ", subid, " newval: ", newval, " pvalue: ", pvalue);
                            }

                        }
                    } catch (e) {
                        console.log( (ddbg()), "warning - var // processIsyMessage: ", e, device);
                        return;
                    }
                }).catch(reason => {console.log("dberror 11 - processIsyMessage - ", reason);});

            // handle program changes events
            } else if ( is_object(eventInfo[0]) && array_key_exists("id", eventInfo[0]) && 
                        array_key_exists("r",  eventInfo[0]) && array_key_exists("f",  eventInfo[0]) ) {
                // var idsymbol = parseInt(eventInfo[0]["id"]);
                // idsymbol = idsymbol.toString();
                var idsymbol = eventInfo[0]["id"].toString().trim();
                var len = 4 - idsymbol.length;
                var bid = "prog_" + "0000".substr(0,len) + idsymbol;
                var subid = "status";

                mydb.getRow("devices","*", "userid = "+userid+" AND devicetype = 'isy' AND deviceid = '"+bid+"'")
                .then(results => {

                    if ( !results ) { return; }

                    var device = results;
                    try {
                        if ( device.pvalue && device.pvalue!=="undefined" ) {
                            pvalue = JSON.parse(decodeURI2(device.pvalue));
                        } else {
                            pvalue = {};
                        }
                        pvalue["lastRunTime"] = eventInfo[0]["r"][0];
                        pvalue["lastFinishTime"] = eventInfo[0]["f"][0];

                        // use decoder ring documented for ISY_program events
                        if ( array_key_exists("s", eventInfo[0]) ) {
                            var st = eventInfo[0]["s"][0].toString();
                            pvalue["status"] = st;
                            // if ( st.startsWith("2") ) {
                            //     pvalue["status"] = "true";
                            // } else if ( st.startsWith("3") ) {
                            //     pvalue["status"] = "false";
                            // } else if ( st.startsWith("1") ) {
                            //     pvalue["status"] = "unknown";
                            // } else {
                            //     pvalue["status"] = "not_loaded"
                            // }
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
                        pushClient(userid, bid, "isy", "lastRunTime", pvalue);

                        pvalue.subid = subid;
                        processRules(userid, device.id, bid, "isy", subid, pvalue, "processMsg");
                        delete pvalue.subid;

                        // update the DB
                        device.pvalue = encodeURI2(JSON.stringify(pvalue));
                        mydb.updateRow("devices", device, "id = "+device.id);
                        
                        if ( DEBUG9 ) {
                            console.log( (ddbg()), "ISY webSocket updated program: ", bid, " pvalue: ", device);
                        }
                    } catch(e) {
                        console.log( (ddbg()), "warning - program // processIsyMessage: ", e, device);
                        return;
                    }
                }).catch(reason => {
                    console.log("dberror 12 - processIsyMessage - ", reason);
                });

            } else if (DEBUG9a) {
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

function processRules(userid, deviceid, bid, thetype, trigger, pvalueinput, rulecaller) {

    if ( !ENABLERULES || (typeof pvalueinput !== "object") ) {
        return;
    }

    var pvalue = clone(pvalueinput);

    // fix button triggers to ignore held if pressed given and vice versa
    if ( trigger==="pushed" ) {
        pvalue["held"] = "";
        pvalue["released"] = "";
    }
    if ( trigger==="held" || trigger==="released" ) {
        pvalue["pushed"] = "";
    }

    // go through all things that could be links for this tile
    var configkey = "user_" + bid;
    var ifvalue = false;
    var rbid = bid;
    var rtype = thetype;

    var lines;
    var hubs;
    var devices;
    var rulesdone = {configs: false, hubs: false, devices: false};

    // retrieve customization for this device
    mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'")
    .then(results => {
        if ( results ) {
            lines = JSON.parse(decodeURI2(results.configval));
            if ( DEBUG11 ) {
                console.log( (ddbg()), "Rule processing for bid: ", bid," lines: ", lines);
            }
        } else {
            lines = null;
        }
        checkDone("configs");
        return lines;
    })
    .then(items => {

        // if a set of lines was found then retrieve all hubs and all devices since rules can act on any of these
        if ( items ) {
            mydb.getRows("hubs", "*", "userid = "+userid)
            .then(dbhubs => {
                hubs = {};
                for ( var ahub in dbhubs ) {
                    var id = dbhubs[ahub].id;
                    hubs[id] = dbhubs[ahub];
                }
                checkDone("hubs");
            })
            .then(results => {
                mydb.getRows("devices", "*", "userid = "+userid)
                .then(dbdevices => {
                    devices = {};
                    for ( var adev in dbdevices ) {
                        var id = dbdevices[adev].id;
                        devices[id] = dbdevices[adev]
                    }
                    checkDone("devices");
                });
            });
        }
    }).catch(reason => {console.log("dberror 13 - processRules - ", reason);});

    return;

    function checkDone(element) {
        if ( element ) {
            rulesdone[element] = true;
        }

        if ( rulesdone.configs && rulesdone.hubs && rulesdone.devices ) {
            if ( lines && hubs && devices ) {
                invokeRules(deviceid, lines, hubs, devices);
            }
        }
    }

    function invokeRules(tileid, items, hubs, devices) {
        // go through all tiles with a new rule type
        var idx = thetype + "|" + bid;
        
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
                                    var rulepvalue = JSON.parse(decodeURI2(devices[rvtile].pvalue));
                                    rulevalue = rulepvalue[rvindex];
                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "rvtile = ", rvtile, " rulevalue= ", rulevalue);
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
                                        ifvalue = pvalue[rulesubid];
                                    } else {
                                        try {
                                            rtype = devices[ruletileid].devicetype; 
                                            rbid = devices[ruletileid].deviceid;
                                            var ifpvalue = JSON.parse(decodeURI2(devices[ruletileid].pvalue));
                                            ifvalue = ifpvalue[rulesubid];
                                        } catch(e) {
                                            rtype = "";
                                            rbid = 0;
                                            ifvalue = false;
                                        }
                                    }

                                    // fix up ISY hubs
                                    if ( rtype==="isy" && rulevalue==="on" ) { rulevalue = "DON"; }
                                    if ( rtype==="isy" && rulevalue==="off" ) { rulevalue = "DOF"; }

                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "RULE debug: rtype= ", rtype, " rbid= ", rbid, " ifvalue: ", ifvalue, "rulevalue: ", rulevalue, " ruletileid: ", ruletileid, " parts: ", ruleparts );
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
                    execRules(userid, rulecaller, deviceid, thetype, 1, testcommands, pvalue, hubs, devices);
                }

            }

        });
    }
}

    // this executes the rules in the list starting with either 0 or 1
    // rules without if statements start at 0, if RULES start at 1
    function execRules(userid, rulecaller, deviceid, swtype, istart, testcommands, pvalue, hubs, devices) {
        // get a unique has for this rule to use for managing timers and gathering stats
        // we also use this to prevent dup rules within the same doAction cycle
        // var itemhash = pw_hash(item,'md5');

        if ( DEBUG11 ) {
            console.log( (ddbg()), "RULE commands: ", testcommands, " caller: ", rulecaller, " deviceid: ", deviceid, " type: ", swtype);
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
                // var ridx = false;

                // check for a stop all other timer rules command
                // this is done by entering 0=__delay as a rule segment
                // if ( rsubid==="__delay" ) {
                //     resetRuleTimers();
                // } else {
                //     // find the tile index and proceed with activating the rule
                //     ridx = array_search(rtileid, GLB.options["index"]);
                // }
                if ( DEBUG11 ) {
                    console.log( (ddbg()), "RULE debug: exec step #", i, " rtileid: ", rtileid, " rsubid: ", rsubid, " rvalue: ", rvalue, " rswattr: ", rswattr, " delay: ", delay);
                }

                if ( rtileid && devices[rtileid] ) {
                    // var idxitems = ridx.split("|");
                    var rswtype = devices[rtileid].devicetype;
                    var rswid = devices[rtileid].deviceid;
                    var hubindex = devices[rtileid].hubid;
                    var hub = hubs[hubindex];
                    var devpvalue = JSON.parse(decodeURI2(devices[rtileid].pvalue));

                    // handle requests for parameters of the trigger tile ($) or destination tile (@)
                    // disable hub calls for this type of rule
                    var trigtype = rvalue.substr(0,1);
                    if ( trigtype==="$" || trigtype==="@" ) {
                        var trigsubid = rvalue.substr(1);
                        if ( trigtype==="$" && array_key_exists(trigsubid, pvalue) ) {
                            rvalue = pvalue[trigsubid];
                        } else if ( trigtype==="@" && array_key_exists(trigsubid, devpvalue) ) {
                            rvalue = devpvalue[trigsubid];
                        }
                    }

                    // fix up ISY hubs and handle toggle
                    if ( rswtype==="isy" && devpvalue ) {
                        var curvalue = devpvalue[rsubid];
                        
                        if ( rswtype==="isy" ) {
                            if ( rvalue==="on" || (rvalue==="toggle" && curvalue==="DOF") ) { rvalue = "DON"; }
                            if ( rvalue==="off" || (rvalue==="toggle" && curvalue==="DON") ) { rvalue = "DOF"; }
                        } else {
                            if ( rvalue==="toggle" && curvalue==="off" ) { rvalue = "on"; }
                            if ( rvalue==="toggle" && curvalue==="on" ) { rvalue = "off"; }
                        }
                    } 

                    // set the destination to the value which would typically be overwritten by hub call
                    // if the destination is a link force the link to a TEXT type to neuter other types
                    var linkinfo = null;
                    // var companion = "user_"+rsubid;
                    var webstr = devpvalue[rsubid];
                    var n = typeof webstr === "string" ? webstr.indexOf("::",2) : -1;
                    if ( n !== -1 ) {

                        var command = webstr.substring(0, n);
                        // var actionstr = webstr.substring(n+2);
                        if ( DEBUG11 ) {
                            console.log( ">>>> trigger other custom from rule. sib val: ", webstr, " command: ", command);
                        }

                        // take action if it is in a rule
                        if ( command==="GET" || command==="POST" ) {

                            // neuter the hub call so we don't do both and invoke action function
                            hub = null;
                            doAction(userid, hub.hubid, thingid, rswid, rswtype, rvalue, rswattr, rsubid, null, command);
                            
                        }

                    // if destination subid isn't found make a user TEXT field
                    } else if ( !array_key_exists(rsubid, devpvalue) ) {
                        // addCustom(userid, deviceid, rswid, rswtype, "TEXT", rvalue, rsubid);
                        // linkinfo = [rswid, rswtype, rsubid, rsubid, "TEXT"];
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), " new custom field: ", rsubid, " created in tile: ", devpvalue);
                        }
                        // restart all clients to show the newly created field
                        // this only happens the first time the rule is triggered
                        // pushClient(userid, "reload", "main", "/");
                    }

                    if ( hub ) {

                        // handle level sliders and the funky attr values for other tiles
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
                        var thandle;

                        // make the hub call now or delayed
                        // if delayed we store the handle in our rules array so that
                        // should the same rule come along again we cancel this one first
                        // this way delay light on and off will stay on if trigger keeps happening
                        if ( delay && delay > 0 ) {
                            thandle = setTimeout( function() {
                                try {
                                    callHub(userid, hub.id, rswid, deviceid, rswtype, rvalue, rswattr, rsubid, linkinfo, true);
                                } catch (e) {
                                    console.log( (ddbg()), "error calling hub from rule: ", rswid, rswtype, rvalue, rswattr, rsubid, " error: ", e);
                                }
                            }, delay);
                        } else {
                            try {
                                if ( DEBUG11 ) {
                                    console.log("final rule step: id=",  rswid, "type=", rswtype, "value=", rvalue, "attr=", rswattr, "subid=", rsubid, "linkinfo=", linkinfo);
                                }
                                callHub(userid, hub.id, rswid, deviceid, rswtype, rvalue, rswattr, rsubid, linkinfo, true);
                            } catch (e) {
                                console.log( (ddbg()), "error calling hub from rule: ", rswid, rswtype, rvalue, rswattr, rsubid, " error: ", e);
                            }
                        }
                    }
                }


            }
        }

    }

function pushClient(userid, swid, swtype, subid, body, linkinfo) {
    // send the new results to all clients
    var entry = {};
    if ( typeof subid === "undefined" ) { subid= ""; }
    entry["id"] = swid;
    entry["type"] = swtype;
    entry["trigger"] = subid;
    var pvalue;

    if ( typeof body === "undefined" || !body ) {
        pvalue = "";
    } else {
        pvalue = body;
    }

    // create blank object if nothing given
    if ( !pvalue ) {
        pvalue = {};
    }
        
    // save the result to push to all clients
    entry["value"] = pvalue;

    // send mqtt message
    // eventually we can use MQTT on clients to receive this message instead of sendUTF below
    // if ( udclient && udclient.connected ) {
    //     udclient.publish("housepanel/pushClient", JSON.stringify(entry));
    // }
    
    if ( DEBUG17 ) {
        console.log( (ddbg()), "pushClient: ", UTIL.inspect(entry, false, null, false));
    }

    // do a push to each client for this user if ready
    if ( clients[userid] ) {
        for (var i=0; i < clients[userid].length; i++) {
            clients[userid][i].sendUTF(JSON.stringify(entry));
        }
    }

}

// TODO - continue fixing this for DB to write new value to devices
function callHub(userid, hubindex, swid, deviceid, swtype, swval, swattr, subid, linkinfo, inrule) {

    // first get the hub from the DB
    var result = mydb.getRow("hubs","*","userid="+userid+" AND id = " + hubindex)
    .then(hub => {

        if ( !hub ) { return null; }

        var access_token = hub.hubaccess;
        var endpt = hub.hubendpt;
        var result = "success";
        var hubid = hub.hubid;

        var valint = parseInt(swval);
        if ( isNaN(valint) ) {
            valint = 50;
        }
        if ( DEBUG7 ) {
            console.log( (ddbg()), "callHub: access: ", access_token, " endpt: ", endpt, " swval: ", swval, " subid: ", subid, " swtype: ", swtype, " attr: ", swattr, " hub: ", hub);
        }
        
        var isyresp = {};

        // this function calls the Groovy hub api
        if ( hub.hubtype==="SmartThings" || hub.hubtype==="Hubitat" ) {
            var host = endpt + "/doaction";
            var header = {"Authorization": "Bearer " + access_token};
            var nvpreq = {"swid": swid,  
                        "swattr": swattr,
                        "swvalue": swval, 
                        "swtype": swtype};
            if ( subid && subid!=="none" ) { nvpreq["subid"] = subid; }
            curl_call(host, header, nvpreq, false, "POST", getHubResponse);

        // make the call to the new ST API to control the device clicked on
        // TODO - implement logic that mirrors Groovy app behavior here
        } else if ( hub.hubtype==="NewSmartThings" ) {
            var header = {"Authorization": "Bearer " + access_token};
            var presult;
            var cap = subid;
            try {
                var capabilitiesList = GLB.capabilities[swtype][0];
                if ( !capabilitiesList.includes(cap) ) {
                    cap = capabilitiesList[0];
                }
            } catch(e) {
                cap = subid;
            }
            if ( DEBUG18 ) {
                console.log( (ddbg()), " Calling  new ST API doaction in callHub. subid: ", subid, " swid: ", swid, " swval: ", swval, " swtype: ", swtype, " cap: ", cap );
            }

            // first handle requests to call any function
            var nvpreq;
            
            // handle commands for switches and doors
            // the majority of all calls will be of this type
            if ( (swval==="on" || swval==="off") || 
                (subid==="door" && (swval==="open" || swval==="close")) ||
                (subid==="lock" && (swval==="unlock" || swval==="lock")) ) {
                nvpreq = {"commands": [ { component:"main", capability: cap, command: swval, arguments: [] } ] };
                if ( DEBUG7 ) {
                    console.log( (ddbg()), "Calling New ST callHub with: ", UTIL.inspect(nvpreq, false, null, false));
                }
            
            // support toggle commands
            } else if ( subid==="switch" && swval==="toggle" ) {

                nvpreq = null;

                mydb.getRow("devices","*","userid = "+userid+" AND id = "+deviceid)
                .then(device => {
                    var pvalue = JSON.parse(decodeURI2(device.pvalue));
                    var curval = pvalue[subid];
                    swval = curval==="off" ? "on" : "off";
                    var nvpreq = {"commands": [ { component:"main", capability: "switch", command: swval, arguments: [] } ] };

                    var host = endpt + "/devices/" + swid + "/commands";
                    if ( DEBUG7 ) {
                        console.log( (ddbg()), "Calling New ST callHub with: ", UTIL.inspect(nvpreq, false, null, false));
                    }
    
                    // curl_call(host, header, nvpreq, false, "POST", getHubResponse);
                    _curl(host, header, nvpreq, "POST", function(err, res, body) {

                        // if we get an unauthorized message error, refresh the token and try again
                        if ( err === 401 ) {
                            console.log(">>>> obtaining refresh token...");
                            newSTRefreshToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, false, function(err) {
                                if ( !err ) {
                                    callHub(userid, hubindex, swid, deviceid, swtype, swval, swattr, subid, linkinfo, inrule);
                                }
                            });
                            return;
                        }

                        // push results immediately to give user a responsive feel
                        // emulate the callback to getHubResponse done for other hubs
                        if ( (!err || err===200) ) {
                            pvalue[subid] = swval;
                            getHubResponse(err, body, pvalue);
                        }
                    });
                });
        
            // handle slider light levels
            } else if ( subid==="level" ) {
                swval = valint;
                nvpreq = {"commands": [ { component:"main", capability: "switchLevel", command: "setLevel", arguments: [swval] } ] };
            
            // handle slider volume levels
            } else if ( subid==="volume" ) {
                swval = valint;
                nvpreq = {"commands": [ { component:"main", capability: "audioVolume", command: "setVolume", arguments: [swval] } ] };
        
            // handle midway setting for shades - also will work for dimmer light levels
            } else if ( subid==="_presetPosition" ) {
                nvpreq = {"commands": [ { component:"main", capability: "windowShade", command: "presetPosition", arguments: [] } ] };
        
            // process color swaps
            } else if ( subid==="color" && swval.startsWith("hsl(") && swval.length==16 ) {
                var hue = swval.substring(4,7);
                hue= parseInt(hue);
                var saturation = swval.substring(8,11);
                saturation = parseInt(saturation);
                var v = swval.substring(12,15);
                v = parseInt(v);
                swval = swattr;
                presult = {color: swval, hue: hue, saturation: saturation, switch: "on"};
                if ( DEBUG7 ) {
                    console.log( (ddbg()), "New ST callHub setColor: ", colormap);
                }
                nvpreq = {"commands": [ { component:"main", capability: "colorControl", command: "setColor", arguments: [presult] } ] };

            // process the thermostat commands
            } else if ( subid==="coolingSetpoint-up" ) {
                nvpreq = getUpDownInfo("thermostatCoolingSetpoint", "setCoolingSetpoint", 1);
                presult = {thermostatCoolingSetpoint: swval};

            } else if ( subid==="heatingSetpoint-up" ) {
                nvpreq = getUpDownInfo("thermostatHeatingSetpoint", "setHeatingSetpoint", 1);
                presult = {thermostatHeatingSetpoint: swval};

            } else if ( subid==="coolingSetpoint-dn" ) {
                nvpreq = getUpDownInfo("thermostatCoolingSetpoint", "setCoolingSetpoint", -1);
                presult = {thermostatCoolingSetpoint: swval};

            } else if ( subid==="heatingSetpoint-dn" ) {
                nvpreq = getUpDownInfo("thermostatHeatingSetpoint", "setHeatingSetpoint", -1);
                presult = {thermostatHeatingSetpoint: swval};

            } else if ( subid==="_volumeUp" || subid==="_groupVolumeUp" ) {
                nvpreq = getUpDownInfo("audioVolume", "setVolume", 5);

            } else if ( subid==="_volumeDown" || subid==="_groupVolumeDown" ) {
                nvpreq = getUpDownInfo("audioVolume", "setVolume", -5);

            } else if ( subid==="thermostatMode" ) {
                const themodes = ["heat","cool","auto","off"];
                nvpreq = getFromList("thermostatMode", "setThermostatMode", themodes);
                
            } else if ( subid==="thermostatFanMode" ) {
                const themodes = ["auto","on","followschedule","circulate"];
                nvpreq = getFromList("thermostatFanMode", "setThermostatFanMode", themodes);

            // handle API call options for legacy HP the used attr for value
            } else if ( (swval==="cool" || swval==="coolingSetpoint") && !isNAN(parseInt(swattr)) ) {
                swval = parseInt(swattr);
                nvpreq = {"commands": [ { component:"main", capability: "coolingSetpoint", command: "setCoolingSetpoint", arguments: [swval] } ] };

            } else if ( (swval==="heat" || swval==="heatingSetpoint") && !isNAN(parseInt(swattr)) ) {
                swval = parseInt(swattr);
                nvpreq = {"commands": [ { component:"main", capability: "heatingSetpoint", command: "setHeatingSetpoint", arguments: [swval] } ] };

            // parset the music commands
            } else if ( subid==="_mute" || subid==="_unmute" ) {
                swval = subid.substr(1);
                nvpreq = {"commands": [ { component:"main", capability: "audioMute", command: swval, arguments: [] } ] };

            } else if ( subid==="_nextTrack" || subid==="_previousTrack" ) {
                swval = subid.substr(1);
                nvpreq = {"commands": [ { component:"main", capability: "mediaTrackControl", command: swval, arguments: [] } ] };

            } else if ( subid==="_pause" || subid==="_play" || subid==="_stop" ) {
                swval = subid.substr(1);
                nvpreq = {"commands": [ { component:"main", capability: "mediaPlayback", command: swval, arguments: [] } ] };

            } else if ( subid==="mute" || swval==="mute" ) {
                swval = swval === "mute" ? "unmute" : "mute";
                nvpreq = {"commands": [ { component:"main", capability: "audioMute", command: swval, arguments: [] } ] };

            } else if ( subid.startsWith("supportedTrackControlCommands") ) {
                nvpreq = {"commands": [ { component:"main", capability: "mediaTrackControl", command: swval, arguments: [] } ] };

            } else if ( subid.startsWith("supportedPlaybackCommands") ) {
                nvpreq = {"commands": [ { component:"main", capability: "mediaPlayback", command: swval, arguments: [] } ] };

            // direct commands processed here - setting presult to false skips the results push below
            } else if ( subid.startsWith("_") ) {
                var thecmd = subid.substr(1);
                if ( swtype === "audio" ) { cap = "mediaPlayback"; }
                presult = false;
                nvpreq = {"commands": [ { component:"main", capability: cap, command: thecmd, arguments: [] } ] };

            // default is we try to call the command - this usually will return nothing or an error
            } else {
                if ( cap === "switchlevel" ) { cap = "switch"; }
                if ( swtype === "audio" ) { cap = "mediaPlayback"; }
                console.log( (ddbg()), "Default callHub - cap: ", cap, " command: ", swval);
                nvpreq = {"commands": [ { component:"main", capability: cap, command: swval, arguments: [] } ] };
            }

            if ( nvpreq ) {
                var host = endpt + "/devices/" + swid + "/commands";
                if ( DEBUG20 ) {
                    console.log( (ddbg()), "Calling New ST callHub with: ", UTIL.inspect(nvpreq, false, null, false));
                }

                // curl_call(host, header, nvpreq, false, "POST", getHubResponse);
                _curl(host, header, nvpreq, "POST", function(err, res, body) {
                    if ( DEBUG20 ) {
                        console.log( (ddbg()), "New ST callHub result: ", err, body);
                    }

                    // if we get an unauthorized message error, refresh the token and try again later
                    if ( err === 401 ) {
                        console.log( (ddbg()), "obtaining refresh token...");
                        newSTRefreshToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, false, function (err) {
                            if ( !err ) {
                                callHub(userid, hubindex, swid, deviceid, swtype, swval, swattr, subid, linkinfo, inrule);
                            }
                        });
                        return;
                    }

                    // push results immediately to give user a responsive feel
                    // emulate the callback to getHubResponse done for other hubs
                    if ( (!err || err===200) && presult!==false ) {
                        if ( !presult ) {
                            presult = {};
                            presult[subid] = swval;
                        }
                        getHubResponse(err, body, presult);
                    }
                });
            } else {
                result = "error - unknown hub call for new ST hub: " + hub.hubname + " id: " + hub.hubid;
            }

        // implement the functions supported as described in the postman collection
        // but only the things that start with an underscore invoke the api call
        } else if ( hub.hubtype==="Ford" ) {

            // all API calls have the same header structure
            var host = endpt + "/" + swid; 
            var header = {"Authorization": "Bearer " + access_token,
                "Content-Type": "application/json",
                "api-version": FORDAPIVERSION,
                "Application-Id": hub.hubid 
            };

            switch(subid) {

                case "_info":
                    // set completion status to blank
                    pushClient(userid, swid, swtype, subid, {commandStatus: ""}, linkinfo);
                    curl_call(host, header, false, false, "GET", getHubResponse);
                    break;

                case "_unlock":
                case "_lock":
                case "_status":
                case "_startEngine":
                case "_stopEngine":
                case "_wake":
                case "_location":

                    // set completion status to running
                    pushClient(userid, swid, swtype, subid, {commandStatus: "RUNNING"}, linkinfo);

                    host = host + "/" + subid.substr(1);
                    curl_call(host, header, false, false, "POST", getHubResponse);
                    break;

                case "_thumbnail":
                    header["Accept"] = "*/*";
                    header["Accept-Encoding"] = "gzip, deflate, br";
                    header["Content-Type"] = "image/png";
                    host = host + "/images/thumbnail?make=" + swval.make + "&model=" + swval.modelName + "&year=" + swval.modelYear;
                    curl_call(host, header, false, false, "GET", getHubImage);
                    break;

                case "_image":
                    header["Accept"] = "*/*";
                    header["Accept-Encoding"] = "gzip, deflate, br";
                    header["Content-Type"] = "image/png";
                    host = host + "/images/full?make=" + swval.make + "&model=" + swval.modelName + "&year=" + swval.modelYear;
                    curl_call(host, header, false, false, "GET", getHubImage);
                    break;
        
                default:
                    result = "error - unknown field in a ford hub call: " + subid;
                    console.log( (ddbg()), result);
                    return result;
            }

        // this module below is the equivalent of the ST and HE groovy app
        // for ISY where the logic for handling actions is provided
        // compare this to the doAction function in HousePanel.groovy
        } else if ( hub.hubtype==="ISY" ) {
            // var buff = Buffer.from(access_token);
            // var base64 = buff.toString('base64');
            // var isyheader = {"Authorization": "Basic " + base64};
            // var cmd;
            // var hint = "";

            // fix up isy devices
            if ( swval==="on" ) { swval = "DON"; }
            else if ( swval==="off" ) { swval = "DOF"; }

            // set default subid so api calls will work
            if ( !subid ) {
                subid = "switch";
            }

            // only handle switches and dimmers in the cloud DB version of HP
            // this uses the webhooks feature of the ISY portal
            // they must be set up a special way and the hubrefresh set to the key
            switch(subid) {

                case "level":
                case "onlevel":

                    // convert percentage to 0 - 256 range for Insteon
                    var irange = Math.floor(parseInt(swval) * 255 / 100);
                    irange = irange.toString();

                    var hookname = swid;
                    hookname = hookname.replace(/ /g,"");
                    var hookon = hookname + "_DON";
                    hookname+= "_level";

                    // set the level
                    var hookurl = "https://my.isy.io/api/ifttt/" + hookname + "/key/" + hub.hubrefresh;
                    var header = {"Content-Type": "text/plain"};
                    _curl(hookurl, header, irange, "POST");
                    
                    // turn light on
                    var hookurlon = "https://my.isy.io/api/ifttt/" + hookon + "/key/" + hub.hubrefresh;
                    _curl(hookurlon, null, null, "POST");
                    
                    if ( DEBUG20 ) {
                        console.log( (ddbg()), "hookurl: ", hookurl, "subid: ", subid, " irange: ", irange, " swid: ", swid);
                    }
                    break;
        
                case "switch":
                case "DOF":
                case "DON":

                    var hookname = swid;
                    hookname = hookname.replace(/ /g,"");
                    if ( swval==="DON" || swval==="DOF" ) {
                        hookname+= "_" + swval;
                    } else {
                        hookname+= "_DON";
                    }
                    var hookurl = "https://my.isy.io/api/ifttt/" + hookname + "/key/" + hub.hubrefresh;
                    _curl(hookurl, null, null, "POST");
                    if ( DEBUG20 ) {
                        console.log( (ddbg()), "hookurl: ", hookurl, "subid: ", subid, " swid: ", swid);
                    }
                    break;
       
                default:

                    // handle arrows for variable changes
                    if ( subid.startsWith("Int_") ) {
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

                        // get the Variable device
                        mydb.getRow("devices","*","userid = "+userid+" AND deviceid = 'vars'")
                        .then(row => {

                            var pvalue = JSON.parse(decodeURI2(row.pvalue));
                            pvalue[realsubid] = intvar.toString();
                            var newpvalstr = encodeURI2(JSON.stringify(pvalue));
                            row.pvalue = newpvalstr;

                            // update the row;
                            mydb.updateRow("devices", row, "id = "+row.id);

                            // show result on screen
                            pushClient(userid, swid, swtype, realsubid, pvalue);

                        });
                    }
                }

        }

    }).catch(reason => {console.log("dberror 14 - callHub - ", reason);});
    return result;

    // --------------------- end of callHub commands ------------------------------
    // supporting sub-functions are below
    // ----------------------------------------------------------------------------
    function getUpDownInfo(attrname, cmdname, incr) {
        swval = parseInt(swval) + incr;
        var obj = {"commands": [ { component:"main", capability: attrname, command: cmdname, arguments: [swval] } ] };
        return obj;
    }

    function getFromList(attrname, cmdname, thelist) {
        var imode = getKeyByValue(thelist, swval);
        if ( imode === false ) {
            imode = 0;
        } else {
            imode++;
            if ( imode >= thelist.length ) { imode = 0; }
        }
        swval = thelist[imode];
        var obj = {"commands": [ { component:"main", capability: attrname, command: cmdname, arguments: [swval] } ] };
        return obj;
    }

    function extractTemp(val) {
        var newval;
        if ( swval.substr(-1)==="F" || swval.substr(-1)==="C" ) {
            newval = parseInt(swval.substr(0, swval.length-2));
        } else {
            newval = parseInt(swval);
        }
        return newval;
    }

    function getHubImage(err, res, body) {

        fs.writeFile("thumbraw.png", body, function() {
            console.log( (ddbg()), "return from image request: file written - thumbraw.png" );
        });
        var buff = Buffer.from(body);
        var base64 = buff.toString('base64');
        fs.writeFile("thumbnail.png", base64, function() {
            console.log( (ddbg()), "return from image request: file written - thumbnail.png" );
        });
    }

    function getHubResponse(err, res, body) {
        var pvalue;
        // var idx = swtype + "|" + swid;
        if ( DEBUG18 ) {
            console.log( (ddbg()), " trigger: ", subid, " rule: ", inrule, " call returned: ", body);
        }
        if ( err && err!== 200 ) {
            console.log( (ddbg()), "error calling ", hub.hubtype, " hub: ", err);
        } else {
            // update all clients - this is actually not needed if your server is accessible to websocket updates
            // It is left here because my dev machine sometimes doesn't get websocket pushes
            // you can comment this if your server gets pushes reliable
            // leaving it here causes no harm other than processing the visual update twice
            if ( body ) {

                // convert from json string
                try {
                    if ( typeof body==="object" ) {
                        pvalue = body;
                    } else {
                        pvalue = JSON.parse(body);
                    }
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
                        var thisorigname = pvalue.name;
                        pvalue = translateWeather(thisorigname, pvalue);

                    // pluck out just vehicle data and good status for info call
                    } else if ( swtype==="ford" && subid==="_info" && pvalue.vehicle && pvalue.status && pvalue.status==="SUCCESS" ) {
                        var vehicle = clone(pvalue["vehicle"]);
                        pvalue = {status: "SUCCESS"};
                        for (var key in vehicle) {
                            var val = vehicle[key];
                            if ( is_object(val) ) {
                                for ( var newid in val ) {
                                    if ( is_object(val[newid]) ) {
                                        for ( var subsubid in val[newid] ) {
                                            var newsub = newid+"_"+subsubid;
                                            pvalue[newsub] = val[newid][subsubid];
                                            if ( pvalue[newsub] === null || pvalue[newsub] === "null" ) {
                                                pvalue[newsub] = "";
                                            } else if ( pvalue[newsub]=== 0 ) {
                                                pvalue[newsub] = "0.0";
                                            } else {
                                                pvalue[newsub] = pvalue[newsub].toString();
                                            }
                                        }
                                    } else {
                                        if ( newid==="status" ) { newid = "vehicle_status"; }
                                        pvalue[newid] = val[newid];
                                        if ( pvalue[newid] === null || pvalue[newid] === "null" ) {
                                            pvalue[newid] = "";
                                        } else if ( pvalue[newid]=== 0 ) {
                                            pvalue[newid] = "0.0";
                                        } else {
                                            pvalue[newid] = pvalue[newid].toString();
                                        }
                                    }
                                }
            
                            } else if ( key!=="vehicleId" ) {

                                // change color subid since that is reserved for color light bulbs
                                // and convert single letter make into full name since that is used later
                                if ( key==="color" ) {
                                    pvalue["vehiclecolor"] = val;
                                } else if ( key==="make" && val==="F" ) {
                                    pvalue[key] = "Ford";
                                } else if ( key==="make" && val==="L" ) {
                                    pvalue[key] = "Lincoln";
                                } else {
                                    pvalue[key] = val;
                                }
                            }
                        }
                    } else if ( swtype==="ford" ) {
                        if ( pvalue.error || (pvalue.status && pvalue.status!=="SUCCESS") ) {
                            pvalue.status = "ERROR";
                            pvalue.error = "invalid_grant";
                            pvalue.error_description = "Access token expired and is being refreshed. Try again soon.";
                            fordRefreshToken(hub, hub.hubaccess, hub.hubendpt, hub.hubrefresh, hub.clientid, hub.clientsecret, false);
                            // getDevices(hub, true, "/");
                        }
                    }

                    // push new values to all clients and execute rules
                    pushClient(userid, swid, swtype, subid, pvalue, linkinfo);
                    if ( !inrule ) {
                        pvalue.subid = subid;
                        processRules(userid, deviceid, swid, swtype, subid, pvalue, "callHub");
                        delete pvalue.subid;
                    }
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
            if ( DEBUG18 || DEBUG14) {
                console.log( (ddbg()), "Linkinfo: ", linkinfo, " targetobj: ", targetobj);
            }
            pushClient(userid, linkinfo[0], linkinfo[1], linksubid, targetobj);
            if ( !inrule ) {
                // targetobj.subid = linksubid;

                // TODO - change linkinfo to include the linked deviceid
                // processRules(userid, deviceid, linkinfo[0], linkinfo[1], linksubid, targetobj, "callHub");
                // delete targetobj.subid;
            }
        }


    }
}

// TODO - add newSmartThings type and Ford hubs support for query
// userid, thingid, swid, swtype, thingname, pvalue, hubhost, access_token, refresh_token, endpt, clientid, clientsecret
function queryHub(userid, thingid, hubindex, swid, swtype, thingname ) {

    mydb.getRow("hubs","*","id = " + hubindex)
    .then(result => {

        var host = hub["hubhost"];
        var access_token = hub["hubaccess"];
        var refresh_token = hub["hubrefresh"];
        var endpt = hub["hubendpt"];
        var clientid = hub["clientid"];
        var clientsecret = hub["clientsecret"];

        if ( hub.hubtype==="SmartThings" || hub.hubtype==="Hubitat" ) {
            var host = endpt + "/doquery";
            var header = {"Authorization": "Bearer " + access_token};
            var nvpreq = {"swid": swid, "swtype": swtype};
            curl_call(host, header, nvpreq, false, "POST", getQueryResponse);

        } else if ( hub.hubtype==="ISY" ) {
            var buff = Buffer.from(access_token);
            var base64 = buff.toString('base64');
            var header = {"Authorization": "Basic " + base64};
            var cmd = "/nodes/" + swid;
            curl_call(endpt + cmd, header, false, false, "GET", getNodeQueryResponse);

        }

    }).catch(reason => {console.log("dberror 15 - queryHub - ", reason);});
    
    function getQueryResponse(err, res, pvalue) {
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
                    pvalue = translateWeather(thingname, pvalue);
                }

                // store results back in DB
                mydb.updateRow("devices", {pvalue: encodeURI2(JSON.stringify(pvalue))}, "id = " + thingid + " AND userid = " + userid);

                // push results to all clients
                pushClient(userid, swid, swtype, "none", pvalue);

                // force processing of rules for weather and clocks on a query
                // no longer do this because we don't know the weather and clock device id easily
                // if ( swtype==="weather" || swtype==="clock" ) {
                //     pvalue.subid = "timer";
                //     processRules(swid, swtype, "timer", pvalue, "queryHub");
                //     delete pvalue.subid;
                // }
            }
        }
    }

    function getNodeQueryResponse(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "error requesting ISY node query: ", err);
        } else {
            xml2js(body, function(xmlerr, result) {
                try {
                    if ( result ) {
                        var nodeid = result.nodeInfo.node[0]["address"];
                        nodeid = fixISYid(nodeid);
                        if ( nodeid ) {

                            var props = result.nodeInfo.properties[0].property;

                            // first read the existing field data to update the json string
                            // pass to our field updater which does the screen update
                            mydb.getRow("devices","*","userid = " + userid + " AND deviceid = '"+nodeid+"'")
                            .then(device => {
                                if (device) {
                                    setIsyFields(userid, nodeid, device, props, true);
                                }
                            }).catch(reason => {console.log("dberror 16 - getNodeQueryResponse - ", reason);});

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
    if ( typeof specialkey === "undefined" || !specialkey ) {
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
    var hub = mydb.getRow("hubs","*","hubid='"+hubid+"'");
    return hub;
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
    } else if ( clktype==="weather" || clkid.startsWith("Int_") || clkid.startsWith("State_") || clkid.startsWith("event_") || in_array(clkid, infoclicks) ) {
        test = true;
    }
    return test;
}

function doAction(userid, hubid, thingid, configoptions, swid, swtype, swval, swattr, subid, command, linkv, protocol) {

    // reset rules
    // resetRules(userid);

    // could do this using either a query for a device type based on bid and type or grab the specific thing id
    // using the latter technique which requires a DB join but is more accurate
    // first get the device tied to this action request
    // mydb.getRow("devices","*","userid = " + userid + " AND deviceid = '"+swid + "' AND devicetype = '"+swtype+"'")
    var joinstr = mydb.getJoinStr("things","tileid","devices","id");
    var pr = mydb.getRow("things","*","things.userid = " + userid + " AND things.id = " + thingid, joinstr)
    .then(device => {

        var msg = "success";

        if ( !device ) {
            msg = "error - device not found in call to doAction. thingid: " + thingid + " swid: " + swid;
            console.log( (ddbg()), msg);
            return msg;
        }

        // var hubindex = device.hubid;
        var hubindex = device["devices_hubid"];
        var pvalue = device["devices_pvalue"];               // device.pvalue;
        // var deviceid = device["devices_deviceid"];          // device.deviceid;
        // var devicetype = device["devices_devicetype"];      // device.devicetype;

        pvalue = JSON.parse(decodeURI2(pvalue));

        if ( DEBUG7 ) {
            console.log( (ddbg()), "doaction: thingid: ", thingid, " swid: ", swid, " swtype:", swtype, " swval: ", swval, " hubindex: ", hubindex,
                                   " hubid: ", hubid, " swattr: ", swattr, " subid: ", subid, " command: ", command, " pvalue: ", pvalue);
        }
    
        // do nothing but push tile to clients if this is not clickable
        // if ( (typeof command==="undefined" || !command) && testclick(swtype, subid) ) {
        //     pushClient(userid, deviceid, devicetype, subid, pvalue);
        //     return;
        // }

        // next check for a command
        var linkval = linkv;
        if ( linkval && command) {

            if ( command==="POST" || command==="PUT" ) {
                // var posturl = linkval;
                var hosturl = url.parse(linkval);
                var posturl = hosturl.origin + hosturl.pathname;
                var parmstr = hosturl.search;
                var parmobj = hosturl.searchParams;
                curl_call(posturl, null, parmobj, false, command, urlCallback);
                msg = "command: " + command + " call: " + posturl + " parmstr: " + parmstr + " parmobj: " + parmobj;

            } else if ( command==="GET" ) {
                hosturl = url.parse(linkval);
                posturl = hosturl.href;
                var parmobj = hosturl.searchParams;
                curl_call(posturl, null, parmobj, false, command, urlCallback);
                msg = "command: " + command + " call: " + posturl;

            } else if ( command==="TEXT" ) {
                if ( typeof pvalue === "object" ) {
                    pushClient(userid, swid, swtype, subid, pvalue);
                    pvalue.subid = subid;
                    processRules(userid, thingid, swid, swtype, subid, pvalue, "callHub");
                    delete pvalue.subid;
                    msg = pvalue;
                } else {
                    msg = "error - invalid object value";
                }

            } else if ( command==="LINK" ) {
                // processLink(linkval);
                // console.log(">>>> LINK callHub: ", hubid, swid, swtype, swval, swattr, subid);
                callHub(userid, hubid, swid, thingid, swtype, swval, swattr, subid, null, false);
                msg = pvalue;
            
            } else if ( command==="RULE" ) {
                if ( !ENABLERULES ) {
                    msg = "error - rules are disabled.";
                } else {
                    var configkey = "user_" + swid;
                    linkval = linkval.toString();
                    var devices = {};
                    var hubs = {};
                    msg = mydb.getRows("devices", "*", "userid = "+userid)
                    .then(dbdevices => {
                        for ( var adev in dbdevices ) {
                            var id = dbdevices[adev].id;
                            devices[id] = dbdevices[adev]
                        }
                        return devices;
                    })
                    .then( () => {
                        return mydb.getRows("hubs", "*", "userid = "+userid)
                        .then(dbhubs => {
                            for ( var ahub in dbhubs ) {
                                var id = dbhubs[ahub].id;
                                hubs[id] = dbhubs[ahub];
                            }
                        });
                    })
                    .then( () => {

                        return mydb.getRow("configs","*","userid = "+userid+" AND configkey='"+configkey+"'")
                        .then(row => {

                            if ( row ) {
                                // console.log(">>>> config row: ", row, "\n>>>> hubs: ", hubs, "\n>>>> devices: ", devices);
                                var lines = JSON.parse(row.configval);
                                if ( is_array(lines) ) {
                                    lines.forEach(function(rule) {
                                        if ( rule[0]==="RULE" && rule[2]===linkval) {
                                            const regsplit = /[,;]/;
                                            var therule = rule[1];
                                            var testcommands = therule.split(regsplit);
                                            var istart = 0;
                                            if ( testcommands[0].trim().startsWith("if") ) {
                                                istart = 1;
                                            }
                                            execRules(userid, "callHub", thingid, swtype, istart, testcommands, pvalue, hubs, devices);
                                        }
                                    });

                                }
                                return "success - rule manually executed";
                            } else {
                                return "error - rule not found for id = " + swid;
                            }
                        });
                    });
                }
            }

        } else {
            // console.log( (ddbg()), "callHub: ", hubindex, swid, thingid, swtype, swval, swattr, subid);
            callHub(userid, hubindex, swid, thingid, swtype, swval, swattr, subid, null, false);
            msg = pvalue;
        }
        return msg;
    })
    .catch(reason => {
        var msg = "error - reading devices in doAction";
        console.log(msg, reason);
        return msg;
    });
    return pr;

    function processLink(linkthingid) {

        console.log(">>>> in processLinks: ", linkthingid);

        // link commands used to get the linkval setting from the tile click
        // but we now get it from the options in the DB just like other tiles
        // get the tile unless it is this one
        mydb.getRow("devices","*","id = "+linkthingid)
        .then(linkdev => {

            if ( linkdev ) {
                var $lhub = linkdev.hubid;
                var $linked_swtype = linkdev.devicetype;
                var $linked_swid = linkdev.deviceid;
                var $linked_val = JSON.parse(decodeURI2(linkdev.pvalue));

                // make hub call if requested and if the linked tile has one
                // var $lhub = findHub($linked_hubnum);

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
                    console.log( (ddbg()),"linked_hubindex: ", linkdev.hubid, " linked_type: ", $linked_swtype,
                                            " linked_id: ", $linked_swid, " linked_val: ", $linked_val, 
                                            " realsubid: ", $realsubid );
                }
                // make the action call on the linked thing
                // the hub callback now handles the linked resposnes properly
                // if link is to something static, show it
                if ( $realsubid ) {
                    if ( testclick($linked_swtype, $realsubid) ) {
                        pushClient(userid, $linked_swid, $linked_swtype, $realsubid, $linked_val);
                    } else {
                        // TODO - include thingid in the linkinfo array
                        var linkinfo = [swid, swtype, subid, $realsubid, "LINK"];
                        callHub(userid, $lhub, $linked_swid, thingid, $linked_swtype, swval, swattr, $realsubid, linkinfo, false);
                    }
                }
            }
        }).catch(reason => {console.log("dberror 17 - processLink - ", reason);});
    }

    function urlCallback(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "URL callback returned error: ", err);
        } else if ( typeof body === "object" ) {
            // add any fields returned as an object
            // for ( var bkey in body ) {
            //     if ( typeof body[bkey]==="string" ) {
            //         webresponse[bkey] = body[bkey]
            //     } else if ( typeof body[bkey]==="object" ) {
            //         webresponse[bkey] = JSON.stringify(body[bkey]);
            //     }
            // }
            if ( !subid.startsWith("_") ) {
                pushClient(userid, swid, swtype, subid, body);
            }
            console.log( (ddbg()), "URL callback returned: ", UTIL.inspect(body, false, null, false));
            // pushClient(userid, swid, swtype, subid, webresponse);
        } else if ( typeof body === "string" && body!=="" && body!=="success" ) {
            // skip setting results if the subid starts with an underscore signaling a command
            // always skip if the body is empty or the word success
            if ( !subid.startsWith("_") ) {
                try {
                    var webresponse = JSON.parse(body);
                    for (var key in webresponse) {
                        if ( typeof webresponse[key] === "object" ) {
                            webresponse[key] = JSON.stringify(webresponse[key]);
                        }
                    }
                } catch(e) {
                    webresponse = {};
                    var subidres = subid + "_response";
                    webresponse[subidres] = body;
                }
                pushClient(userid, swid, swtype, subid, webresponse);
            }
            console.log( (ddbg()), "URL callback returned: ", body);
        }
        if ( DEBUG13 ) {
            console.log( (ddbg()), "URL callback response: ", UTIL.inspect(body, false, null, false) );
        }
    }

}

function doQuery(userid, thingid, protocol) {
    var result;

    if ( thingid==="all" || thingid==="fast" || thingid==="slow" ) {

        var rtype = swid==="all" ? "normal" : swid;
        var conditions = "userid = " + userid + " AND refresh = " + rtype;
        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        result = mydb.getRows("devices","*", conditions)
        .then(devices => {

            // fix up music and weather and add file info
            for ( var i=0; i < devices.length; i++ ) {
                var swid = devices[i]["deviceid"];
                var swtype = devices[i]["devicetype"];
                var pvalue = JSON.parse(decodeURI2(devices[i]["pvalue"]));
                var devicename = devices[i]["name"];
    
                // deal with audio tiles
                if ( swtype==="audio" ) {
                    pvalue = translateAudio(pvalue);
                } else if ( swtype==="music" ) {
                    pvalue = translateMusic(pvalue);
                // deal with accuweather
                } else if ( swtype==="weather" ) {
                    pvalue = translateWeather(devicename, pvalue);
                }
                var firstsubid = Object.keys(pvalue)[0];

                // push result to the clients
                pushClient(userid, swid, swtype, firstsubid, pvalue);
            }
            return devices;
        }).catch(reason => {console.log("dberror 18 - doQuery - ", reason);});

    // a specific device is being requested
    // lets get the device info and call its hub function
    } else {

        var conditions = "id = "+thingid + " AND userid = " + userid;
        result = mydb.getRow("devices","*", conditions)
        .then(device => {

            if ( !device ) {
                return "error - invalid device: " + thingid + " hubid: " + hubid;
            } else {

                // query the hub which pushes update to GUI if we queried using POST
                // which normally is only from GUI but user could use POST so beware
                // that if you use the HP api in POST mode that all clients will be updated
                // whenever you query a tile. To avoid this use the GET method to query a tile
                // note that actions will always update clients to keep them in sync
                // the GET function waits for the promise to put results to the browser
                var hubindex = device.hubid;
                var swid = device.deviceid;
                var swtype = device.devicetype;
                var thingname = device.name;

                if ( protocol==="POST" ) {
                    queryHub(userid, thingid, hubindex, swid, swtype, thingname );
                    qres = "success - clients will be updated via a webSocket push";
                } else {
                    qres = pvalue;
                }
                return qres;
            }
        }).catch(reason => {console.log("dberror 19 - doQuery - ", reason);});

    }

    // console.log("Result: ", result);
    return result;
}

function setOrder(userid, swtype, swval) {
    var result;
    var num = 0;

    if ( swtype==="rooms" ) {

        for ( var k in swval ) {
            var roomid = swval[k].id;
            var updval = { rorder: swval[k]["rorder"], rname: swval[k]["rname"] };
            // console.log("roomid: ", roomid, " updval: ", updval);
            mydb.updateRow("rooms", updval, "id = "+roomid)
            .then(results => {
                if ( results ) {
                    // console.log(results.getAffectedItemsCount() );
                    num++;
                }
            }).catch(reason => {console.log("dberror 20 - setOrder - ", reason);});
        }
        result = "success - updated order of " + num + " rooms for user = " + userid;

    } else if ( swtype==="things" ) {

        for ( var kk in swval ) {
            var thingid = swval[kk].id;
            // var updval = swval[kk].updval;
            var updval = {tileid: swval[kk].tileid, torder: swval[kk].torder};
            if ( updval ) {
                // console.log("setOrder of tiles.  thingid: ", thingid, " updval: ", updval);
                mydb.updateRow("things", updval, "id = "+thingid)
                .then(results => {
                    if ( results && swval[kk].position==="relative" ) {
                        num++;
                    }
                });
            }
        }
        result = "success - updated order of " + num + " relatively placed things for user = " + userid;

    } else {
        result = "error - unrecognized request to sort order. type: " + swtype;
    }
    return result;
}

function setPosition(userid, swid, swtype, panel, swattr, tileid, thingid) {
    
    // first find which index this tile is
    // note that this code will not work if a tile is duplicated on a page
    // such duplication is not allowed by the UI anyway but in the
    // event that a user edits hmoptions.cfg to have duplicates
    // the code will get confused here and in other places
    // $i = array_search($tile, options["things"][$panel]);
    // -------------------
    // the above nonsense is solved with the new DB version
    // we just get the direct device from thingid
    var top = parseInt(swattr["top"]);
    var left = parseInt(swattr["left"]);
    var zindex = parseInt(swattr["z-index"]);
    var postype = swattr["position"] || "absolute";

    // check user and tileid even though just the thingid should be enough
    // this is to protect against any random API post call updating the DB without doing it right
    var pr = mydb.getRow("things","*","userid = "+userid+" AND id = "+thingid)
    .then(thing => {

        if ( thing ) {
            // update positions
            thing.posy = top;
            thing.posx = left;
            thing.zindex = zindex;

            //  this id value should be exactly the same as thingid
            // update the location permanently and also push new location to all other panels
            var id = thing.id;
            mydb.updateRow("things", thing, "id = " + id)
            .then(result => {
                if ( result ) {
                    var tileloc = {left: left, top: top, "z-index": zindex, position: postype};
                    pushClient(userid, "setposition", thingid, "", tileloc);
                    if ( DEBUG6 ) {
                        console.log( (ddbg()), "moved tile: ", thing, " to a new position: ", tileloc);
                    }
                    return tileloc;
                } else {
                    console.log( (ddbg()), "error - failed to update position for tile: ", tileid, " to permanent position: ", top, left, zindex, postype);
                    return "error - failed up to update position for tile: " + tileid;
                }
            });
        } else {
            console.log( (ddbg()), "error - could not find tile: ", tileid, " to move to position: ", top, left, zindex);
            return "error - could not find tile: " + tileid;
        }
    }).catch(reason => {console.log("dberror 21 - setPosition - ", reason);});

    return pr;
}

// userid, swid, swtype, rname, hubid, hubindex, roomid, startpos
function addThing(userid, pname, bid, thingtype, panel, hubid, hubindex, roomid, pos) {

    // first get the max order number of the tiles in this room
    // var querystr = "SELECT Max(torder) FROM things WHERE roomid = " + roomid;
    // var promiseResult = mydb.query(querystr)
    var promiseResult = mydb.getRows("things","torder","roomid = "+roomid)
    .then(result => {
        var maxtorder = 0;
        result.forEach(row => {
            if ( row.torder > maxtorder ) { maxtorder = row.torder; }
        });
        maxtorder++;

        // console.log(">>>> max torder = ", maxtorder );
        return maxtorder
    })
    .then(maxtorder => {

        // let's retrieve the thing from the database
        // var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        // var promiseResult = mydb.getRow("devices", "*", "devices.userid = "+userid+" AND devices.hubid='"+hubindex+"' AND devices.deviceid='"+bid+"' AND devices.devicetype='"+thingtype+"'", joinstr)
        var promiseResult = mydb.getRow("devices", "*", "userid = "+userid+" AND hubid='"+hubindex+"' AND deviceid='"+bid+"' AND devicetype='"+thingtype+"'")
        .then(row => {

            // console.log(">>>> addThing row: ", row, bid, thingtype, hubid);
            if ( row && is_object(row) ) {

                var device = row;
                var tileid = device["id"];
                var pvalue = JSON.parse(decodeURI2(device["pvalue"]));
                var hint = device["hint"];
                var refresh = device["refresh"];
                
                // construct the thing to add to the things list
                var athing = {userid: userid, roomid: roomid, tileid: tileid, posx: 0, posy: 0, zindex: 1, torder: maxtorder, customname: ""};
                var result = mydb.addRow("things", athing)
                .then(result => {
                    if ( result ) {

                        // obtain the new id of the added thing
                        var thingid = result.getAutoIncrementValue();

                        // now make the visual tile and return it as a promised value
                        // construct the old things element equivalent but add the unique thingid and roomid fields
                        var thesensor = {id: bid, thingid: thingid, roomid: roomid, type: thingtype, hubnum: hubid, 
                                        hint: hint, refresh: refresh, value: pvalue};
                        var thing = makeThing(userid, pname, null, thingid, tileid, thesensor, panel, 0, 0, 1, "", false, null);
                        console.log( (ddbg()), "added tile #",tileid," (thingid = ",thingid,") of type: ",thingtype," to page: ",panel,
                                            " deviceid: ", bid, " hubid: ", hubid, " hubindex: ", hubindex);
                        return thing;
                    } else {
                        return "error - could not create a new device of type " + thingtype + " on page " + panel;
                    }
                });
                return result;
            } else {
                // return null;
                return "error - could not find device of type " + thingtype + " in your list of authenticated devices";
            }
        }).catch(reason => {console.log("dberror 22 - addThing - ", reason);});

        return promiseResult;
    });
   
    return promiseResult;
}

// this only needs thingid to remove but other parameters are logged
function delThing(userid, bid, thingtype, panel, tileid, thingid) {
    
    var promiseResult = mydb.deleteRow("things","userid="+userid+" AND id="+thingid)
    .then(result => {
        var msg;
        if ( result ) {
            msg = "removed tile #" + tileid + " deviceid: " + bid + " of type: " + thingtype + " from page: " + panel;
        } else {
            msg = "error - could not remove tile #" + tileid + " deviceid: " + bid + " of type: " + thingtype + " from page: " + panel;
        }
        console.log( (ddbg()), msg);
        return msg;
    }).catch(reason => {console.log("dberror 23 - delThing - ", reason);});
    return promiseResult;
}

function delPage(userid, roomid, panel) {

    var promiseResult = mydb.deleteRow("rooms","userid="+userid+" AND id="+roomid)
    .then(result => {
        var msg;
        if ( result ) {
            msg = "removed room #" + roomid + " of name: " + panel;
        } else {
            msg = "error - could not remove room #" + roomid + " of name: " + panel;
        }
        console.log( (ddbg()), msg);
        return msg;
    }).catch(reason => {console.log("dberror 24 - delPage - ", reason);});
    return promiseResult;
}

function addPage(userid, panelid ) {

    var clock = {
        userid: userid,
        roomid: 0,
        tileid: 0,
        posy: 0, posx: 0, zindex: 1, torder: 1,
        customname: ""
    };
    var donestat = {room: false, clock: false};

    var promiseResult = mydb.getRows("rooms","*", "userid="+userid+" AND panelid="+panelid)
    .then(results => {
        if ( results ) {
            var bigorder = 0;

            // go through the existing rooms and get the largest order and check for dup names
            results.forEach(function(room) {
                bigorder = room.rorder > bigorder ? room.rorder : bigorder;
            });
            bigorder++;
            
            return bigorder;
        } else {
            return 1;
        }
    })
    .then(rorder => {

        var roomname = "Room" + rorder.toString();
        var newroom = {
            userid: userid,
            panelid: panelid,
            rname: roomname,
            rorder: rorder
        }
        // console.log("rorder = ", rorder, " newroom: ", newroom);
        var result = mydb.addRow("rooms", newroom)
        .then(results => {
            var roomid = 0;
            if ( results ) {
                roomid = results.getAutoIncrementValue();
            }
            clock.roomid = roomid;
            // console.log("roomid = ", roomid);
            checkDone("room");
            return roomid;
        });
        return result;
    })
    .then(roomid => {

        // put a digital clock in all new rooms so they are not empty
        mydb.getRow("devices", "*", "userid = "+userid+" AND deviceid = 'clockdigital'")
        .then( clockdevice => {
            var tileid = 0;
            if ( clockdevice ) {
                tileid = clockdevice.id;
            }
            clock.tileid = tileid;
            // console.log("clockid = ", tileid);
            checkDone("clock");
        });

        if ( roomid === 0 ) {
            var msg = "No room added";
        } else {
            msg = "Room added with id: " + roomid;
        }
        return msg;
    }).catch(reason => {console.log("dberror 25 - addPage - ", reason);});

    function checkDone(item) {
        donestat[item] = true;
        if ( donestat.room && donestat.clock && clock.roomid > 0 && typeof clock.tileid === "number" ) {
            mydb.addRow("things", clock)
            .then( res3 => {
                console.log("A digital clock was added to the new room");
            });
        }
    }

    return promiseResult;
}

function getInfoPage(user, configoptions, hubs, req) {

    var pathname = req.path;
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var usertype = parseInt(user["users_usertype"]);
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
    var visual = mydb.getRows("devices","*", "devices.userid = " + userid, joinstr, "hubs.id, devices.name")
    .then(result => {
        // var configoptions = result.configs;
        // var hubs = result.hubs;
        var devices = result;
        return getinfocontents(userid, configoptions, hubs, devices);
    }).catch(reason => {console.log("dberror 26 - getInfoPage - ", reason);});

    return visual;

    function getinfocontents(userid, configoptions, hubs, sensors) {
        
        var $tc = "";
        $tc += utils.getHeader(userid, null, skin, true);
        $tc += "<h3>" + utils.APPNAME + " Information Display</h3>";

        if ( DONATE===true && usertype < 2 ) {
            $tc += '<br /><h4>Donations appreciated for HousePanel support and continued improvement, but not required to proceed.</h4> \
                <br /><div><form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
                <input type="hidden" name="cmd" value="_s-xclick"> \
                <input type="hidden" name="hosted_button_id" value="XS7MHW7XPYJA4"> \
                <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
                <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
                </form></div>';
        }

        var numhubs = 0;
        hubs.forEach (function(hub) {
            if ( hub && hub.hubid !== "-1" ) {
                numhubs++;
            }
        });

        $tc += "<form>";
        $tc += utils.hidden("returnURL", GLB.returnURL);
        $tc += utils.hidden("pathname", pathname);
        $tc += utils.hidden("pagename", "info");
        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        $tc += utils.hidden("configsid", JSON.stringify(configs), "configsid");
        $tc += "</form>";
        $tc += "<div class=\"infopage\">";
        $tc += "<div class='bold'>Site url = " + GLB.returnURL + "</div>";
        $tc += "<div class='bold'>Current user = " + uname + "</div>";
        $tc += "<div class='bold'>Displaying panel = " + pname + "</div>";
        $tc += "<div class='bold'>User email = " + useremail + "</div>";
        $tc += "<div class='bold'>Skin folder = " + skin + "</div>";
        $tc += "<div class='bold'>" + numhubs + " Hubs defined</div>";
        $tc += "<hr />";
        
        var num = 0;
        hubs.forEach (function(hub) {
            // putStats(hub);
            if ( hub.hubid !== "-1" ) {
                num++;
                $tc += "<div class='bold'>Hub ID #" + hub.id + "</div>";
                for ( var hubattr in hub ) {
                    if ( (hubattr!=="clientsecret" && hub.hubtype!=="NewSmartThings") || 
                         (hub.hubtype==="NewSmartThings" && hubattr!=="clientid" && hubattr!=="clientsecret" && hubattr!=="hubaccess" && hubattr!=="hubendpt" && hubattr!=="hubrefresh" && hubattr!=="useraccess" && hubattr!=="userendpt") 
                    ) {
                        $tc += "<div class='wrap'>" + hubattr + " = " + hub[hubattr] + "</div>";
                    }
                }
                $tc += "<hr />";
            }
        });

        $tc += "</div>";

        if ( clients[userid] && clients[userid].length > 0 ) {
            var str = "<p>Currently connected to " + clients[userid].length + " clients.</p>";
            str = str + "<br><hr><br>";
            for (var i=0; i < clients[userid].length; i++) {
                str = str + "Client #" + i + " host= " + clients[userid][i].socket.remoteAddress + " <br>";
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

        // don't need to sort here because we did so in the call to the main page
        // var sensors = sortedSensors("hubnum", "name", "type");
        for (var i in sensors) {
            var thing = sensors[i];
            var pvalue = JSON.parse(decodeURI2(thing["devices_pvalue"]));
            var value = "";
            if ( is_object(pvalue) ) {
                for (var key in pvalue ) {
                    var val = pvalue[key];
                    value += " ";
                    if ( key==="name" ) {
                        continue;  // value = value;
                    } else if ( typeof val==="object" ) {
                        value += key + "=" + JSON.stringify(val);
                    } else if ( typeof val==="string" ) {
                        value += key + "=" + val;
                    } else if ( typeof val!=="undefined" ) {
                        value += key + "=" + val.toString();
                    } else {
                        value += key + "=undefined";
                    }
                }
            } else {
                value = pvalue;
            }
            var hubid = thing["hubs_hubid"];
            if ( hubid === -1 || hubid === "-1" ) {
                var hubstr = "None<br><span class=\"typeopt\"> (" + hubid + ": None)</span>";
            } else {
                var hubType = thing["hubs_hubtype"] || "None";
                var hubName = thing["hubs_hubname"] || "None";
                hubstr = hubName + "<br><span class=\"typeopt\"> (" + hubid + ": " + hubType + ")</span>";
            }
            
            $tc += "<tr><td class=\"thingname\">" + thing["devices_name"] +
                "</td><td class=\"thingname\">" + pvalue.name +
                "</td><td class=\"thingarr\">" + value +
                "</td><td class=\"infoid\">" + thing["devices_deviceid"] +
                "</td><td class=\"infotype\">" + thing["devices_devicetype"] +
                "</td><td class=\"hubid\">" + hubstr + 
                "</td><td class=\"infonum\">" + thing["devices_id"] + "</td></tr>";
        }
        $tc += "</table></div>";

        // show all the customizations
        var customList = [];
        for ( var i in configoptions ) {

            var theoption = configoptions[i];
            var key = theoption.configkey;
            if ( key.startsWith("user_") ) {

                var ruleid = key.substr(5);
                var val = theoption.configval;
                if ( typeof val === "object" ) {
                    var lines = val;
                } else {
                    try {
                        lines = JSON.parse(decodeURI2(val));
                    } catch(e) {
                        lines = null;
                    }
                }

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
                "</th><th class=\"thingname\">Custom ID" + 
                "</th><th class=\"thingarr\">Custom Value" +
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
}

function hubFilters(userid, hubpick, hubs, useroptions, pagename, ncols) {
    // var options = GLB.options;
    // var useroptions = options["useroptions"];
    // var configoptions = options["config"];
    // var $hubs = configoptions["hubs"];

    var thingtypes = getTypes();
    var $tc = "";
    $tc+= "<form id=\"filteroptions\" class=\"options\" name=\"filteroptions\" action=\"#\">";
    $tc+= utils.hidden("userid", userid);
    $tc += utils.hidden("pagename", pagename);
    $tc += utils.hidden("returnURL", GLB.returnURL);

    // // if more than one hub then let user pick which one to show
    if ( !hubpick ) {
        hubpick = "all";
    }

    if (hubs && hubs.length ) {
        $tc+= "<div class=\"filteroption\">Hub Filters: ";
        var hid = "hopt_all";
        var checked = (hubpick==="all") ? " checked='1'" : "";
        $tc+= "<div class='radiobutton'><input id='" + hid + "' type='radio' name='huboptpick' value='all'"  + checked + "><label for='" + hid + "'>All Hubs</label></div>";
        // hid = "hopt_none";
        // checked = (hubpick==="-1") ? " checked='1'" : "";
        // $tc+= "<div class='radiobutton'><input id='" + hid + "' type='radio' name='huboptpick' value='-1'" + checked + "><label for='" + hid + "'>No Hub</label></div>";
        var $hubcount = 0;
        hubs.forEach(function(hub) {
            var hubName = hub.hubname;
            var hubType = hub.hubtype;
            var hubId = hub.hubid;
            var hubindex = hub.id;
            hid = "hopt_" + hubindex;
            checked = (hubpick===hubId) ? " checked='1'" : "";
            $tc+= "<div class='radiobutton'><input id='" + hid + "' hubindex='" + hubindex + "' type='radio' name='huboptpick' value='" + hubId + "'" + checked + "><label for='" + hid + "'>" + hubName + " (" + hubType + ")</label></div>";
            $hubcount++;
        });
        $tc+= "</div>";
    }

    // // buttons for all or no filters
    $tc+= "<div id=\"thingfilters\" class='filteroption'>Select Things to Display:</div>";
    $tc+= "<div id=\"filterup\" class=\"filteroption\">";
    $tc+= "<div id=\"allid\" class=\"smallbutton\">All</div>";
    $tc+= "<div id=\"noneid\" class=\"smallbutton\">None</div>";

    $tc+= "<table class=\"useroptions\"><tr>";
    var $i= 0;
    var numtypes = utils.count(thingtypes);
    for (var $iopt in thingtypes) {
        var $opt = thingtypes[$iopt];
        $i++;
        if ( in_array($opt, useroptions ) ) {
            $tc+= "<td><input id=\"cbx_" + $i + "\" type=\"checkbox\" name=\"useroptions[]\" value=\"" + $opt + "\" checked=\"1\">";
        } else {
            $tc+= "<td><input id=\"cbx_" + $i + "\" type=\"checkbox\" name=\"useroptions[]\" value=\"" + $opt + "\">";
        }
        $tc+= "<label for=\"cbx_" + $i + "\" class=\"optname\">" + $opt + "</label></td>";
        if ( $i % ncols === 0 && $i < numtypes ) {
            $tc+= "</tr><tr>";
        }
    }
    $tc+= "</tr></table>";
    $tc+= "</div>";
    $tc+= "</form>";

    return $tc;
}

// this little gem will sort by up to three things
function sortedSensors(sensors, one, two, three) {

    // this sorts an array of objects based on keys one, two, three
    // this requires the passed sensors variable to be an array of objects
    // put sensors in an array so we can sort them
    var sensors = sensors.sort( function(obja, objb) {
        function test(a, b) {
            if ( !a || !b || typeof a === "object" || typeof b === "object" ) { return 0; }
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

function getCatalog(userid, hubpick, hubs, useroptions, sensors) {

    if ( !hubpick ) {
        hubpick = "all";
    }
    var $tc = "";

    $tc += "<div id=\"catalog\">";
    $tc += hubFilters(userid, hubpick, hubs, useroptions, "main", 3);

    $tc += "<div class='scrollvtable fshort'><table class=\"catalog\">";

    // put sensors in an array so we can sort them
    // we dont' need to do this here since we sorted by hubid and name earlier
    sensors = Object.values(sensors);
    sensors = sortedSensors(sensors, "hubs_hubid", "devices_name");

    for ( var i in sensors ) {

        var thing = sensors[i];
        var bid = thing["devices_deviceid"];
        var thingtype = thing["devices_devicetype"];
        var thingname = thing["devices_name"];
        var hubId = thing["hubs_hubid"];
        var hubindex = thing["hubs_id"];
        var cat = "cat-" + i.toString();

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

        $tc += "<div id=\"" + cat + "\" bid=\"" + bid + "\" type=\"" + thingtype + "\" hubid=\"" + hubId + "\" hubindex=\"" + hubindex + "\" ";
        $tc += "panel=\"catalog\" class=\"thing " + hide + "catalog-thing\">"; 
        $tc += "<div class=\"thingname\">" +  thingpr + "</div>";
        $tc += "<div class=\"thingtype\">" + thingtype + "</div>";
        $tc +="</div>";
    }
    $tc += "</table></div>";
    $tc += "</div>";

    return $tc;
}

function getSocketUrl(hostname) {
    var webSocketUrl = "";
    if ( GLB.returnURL.startsWith("https://") ) {
        var ws = "wss://";
    } else {
        ws = "ws://";
    }
    
    if ( GLB.webSocketServerPort && !isNaN(parseInt(GLB.webSocketServerPort)) ) {
        var icolon = hostname.indexOf(":");
        if ( icolon >= 0 ) {
            webSocketUrl = ws + hostname.substr(0, icolon);
        } else {
            webSocketUrl = ws + hostname;
        }
        webSocketUrl = webSocketUrl + ":" + GLB.webSocketServerPort;
    }
    return webSocketUrl;
}

function getOptionsPage(user, configoptions, hubs, req) {

    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var pname = user["panels_pname"];
    var usertype = parseInt(user["users_usertype"]);
    var panelid = user["panels_id"];
    var skin = user["panels_skin"];

    var hostname = req.headers.host;
    var pathname = req.path;
    var maindone = {devices: false, rooms: false, things: false};

    function checkDone(element) {
        if ( element ) {
            maindone[element] = true;
            console.log(">>>> finished with element: ", element);
        }
        
        var alldone = true;
        for (var el in maindone) {
            alldone = alldone && maindone[el];
        }

        if ( alldone ) {
            console.log(">>>> finished with all elements and rendering page");
            var tc = ""; // renderMain(configoptions, hubs, rooms, alldevices, things);
            res.send(tc);
            res.end();
        }
        
        return alldone;
    }

    // get all the things in the various rooms as we do on the main page
    var pr = mydb.getRows("rooms","*", "userid = "+userid+" AND panelid = "+panelid)
    .then(rooms => {
        return rooms;
    })
    .then(rooms => {
        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        var pr = mydb.getRows("devices","*","devices.userid = "+userid, joinstr,"hubs.id")
        .then(devices => {
            // console.log(">>>> options devices: ", devices);
            return [rooms, devices];
        });
        return pr;
    })
    .then(resarray => {
        var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
        var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
        var pr = mydb.getRows("things","*", 
            "things.userid = "+userid+" AND rooms.panelid = " + panelid, [joinstr1, joinstr2], "devices.name")
        .then(things => {
            // console.log(">>>> options things: ", things);
            resarray.push(things);
            return resarray;
        })
        return pr;
    })
    // var newtc = mydb.getRows("things","things.*,devices.*", conditions, [joinstr1, joinstr2, joinstr3],"rooms.rorder")
    .then(resarray => {
        var rooms = resarray[0];
        var devices = resarray[1];
        var things = resarray[2];
        // console.log(">>>> options rooms: ", rooms);
        // return JSON.stringify(things);
        if ( rooms && devices && things ) {
            return renderOptionsPage(rooms, devices, things);
        } else {
            return "error - problem with reading your existing tiles";
        }
    }).catch(reason => {console.log("dberror 27 - getOptionsPage - ", reason);});

    return pr;

    function renderOptionsPage(rooms, devices, sensors) {

        var $fast_timer = getConfigItem(configoptions, "fast_timer") || "0";
        var $slow_timer = getConfigItem(configoptions, "slow_timer") || "0";
        var $kioskoptions = getConfigItem(configoptions, "kiosk") || "false";
        var $blackout = getConfigItem(configoptions, "blackout") || "false";
        var $ruleoptions = getConfigItem(configoptions, "rules") || "true";
        var timezone = getConfigItem(configoptions, "timezone") || "America/Detroit";
        var phototimer = parseInt(getConfigItem(configoptions, "phototimer"));
        if ( isNaN(phototimer) ) { phototimer = 0; }
        var fcastcity = getConfigItem(configoptions, "fcastcity") || "ann-arbor";
        var fcastregion = getConfigItem(configoptions, "fcastregion") || "Ann Arbor";
        var fcastcode = getConfigItem(configoptions, "fcastcode") || "42d28n83d74";   //  ann-arbor code is 42d28n83d74
        var $accucity = getConfigItem(configoptions, "accucity") || "ann-arbor-mi";
        var $accuregion = getConfigItem(configoptions, "accuregion") | "us";
        var $accucode = getConfigItem(configoptions, "accucode") || "329380";      // ann-arbor-mi code is 329380
        var hubpick = getConfigItem(configoptions, "hubpick") || "all";
    
        var $tc = "";
        $tc += utils.getHeader(userid, null, skin, true);
        $tc += "<h3>" + utils.APPNAME + " Options</h3>";
        $tc += "<h3>for user: " + useremail + " | " + uname + "</h3>";
        $tc += "<h3>on panel: " + pname + "</h3>";
        $tc += "<button class=\"infobutton fixbottom\">Cancel and Return to HousePanel</button>";
        // $tc += "<br><div class=\"formbutton formauto\"><a href=\"" + GLB.returnURL + "\">Cancel and Return to HousePanel</a></div>";
        
        $tc += utils.hidden("pagename", "options");
        $tc += utils.hidden("returnURL", GLB.returnURL);
        $tc += utils.hidden("pathname", pathname);
        $tc += utils.hidden("webSocketUrl", webSocketUrl);

        var webSocketUrl = getSocketUrl(hostname);
        var useroptions = getConfigItem(configoptions, "useroptions");
        var specialtiles = getConfigItem(configoptions, "specialtiles");
        $tc += hubFilters(userid, hubpick, hubs, useroptions, "options", 7);

        $tc += "<form id=\"optionspage\" class=\"options\" name=\"options\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";
        $tc += utils.hidden("userid", userid);
        $tc += utils.hidden("panelid", panelid);

        $tc += "<div class=\"filteroption\">";
        $tc += "Specify number of special tiles: <br/>";
        for (var $stype in specialtiles) {
            var $customcnt = parseInt(specialtiles[$stype]);
            if ( isNaN($customcnt) ) { $customcnt = 0; }
            var $stypeid = "cnt_" + $stype;
            $tc+= "<div><label for=\"$stypeid\" class=\"startupinp\"> " + $stype +  " tiles: </label>";
            $tc+= "<input class=\"optionnuminp\" id=\"" + $stypeid + "\" name=\"" + $stypeid + "\" width=\"10\" type=\"number\"  min='0' max='99' step='1' value=\"" + $customcnt + "\" /></div>";
        }
        $tc+= "</div>";

        $tc += "<div class=\"filteroption\">";
        $tc += "Other Options: <br/><hr><br/>";
        
        $tc += "<div><label for=\"kioskid\" class=\"startupinp\">Kiosk Mode: </label>";    
        var $kstr = ($kioskoptions===true || $kioskoptions==="true" || $kioskoptions==="1" || $kioskoptions==="yes") ? "checked" : "";
        $tc+= "<input id=\"kioskid\" width=\"24\" type=\"checkbox\" name=\"kiosk\"  value=\"" + $kioskoptions + "\" " + $kstr + "/></div>";

        if ( usertype > 0 ) {
            $tc += "<div><label for=\"ruleid\" class=\"startupinp\">Enable Rules? </label>";
            var $rstr = ($ruleoptions===true || $ruleoptions==="true" || $ruleoptions==="1" || $ruleoptions==="yes") ? "checked" : "";
            $tc += "<input id=\"ruleid\" width=\"24\" type=\"checkbox\" name=\"rules\"  value=\"" + $ruleoptions + "\" " + $rstr + "/></div>";
        }
        
        $tc += "<div><label for=\"clrblackid\" class=\"startupinp\">Blackout on Night Mode: </label>";    
        $kstr = ($blackout===true || $blackout==="true") ? "checked" : "";
        $tc+= "<input id=\"clrblackid\" width=\"24\" type=\"checkbox\" name=\"blackout\"  value=\"" + $blackout + "\" " + $kstr + "/></div>";

        $tc+= "<div><label for=\"photoid\" class=\"startupinp\">Photo timer (sec): </label>";
        $tc+= "<input class=\"optioninp\" id=\"photoid\" name=\"phototimer\" width=\"20\" type=\"number\"  min='0' max='300' step='1' value=\"" + phototimer + "\" /></div>";

        $tc += "<div><label class=\"startupinp\">Timezone Offset: </label>";
        $tc += "<input id=\"newtimezone\" class=\"optioninp\" name=\"timezone\" width=\"20\" type=\"text\" value=\"" + timezone + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp\">Fast Timer: </label>";
        $tc += "<input id=\"newfast_timer\" class=\"optioninp\" name=\"fast_timer\" width=\"20\" type=\"text\" value=\"" + $fast_timer + "\"/></div>"; 

        $tc += "<div><label class=\"startupinp\">Slow Timer: </label>";
        $tc += "<input id=\"newslow_timer\" class=\"optioninp\" name=\"slow_timer\" width=\"20\" type=\"text\" value=\"" + $slow_timer + "\"/></div>"; 

        $tc += "</div>";

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
        $tc += "</tr>";

        $tc += "<tr>";
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
        for (var i in rooms) {
            var roomname = rooms[i].rname;
            $tc+= "<th class=\"roomname\">" + roomname;
            $tc+= "</th>";
        }
        $tc += "</tr></thead>";
        $tc += "</table>";
        $tc += "<div class='scrollvtable'>";
        $tc += "<table class=\"roomoptions\">";
        $tc += "<tbody>";

        devices = devices.sort(function(deva,devb) {
            if ( !deva || !devb || typeof deva !== "object" || typeof devb !== "object" ) { return 0; }
            else if ( deva["devices_name"] === devb["devices_name"] ) { return 0 }
            else if ( deva["devices_name"] > devb["devices_name"] ) { return 1; }
            else { return -1; }
        });

        var $evenodd = true;
        for ( var i in devices) {
            var device = devices[i];
            var thingname = device["devices_name"];
            var thetype = device["devices_devicetype"];
            var hubType = device["hubs_hubtype"];
            var hubStr = device["hubs_hubname"];
            var hubid = device["hubs_hubid"];
            var hubindex = device["hubs_id"];
            var thingindex = device["devices_id"];
            var $special = "";

            // write the table row
            // if ( array_key_exists(thetype, specialtiles) ) {
            //     var $special = " special";
            // } else {
            //     $special = "";
            // }
            var $odd = $evenodd = false;
            // if ( thetype ) {
            if (in_array(thetype, useroptions)) {
                $evenodd = !$evenodd;
                $evenodd ? $odd = " odd" : $odd = "";
                $tc+= "<tr type=\"" + thetype + "\" tile=\"" + thingindex + "\" class=\"showrow" + $odd + $special + "\">";
            } else {
                $tc+= "<tr type=\"" + thetype + "\" tile=\"" + thingindex + "\" class=\"hiderow" + $special + "\">";
            }
            
            $tc+= "<td class=\"thingname\">";
            $tc+= thingname + " (" + thetype + ")";
            $tc+= "</td>";
            
            $tc+= "<td class=\"hubname\" hubindex=\"" + hubindex + "\" hubid=\"" + hubid + "\">";
            $tc+= hubStr + " (" + hubType + ")";
            $tc+= "</td>";

            // loop through all the rooms
            // this addresses room bug
            // for ( var roomname in roomoptions ) {
            for (var i in rooms) {
                var roomname = rooms[i].rname;
                var roomid = rooms[i].id;
                            
                // now check for whether this thing is in this room
                $tc+= "<td>";
                
                var ischecked = false;
                for (var i in sensors) {
                    var thing = sensors[i];
                    if ( thing["things_tileid"] === thingindex &&  thing["things_roomid"] === roomid ) {
                        ischecked = true;
                    }
                }
                
                if ( ischecked ) {
                    $tc+= "<input type=\"checkbox\" name=\"" + roomname + "[]\" value=\"" + thingindex + "\" checked=\"1\" >";
                } else {
                    $tc+= "<input type=\"checkbox\" name=\"" + roomname + "[]\" value=\"" + thingindex + "\" >";
                }
                $tc+= "</td>";
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
        $tc += utils.getFooter();

        return $tc;
    }

}

// renders the main page
function getMainPage(user, configoptions, hubs, req, res) {

    var $tc = "";
    var hostname = req.headers.host;
    var pathname = req.path;
    var kioskmode = false;

    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var defhub = user["users_defhub"];
    var usertype = user["users_usertype"];
    var panelid = user["panels_id"];
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];

    var alldevices = {};
    var rooms;
    var things;
    var maindone = {specials: true, devices: false, rooms: false, things: false};

    function checkDone(element) {
        if ( element ) {
            maindone[element] = true;
            console.log(">>>> finished with element: ", element);
        }
        
        var alldone = true;
        for (var el in maindone) {
            alldone = alldone && maindone[el];
        }

        if ( alldone ) {
            console.log(">>>> finished with all elements and rendering page");
            var tc = renderMain(configoptions, hubs, rooms, alldevices, things);
            res.send(tc);
            res.end();
        }
        
        return alldone;
    }

    console.log(  "\n****************************************************************",
                  "\n", (ddbg()), "Serving pages from: ", GLB.returnURL,
                  "\n****************************************************************");

    // var temp = "<br>****************************************************************" +
    //            "<br>" + (ddbg()) + "Serving pages from: " + GLB.returnURL +
    //            "<br>****************************************************************";
    // res.send(temp);
    // res.end();
    // return true;

    // first get the room list and make the header
    var conditions = "userid = "+userid+" AND panelid = "+panelid;
    mydb.getRows("rooms","*",conditions,"","rooms.rorder")
    .then(rows => {
        rooms = rows;
        if ( DEBUG1 ) {
            console.log((ddbg()), "rooms: ", rooms);
        }
        return checkDone("rooms");
    })
    .then( () => {

        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        mydb.getRows("devices","*","devices.userid = " + userid, joinstr,"hubs.hubid, devices.name")
        .then(rows => {
            // convert array of devices to an array of objects that looks like our old all things array
            alldevices = {};
            rows.forEach(function(dev) {
                var devid = dev["devices_id"];
                alldevices[devid] = dev;
            });
            if ( DEBUG1 ) {
                console.log((ddbg()), "alldevices: ", alldevices);
            }

            // update clocks to start off correctly
            var hubzero = hubs[0].id;
            updSpecials(userid, configoptions, hubzero, alldevices, true);

            return checkDone("devices");
        });
        // return results;
    })
    .then( () => {

        // we link the tileid to the index of devices list - this will be unique and tied to a hub
        var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
        var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
        var joinstr3 = mydb.getJoinStr("devices","hubid","hubs","id");
        var conditions = "things.userid = "+userid+" AND rooms.panelid = "+panelid;
        mydb.getRows("things","*", conditions, [joinstr1, joinstr2, joinstr3], "rooms.rorder, things.torder, things.id")
        .then(rows => {
            things = rows;
            if ( DEBUG1 ) {
                console.log((ddbg()), "things: ", things);
            }
            return checkDone("things");
        });
    })
    .catch(reason => {
        console.log("error: ", reason);
    })
        
    function renderMain(configoptions, hubs, rooms, alldevices, things) {

        var tc = "";
        tc += utils.getHeader(userid, pname, skin, false);

        // if new user flag it and udpate to no longer be new
        if ( usertype === 0 ) {
            tc += "<div class=\"greeting\"><strong>Welcome New User!</strong><br/ >You should first try to link your smart home hubs, using the Hub Auth button below. ";
            tc += "You can also explore all that HousePanel has to offer by experimenting with the two clock tiles placed in each room. ";
            tc += "When you are done, they can be removed in Edit mode or from the Options page. Click on the ? mark in the upper right corner. ";
            tc += "to access the full online manual. Have fun!</div>";
            mydb.updateRow("users",{usertype: 1},"id="+userid);
        }
    
        if ( DEBUG1 ) {
            console.log( (ddbg()), "getMainPage: ", userid, uname, panelid, pname, usertype, skin, hostname, pathname);
        }
    
        tc += '<div id="dragregion">';
        tc += '<div id="tabs"><ul id="roomtabs">';

        for (var i in rooms) {
            var row = rooms[i];
            var k = row.rorder;
            var roomname = row.rname;
            if ( roomname ) {
                tc += "<li roomnum=\"" + k + "\" class=\"tab-" + roomname + "\"><a href=\"#" + roomname + "-tab\">" + roomname + "</a></li>";
            }
        }
        tc += '</ul>';
            
        var cnt = 0;
        for (var i in rooms) {
            var row = rooms[i];
            var roomname = row.rname;
            var rorder = row.rorder;
            var roomid = row.id;
            var thingsarray = [];
            things.forEach(function(thing) {
                if ( thing["rooms_rname"] === roomname) {
                    thingsarray.push(thing);
                }
            });
            // console.log("things for room: ", roomname, ": ", thingsarray);

            // show all room with whatever index number assuming unique
            // var pagecontent = "<div class='error' id=\"" + roomname + "-tab\">"
            //                   + "Test Page #" + i + " for Room: " + roomname + " order: " + rorder
            //                   + "</div>";
            var pagecontent = getNewPage(userid, pname, configoptions, cnt, roomid, roomname, rorder, thingsarray, alldevices);
            cnt += thingsarray.length;
            tc = tc + pagecontent;
        };
 
        // include doc button and panel name
        // TODO: add username to display
        tc += '<div id="showversion" class="showversion">';
        tc += '<span id="emailname">' + (uname || useremail) + '</span> | <span id="infoname">' + pname + '</span><span> | V' + utils.HPVERSION + '</span>';
        tc += '</div>';
        tc+= '<div id="showdocs"><a href="https://www.housepanel.net" target="_blank">?</a></div>';
        // tc += "</div>";

        // end of the tabs
        tc += "</div>";

        // set the websock servername as same as hosted page but different port
        var webSocketUrl = getSocketUrl(hostname);
        
        // include form with useful data for js operation
        tc += "<form id='kioskform'>";
        var erstr =  ENABLERULES ? "true" : "false"
        tc += utils.hidden("enablerules", erstr);

        // save the socket address for use on js side
        // save Node.js address for use on the js side
        tc += utils.hidden("pagename", "main");
        tc += utils.hidden("returnURL", GLB.returnURL);
        tc += utils.hidden("pathname", pathname);
        tc += utils.hidden("webSocketUrl", webSocketUrl);
        tc += utils.hidden("userid", userid, "userid");
        tc += utils.hidden("panelid", panelid, "panelid");
        tc += utils.hidden("skinid", skin, "skinid");
        tc += utils.hidden("emailid", useremail, "emailid");

        // write the configurations without the rules
        var configs = {};

        for (var i in configoptions) {
            // console.log("configoptions [", i, "] = ", configoptions[i] );
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        tc += utils.hidden("configsid", JSON.stringify(configs), "configsid");

        // show user buttons if we are not in kiosk mode
        if ( !kioskmode ) {
            tc += "<div id=\"controlpanel\">";
            tc +='<div id="showoptions" class="formbutton">Options</div>';
            tc +='<div id="refreshpage" class="formbutton">Refresh</div>';
            // tc +='<div id="refactor" class="formbutton confirm">Refactor</div>';
            tc +='<div id="userauth" class="formbutton confirm">Hub Auth</div>';
            tc +='<div id="showid" class="formbutton">Show Info</div>';
            tc +='<div id="toggletabs" class="formbutton">Hide Tabs</div>';
            tc +='<div id="blackout" class="formbutton">Blackout</div>';

            tc += "<div class=\"modeoptions\" id=\"modeoptions\"> \
            <input id=\"mode_Operate\" class=\"radioopts\" type=\"radio\" name=\"usemode\" value=\"operate\" checked><label for=\"mode_Operate\" class=\"radioopts\">Operate</label> \
            <input id=\"mode_Reorder\" class=\"radioopts\" type=\"radio\" name=\"usemode\" value=\"reorder\" ><label for=\"mode_Reorder\" class=\"radioopts\">Reorder</label> \
            <input id=\"mode_Edit\" class=\"radioopts\" type=\"radio\" name=\"usemode\" value=\"edit\" ><label for=\"mode_Edit\" class=\"radioopts\">Edit</label> \
            <input id=\"mode_Snap\" class=\"radioopts\" type=\"checkbox\" name=\"snapmode\" value=\"snap\"><label for=\"mode_Snap\" class=\"radioopts\">Grid Snap?</label> \
            </div><div id=\"opmode\"></div>";
            tc +="</div>";
        }
        tc += "</form>";

        // alldevices = sortedSensors(alldevices, "hubid", "name", "devicetype");
        var hubpick = getConfigItem(configoptions, "hubpick");
        var useroptions = getConfigItem(configoptions, "useroptions");
        var catalog = getCatalog(userid, hubpick, hubs, useroptions, alldevices);
        tc += catalog;
        
        // end drag region enclosing catalog and main things
        tc += "</div>";

        tc += utils.getFooter();
        return tc;
    }

}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function saveFilters(userid, body) {
    if ( DEBUG4 ) {
        console.log( (ddbg()), "filters save request for user: ", userid, " body: ", body);
    }
    var result;
    
    if ( typeof body.useroptions === "object" ) {
        var updval = {userid: userid, configkey: 'useroptions', configval: JSON.stringify(body.useroptions)};
        result = mydb.updateRow("configs", updval, "userid = " + userid + " AND configkey = 'useroptions'")
        .then(result => {
            if ( result ) {
                return body.useroptions; //  "success - updated filters";
            } else {
                return "error - could not update filters";
            }
        });
    } else {
        result = "error - something went wrong with updating useroptions filters";
    }

    if ( typeof body.huboptpick === "string" ) {
        var updhub = {userid: userid, configkey: 'hubpick', configval: body.huboptpick};
        mydb.updateRow("configs", updhub, "userid = " + userid + " AND configkey = 'hubpick'");
    }

    return result;
}

// process user options page
// TODO - update to process into DB
function processOptions(userid, panelid, optarray) {

    // first get the configurations and things and then call routine to update them
    userid = parseInt(userid);
    panelid = parseInt(panelid);

    return mydb.getRows("rooms","*","userid="+userid+" AND panelid="+panelid)
    .then(rooms => {
        // console.log(rooms);
        if ( !rooms ) { rooms = []; }
        return rooms;
    })
    .then(rooms => {
        return mydb.getRows("configs","*","userid="+userid+" AND configkey NOT LIKE 'user_%'")
        .then(configs => {
            // console.log(configs);
            var configoptions = {};
            if ( configs ) {
                configs.forEach(function(item) {
                    var key = item.configkey;
                    var val = item.configval;
                    try {
                        var parseval = JSON.parse(val);
                    } catch (e) {
                        parseval = val;
                    }
                    configoptions[key] = parseval;
                });
            }
            return configoptions;
        })
        .then(configoptions => {
            var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
            var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
            return mydb.getRows("things","*","things.userid="+userid+" AND rooms.panelid="+panelid, [joinstr1, joinstr2])
            .then(things => {
                // console.log(things, configoptions);
                if ( things ) {
                    return doProcessOptions(configoptions, things, rooms);
                } else {
                    return null;
                }
            })
        });
    });

    function doProcessOptions(configoptions, things, rooms) {
        if (DEBUG4) {
            console.log( (ddbg()), "Process Options - Before Processing");
            console.log( (ddbg()), UTIL.inspect(configoptions, false, null, false));
            console.log( (ddbg()), UTIL.inspect(things, false, null, false));
            console.log( (ddbg()), UTIL.inspect(roomnames, false, null, false));
        }
        
        var roomnames = {};
        rooms.forEach(function(item) {
            var id = item.id;
            var rname = item.rname;
            roomnames[rname] = id;
        });
        var specialtiles = configoptions["specialtiles"];

        // // use clock instead of blank for default only tile
        // var onlytile = {userid: userid, tileid: onlytileid, posy: 0, posz: 0, zindex: 1, torder: 1, customname: "Digital Clock"};
        // var onlyarr = [onlytile,0,0,1,""];

        // // checkbox items simply will not be there if not selected
        configoptions["kiosk"] = "false";
        configoptions["rules"] = "false";
        configoptions["blackout"] = "false";

        // force all three to be given for change to happen
        // var city = "";
        // var region = "";
        // var code = "";
        // var fcastcity = "";
        // var fcastregion = "";
        // var fcastcode = "";

        // // get all the rooms checkboxes and reconstruct list of active things
        // // note that the list of checkboxes can come in any random order
        for (var key in optarray) {
            var val = optarray[key];

            //skip the returns from the submit button and the flag
            if (key==="options" || key==="api" || key==="useajax" ) {
                continue;
            } else if ( key==="kiosk") {
                configoptions["kiosk"] = "true";
            } else if ( key==="rules") {
                configoptions["rules"] = "true";
            } else if ( key==="blackout") {
                configoptions["blackout"] = "true";
            } else if ( key==="phototimer" ) {
                configoptions["phototimer"] = val.trim();
            } else if ( key==="timezone") {
                configoptions["timezone"] = val.trim();
            } else if ( key==="fast_timer") {
                configoptions["fast_timer"] = val.trim();
            } else if ( key==="slow_timer") {
                configoptions["slow_timer"] = val.trim();
            } else if ( key==="fcastcity" ) {
                configoptions["fcastcity"] = val.trim();
            } else if ( key==="fcastregion" ) {
                configoptions["fcastregion"] = val.trim();
            } else if ( key==="fcastcode" ) {
                configoptions["fcastcode"] = val.trim();
            } else if ( key==="accucity" ) {
                configoptions["accucity"] = val.trim();
            } else if ( key==="accuregion" ) {
                configoptions["accuregion"] = val.trim();
            } else if ( key==="accucode" ) {
                configoptions["accucode"] = val.trim();
            
            // handle user selected special tile count
            } else if ( key.substr(0,4)==="cnt_" ) {
                var stype = key.substr(4);
                if ( array_key_exists(stype, specialtiles) ) {
                    var oldcount = specialtiles[stype];
                    var customcnt = parseInt(val);
                    if ( isNaN(customcnt) ) { customcnt = oldcount; }
                    specialtiles[stype] = customcnt;
                    configoptions["specialtiles"] = specialtiles;
                }
            
            // made this more robust by checking room name being valid
            } else if ( array_key_exists(key, roomnames) && is_array(val) ) {
                
                // first delete any tile that isn't checked
                var roomid = parseInt(roomnames[key]);
                // if ( DEBUG4 ) {
                //     console.log("processing key: ", key, " val: ", val);
                // }

                var maxtorder = 0;
                things.forEach(function(item) {
                    var tnum = item["things_tileid"];
                    if ( item["things_roomid"]===roomid ) {
                        var torder = parseInt(item["things_torder"]);
                        if ( !isNaN(torder) && torder > maxtorder ) { maxtorder = torder; } 
                        if ( ! in_array(tnum, val) ) {
                            mydb.deleteRow("things","id = "+ item["things_id"]);
                            // console.log(">>>> simulated delete item: ", item["things_id"]," room= ", key);
                        }
                    }
                });
                maxtorder++;
        
                // add any new ones that were not there before
                val.forEach(function(tilestr) {
                    var tilenum = parseInt(tilestr);
                    var exist = false;
                    things.forEach(function(item) {
                        exist = exist || (item["things_roomid"]===roomid && item["things_tileid"]===tilenum);
                    });
                    if ( !exist ) {
                        var updrow = {userid: userid, roomid: roomid, tileid: tilenum, posy: 0, posx: 0, zindex: 1, torder: maxtorder, customname: ""};
                        mydb.addRow("things",updrow);
                        // console.log(">>>> simulated add item: ", updrow, " maxtorder: ", maxtorder);
                    }
                });

            }
        }
        
        // everything from this point on is after processing the options table
        // start by handling the weather
        // if ( city && region && code ) {
        //     writeAccuWeather(city, region, code);
        // }
        
        // // guess the region based on the city if left blank
        // if ( !fcastregion && fcastcity ) {
        //     var words = fcastcity.replace("-"," ").split(" ");
        //     fcastregion = "";
        //     for ( var i in words ) {
        //         fcastregion += words[i].substr(0,1).toUpperCase() + words[i].substr(1).toLowerCase() + " ";
        //     }
        //     fcastregion = fcastregion.trim();
        //     configoptions["fcastregion"] = fcastregion;
        // }
        // if ( fcastcity && fcastregion && fcastcode ) {
        //     writeForecastWidget(fcastcity, fcastregion, fcastcode);
        // }
        var d = new Date();
        var timesig = utils.HPVERSION + " @ " + d.getTime();
        configoptions["time"] = timesig;
        
        // save the configuration parameters in the main options array
        for ( var key in configoptions ) {  
            if ( typeof configoptions[key] === "object" ) {
                var configstr = JSON.stringify(configoptions[key]);
            } else {
                configstr = configoptions[key];
            }
            var config = {userid: userid, configkey: key, configval: configstr};
            mydb.updateRow("configs", config,"userid = "+userid+" AND configkey = '"+key+"'");
            // console.log(">>>> simulated config update: ", config);
        }
        // options["config"] = configoptions;
        
        if (DEBUG4) {
            console.log( (ddbg()), "Process Options - After Processing");
            console.log( (ddbg()), UTIL.inspect(configoptions, false, null, false));
        }
        return "success";
    }
}

function updateNames(userid, thingid, type, tileid, newname) {
    var result;

    // the thingid parameter is the roomid for room name udpates
    if ( type === "page" ) {
        newname = newname.replace(/ /g, "_");
        var updval = {rname: newname};
        result = mydb.updateRow("rooms", updval, "userid = "+userid+" AND id = "+thingid)
        .then(result => {
            if ( result ) {
                var ans = "success - room name changed for thing id: " + thingid  + " to name= " + newname;
            } else {
                ans = "warning - room name not updated for thing id: " + thingid + " to name= " + newname;
            }
            return ans;
        })

    // the thingid parameter is the tileid for tile name updates
    } else {
        var updval = {customname: newname};
        result = mydb.updateRow("things", updval, "userid = "+userid+" AND id = "+thingid)
        .then(result => {
            if ( result ) {
                var ans = "success name changed for thing id: " + thingid  + " to name= " + newname;
            } else {
                ans = "warning - nothing updated for thing id: " + thingid + " to name= " + newname;
            }
            return ans;
        });
    }
    return result;
}

// logic redone to allow icons from both skins to be selected
// which skin is active does not matter here
function getIcons(userid, pname, skin, icondir, category) {

    var userdir = "user" + userid.toString();
    if ( !icondir ) {
        icondir = "icons";
    }
    if ( !category ) {
        category = "Main_Icons";
    }

    // change over to where our icons are located
    var activedir;
    if ( category.startsWith("Main_") ) {
        // activedir = path.join(__dirname, "skin-housepanel", icondir);
        activedir = path.join("skin-housepanel", icondir);
    } else if ( category.startsWith("Modern_") ) {
        activedir = path.join("skin-modern", icondir);
    } else if ( category.startsWith("User_") ) {
        activedir = path.join(userdir, pname, icondir);
    } else {
        activedir = path.join("media", icondir);
    }
    // console.log(">>>> activedir: ", activedir);

    try {
        var dirlist = fs.readdirSync(activedir);
    } catch(e) {
        dirlist = false;
    }

    var $tc = "";
    if ( dirlist ) {
        var allowed = ["png","jpg","jpeg","gif","JPG","GIF","PNG","JPEG"];
        dirlist.forEach( function(filename) {
            var froot = path.basename(filename);
            var ext = path.extname(filename).slice(1);
            var filedir = path.join(activedir, froot);
            if ( category.startsWith("User_") ) {
                var showicon = path.join(icondir, froot);
            } else {
                showicon = filedir;
            }
            if ( in_array(ext, allowed) ) {
                $tc += '<div class="iconcat">';
                $tc += '<img src="' + filedir +'" show="' + showicon + '" class="icon" title="' + froot + '" />';
                $tc += '</div>';
            }
        });
    } else {
        $tc = false;
    }
    return $tc;
}

// get photos or return false if folder isn't there
function getPhotos(attr) {
    
    try {
        var photos = {};
        var activedir = path.join(__dirname, attr);
        var photolist = fs.readdirSync(activedir);
    } catch (e) {
        photos = false;
        photolist = false;
    }

    if ( photolist ) {
        var allowed = ["png","jpg","jpeg","gif","JPG","GIF","PNG","JPEG"];
        photolist.forEach( function(filename, index) {
            var froot = path.basename(filename);
            var ext = path.extname(filename).slice(1);
            if ( in_array(ext, allowed) ) {
                photos[index] = froot;
            }
        })
    }
    return photos;
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

// TODO - test and debug
function updCustom(userid, swid, rules) {
    // var reserved = ["index","rooms","things","config","control","time","useroptions"];
    var configkey = "user_" + swid;

    // console.log("rules: ", rules);
    if ( rules && is_object(rules) ) {
        // handle encryption
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if ( is_array(rule) && rule.length>2 ) {
                var customval = rule[1].toString();
                var subid = rule[2];
                if ( rule[0]==="TEXT" && subid==="password" && customval.length < 60 ) {
                    rules[i][1] = pw_hash(customval);
                }
            } else {
                var k = (i+1).toString();
                rules[i] = ["TEXT","","user"+k];
            }
        }

        var rulejson = JSON.stringify(rules);
        var rulerow = {userid: userid, configkey: configkey, configval: rulejson};
        // console.log("rulerow: ", rulerow);
        return mydb.updateRow("configs", rulerow, "userid = "+userid+" AND configkey = '"+configkey+"'")
        .then(result => {
            if ( result ) {
                return rulerow;
            } else {
                return null;
            }
        });
    } else {
        return mydb.deleteRow("configs", "userid = "+userid+" AND configkey='"+configkey+"'")
        .then(result => {
            return null;
        })
    }
}

function apiCall(user, configoptions, body, protocol, req, res) { 

    if ( DEBUG8 ) {
        console.log( (ddbg()), protocol + " api call, body: ", UTIL.inspect(body, false, null, true) );
    }
    var api = body['useajax'] || body['api'] || "";
    var swid = body["id"] || "none";
    var swtype = body["type"] || "none";
    var swval = body["value"] || "";
    var swattr = body["attr"] || "";
    var subid = body["subid"] || "";
    var tileid = body["tileid"] || body["tile"] || 0;
    var command = body["command"] || "";
    var linkval = body["linkval"] || "";
    var hubid = body["hubid"] || "auto";
    var thingid = body["thingid"] || 0;
    var roomid = body["roomid"] || 0;
    var hubindex = body.hubindex || 0;

    // for POST we get vital info from GUI
    // if user is making an API call these must be provided
    if ( protocol==="POST" ) {
        var userid = body.userid;
        var usertype = body.usertype || 1;
        var panelid = body.panelid || 0;
        var pname = body.pname;
        var useremail = body.email;
        var uname = body.uname;
        var skin = body.skin;
        try {
            if ( body.rule ) {
                var rules = JSON.parse(decodeURI(body.rules));
                // console.log("POST rules: ", rules);
            } else {
                rules = null;
            }
        } catch(e) {
            rules = null;
        }

    } else if ( user && typeof user === "object" ) {
        userid = user["users_id"];
        usertype = user["users_usertype"];
        useremail = user["users_email"];
        uname = user["users_uname"];
        panelid = user["panels_id"];
        pname = user["panels_pname"];
        skin = user["panels_skin"];
    
    } else {
        userid = null;
    }

    console.log((ddbg()),"apiCall - userid: ", userid, " protocol: ", protocol, " api: ", api);
    if ( !userid && api!=="forgotpw" && api!=="createuser") {
        console.log( (ddbg()), "*** error *** user not authorized for API call. api: ", api, " body: ", body);
        return "error - HousePanel is not authorized for this user to make an API call";
    }
    
    // send mqtt message
    // if ( (api!=="dologin" || protocol==="GET") && udclient && udclient.connected ) {
    //     udclient.publish("housepanel/apiCall", JSON.stringify(body, null, 1));
    // }
 
    // handle multiple api calls but only for tiles since nobody would ever give a list of long id's
    // this now has to be a list of thingid's instead of tileid's because the tiles must be reachable
    // either will be taken and used if provided
    if ( (tileid && tileid.indexOf(",") !== -1) ) {
        var multicall = true;
        var tilearray = tileid.split(",");
    } else if ( (thingid && thingid.indexOf(",") !== -1) ) {
        multicall = true;
        tilearray = thingid.split(",");
    } else {
        multicall = false;
    }

        var result;
        switch (api) {
            
            case "doaction":
            case "action":
                if ( multicall ) {
                    tilearray.forEach(function(athing) {
                        if ( DEBUG8 ) {
                            console.log( (ddbg()), "doaction multicall: hubid: ", hubid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid, " thingid= ", athing);
                        }
                        doAction(userid, "auto", athing, configoptions, "", "", swval, swattr, subid, command, linkval, protocol);
                    });
                    result = "called doAction " + tilearray.length + " times in a multihub action";
                } else {
                    if ( DEBUG8 ) {
                        console.log( (ddbg()), "doaction: hubid: ", hubid, " swid: ", swid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid, " tileid: ", tileid);
                    }
                    result = doAction(userid, hubid, thingid, configoptions, swid, swtype, swval, swattr, subid, command, linkval, protocol);
                    // result = "call doAction for tile ID: " + swid;
                }
                break;
                
            case "doquery":
            case "query":
                if ( multicall ) {
                    result = [];
                    tilearray.forEach(function(athing) {
                        doQuery(userid, athing, protocol);
                    });
                    result = "called doQuery " + tilearray.length + " times in a multihub action";
                } else {
                    doQuery(userid, thingid, protocol);
                    result = "call doQuery for tile ID: " + swid;
                }
                break;

            case "status":
                result = {version: utils.HPVERSION, userid: userid, usertype: usertype, email: useremail, uname: uname, panel: pname, skin: skin};
                break;

            // changed to only handle page fake tile requests
            // we get the real tile from the GUI all the time now
            case "pagetile":
                if ( protocol==="POST" ) {
                    // make the fake tile for the room for editing purposes
                    var faketile = {"panel": "panel", "name": swval, "tab": "Tab Inactive", "tabon": "Tab Selected"};
                    var thesensor = { "id": "r_" + swid, "name": swval, thingid: 0, roomid: roomid, 
                                      "hubnum": "-1", "type": "page", "value": faketile};
                    result = makeThing(userid, pname, null, 0, tileid, thesensor, "wysiwyg", 0, 0, 500, "", "te_wysiwyg", null);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "wysiwyg":
                if ( protocol==="POST" ) {
                    var device = JSON.parse(decodeURI(body.value));
                    var thesensor = {id: swid, name: device.name, thingid: thingid, roomid: 0, type: device.devicetype, hubnum: "-1", hubtype: "None", 
                                    hint: device.hint, refresh: device.refresh, value: device.pvalue};
                    var customname = swattr;
                    result = makeThing(userid, pname, null, 0, tileid, thesensor, "wysiwyg", 0, 0, 999, customname, "te_wysiwyg", null);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "setorder":
                if ( protocol==="POST" ) {
                    console.log(">>>> debug in setorder: ", swtype, swval);
                    result = setOrder(userid, swtype, swval);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "setposition":
                if ( protocol==="POST" ) {
                    result = setPosition(userid, swid, swtype, swval, swattr, tileid, thingid);
                    // result = "moved tile - results pushed to database";
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "addthing":
                if ( protocol==="POST" ) {
                    var rname = swval;
                    var startpos = swattr;
                    result = addThing(userid, pname, swid, swtype, rname, hubid, hubindex, roomid, startpos);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
         
            // use the new thingid for the swattr value to delete the specific thing on the page
            case "delthing":
                if ( protocol==="POST" ) {
                    var rname = swval;
                    result = delThing(userid, swid, swtype, rname, tileid, thingid);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "pagedelete":
                if ( protocol==="POST" ) {
                    result = delPage(userid, roomid, swval);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
        
            case "pageadd":
                if ( protocol==="POST" ) {
                    result = addPage(userid, panelid);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "getphotos":
                result = getPhotos(userid, "photos");
                break;
                
            case "refactor":
                result = "error - api call [" + api + "] is no longer supported";
                break;
        
            case "refreshpage":
                if ( protocol==="POST" ) {
                    mydb.getRows("hubs","*","userid = "+userid)
                    .then(hubs => {
                        if ( hubs ) {
                            hubs.forEach(hub => {
                                if ( hub.hubid !== "-1" && hub.hubid!=="new" ) {
                                    getDevices(hub, true, "/");
                                }
                            });
                        }
                    });

                    result = "success";
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
            
            // this returns all user customizations
            case "getoptions":
                result = mydb.getRows("configs","*","userid = "+userid+" AND configkey LIKE 'user_%'")
                .then(rows => {
                    var rulelist = {};
                    if ( rows ) {
                        rows.forEach(row => {
                            if ( row.configkey !== "useroptions" ) {
                                rulelist[row.configkey] = JSON.parse(row.configval);
                            }
                        });
                    }
                    if ( DEBUG11 ) {
                        console.log( (ddbg()),"rules list for user: ", userid," list: ", jsonshow(rulelist) );
                    }
                    return rulelist;
                });
                break;
            
            // this returns just the rules list for a specific user and device swid
            case "getrules":
                var configkey = "user_" + swid;
                result = mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'")
                .then(row => {
                    var rulelist = null;
                    if ( row ) {
                        rulelist = JSON.parse(row.configval);
                        if ( DEBUG2 ) {
                            console.log( (ddbg()),"rule list for user: ", userid," swid: ", swid, " rules: ", jsonshow(rulelist) );
                        }
                    }
                    return rulelist;
                });
                break;

            // read and return devoces tied to this user
            case "getdevices":
                if ( protocol==="POST" ) {
                    var conditions = "userid = "+userid;
                    result = mydb.getRows("devices","*", conditions)
                    .then(rows => {
                        if ( DEBUG2 ) {
                            console.log( (ddbg()), "getdevices: ", rows);
                        }
                        var devices = {};
                        if ( rows ) {
                            rows.forEach(row => {
                                row.pvalue = JSON.parse(decodeURI2(row.pvalue));
                                devices[row.id] = row;
                            });
                        }
                        return devices;
                    }).catch(reason => {console.log("dberror 28a - apiCall - ", reason);});
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            // read things tied to this user and panel
            case "getallthings":
            case "getthings":
                if ( protocol==="POST" ) {
                    var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
                    var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
                    var joinstr3 = mydb.getJoinStr("devices","hubid","hubs","id");
                    var conditions = "things.userid = "+userid+" AND rooms.panelid = "+panelid;
                    result = mydb.getRows("things","*", conditions, [joinstr1, joinstr2, joinstr3])
                    .then(things => {
                        console.log( (ddbg()), "getallthings: ", things);
                        return things;
                    }).catch(reason => {console.log("dberror 28b - apiCall - ", reason);});
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
                    
            case "filteroptions":
                if ( protocol==="POST" ) {
                    result = saveFilters(userid, body);
                    // writeOptions();
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
            break;

            case "saveoptions":
                if ( protocol==="POST" ) {
                    result = processOptions(userid, panelid, body);
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
                            GLB.newcss[userid] = "";
                        }
                        GLB.newcss[userid] += decodeURI(swval);

                        // write if this is last segment
                        result = "success - " + n2.toString();
                        if ( n2=== nlen ) {
                            if ( DEBUG16 ) {
                                console.log( (ddbg()), "----------------------------------------------------------");
                                console.log( (ddbg()), "userid: ", userid, " data size: ", GLB.newcss[userid].length );
                                console.log( (ddbg()), "----------------------------------------------------------");
                            }
                            writeCustomCss( userid, pname, GLB.newcss[userid] );
                        }
                    }
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "updatenames":
                // value (swval) is new name, tileid is oldname for pages
                if ( protocol==="POST" ) {
                    result = updateNames(userid, thingid, swtype, tileid, swval);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
            
            // rewritten to use cookies
            case "dologin":
                if ( protocol==="POST" ) {
                    result = processLogin(body, res);
                } else {
                    result = "error - api call [" + api + "] is not supported";
                }
                break;

            case "forgotpw":
                if ( protocol==="POST" ) {
                    var useremail = body.email;
                    result = forgotPassword(useremail);
                } else {
                    result = "error - api call [" + api + "] is not supported";
                }
                break;

            case "createuser":
                if ( protocol==="POST" ) {
                    result = createNewUser(body);
                } else {
                    result = "error - api call [" + api + "] is not supported";
                }
                break;

            case "updatepassword":
                if ( protocol==="POST" ) {
                    result = updatePassword(body);
                } else {
                    result = "error - api call [" + api + "] is not supported";
                }
                break;

            case "pwhash":
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
            case "delcustom":
                if ( protocol==="POST" ) {
                    if ( body.rules ) {
                        var rules = JSON.parse(decodeURI(body.rules));
                    } else {
                        rules = null;
                    }
                    result = updCustom(userid, swid, rules);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "geticons":
                result = getIcons(userid, pname, skin, swval, swattr);
                break;

            // this api call starts the oauth flow process
            // the actual redirection to the first auth site is done in js file
            case "hubauth":

                if ( protocol==="POST" ) {

                    // now load the new data
                    var hub = {};
                    hub["userid"] = userid;
                    hub["hubid"] = body.hubid;
                    hub["hubhost"] = body.hubhost;
                    hub["hubtype"] = body.hubtype;
                    hub["hubname"] = body.hubname;

                    // handle New SmartThings which has known clientId and clientSecret values
                    if ( body.hubtype === "NewSmartThings" ) {
                        hub["clientid"] = GLB.clientid;
                        hub["clientsecret"] = GLB.clientsecret;
                    } else {
                        hub["clientid"] = body.clientid;
                        hub["clientsecret"] = body.clientsecret;
                    }
                    hub["hubaccess"] = body.hubaccess;
                    hub["hubendpt"] = body.hubendpt;
                    hub["hubrefresh"] = "";
                    hub["useraccess"] = body.useraccess || "";
                    hub["userendpt"] = body.userendpt || "";
                    hub["hubtimer"] = body.hubtimer || 0;
                    // hub["sinkFilterId"] = "";

                    console.log(">>>> hub in hubauth: ", hub);

                    // for now set the hubid to value user gave
                    // if this hub exists it will be overwritten
                    // if not it will be generated later or default given
                    var hubid = hub.hubid;

                    // if hubid not given assign it a random number tied to hub type
                    // for ST and HE hubs this is a placeholder
                    // for other hubs it will be permanent since it isn't used
                    if ( !hubid ) {
                        var rstr = getRandomInt(1001, 9999);
                        hubid = hub.hubtype + rstr.toString();
                        hub["hubid"] = hubid;
                    }

                    // fix up host if http wasn't given
                    if ( hub.hubhost && !hub["hubhost"].toLowerCase().startsWith("http") ) {
                        hub.hubhost = "https://" + hub["hubhost"];
                    }

                    // fix up ending slashes
                    if ( hub.userendpt.substr(-1) === "/" ) {
                        hub.userendpt = hub.userendpt.substr(0, hub.userendpt.length -1);
                    }

                    // if no name given, give it one
                    if ( !hub.hubname ||  hub.hubname.trim()==="" ) {
                        hub.hubname = hub.hubtype;
                    }

                    // if user provides hub access info, use it
                    // for ISY hubs we know the endpoint as /rest so use it
                    if ( body.hubtype==="ISY" ) {
                        body.useraccess = body.clientid + ":" + body.clientsecret;
                        body.userendpt = body.hubhost + "/rest";
                        hub.useraccess= body.useraccess;
                        hub.userendpt = body.userendpt;
                        hub.hubaccess = hub.useraccess;
                        hub.hubendpt = hub.userendpt;

                    // use provided credentials if given
                    } else if ( hub.useraccess && hub.userendpt ) {
                        hub.hubaccess = hub.useraccess;
                        hub.hubendpt = hub.userendpt;
                    }

                    // process new or modified hub information asyncronously
                    // while this runs we return to the browser instructions for what to show as place holder
                    // save the hub to DB - this could be an update or it could be a new addition
                    // so we have to first check to see if we have this hubid
                    mydb.getRow("hubs", "*", "userid = "+userid+" AND hubid = '"+hubid+"'")
                    .then(result => {
                        if ( result ) {
                            // this hub is there so lets update it and save id in user table for later
                            // this all happens asyncronously while the auth flow begins later
                            var id = result.id;
                            hub.id = id;
                            console.log(">>>> authorizing existing hub at row: ", id," hubid= ", hubid);
                            var res2 = mydb.updateRow("hubs", hub, "id = "+id)
                            .then(res3 => {
                                if ( res3 ) {
                                    console.log(">>>> updating user with default hub at row: ", userid," hubid= ", hubid);
                                    return mydb.updateRow("users",{defhub: hubid},"id = "+userid);
                                } else {
                                    return res3;
                                }
                            })
                            .catch(reason => {
                                console.log( (ddbg()), "DB update error", reason);
                                return false;
                            });
                            return res2;

                        } else {

                            // this branch is for new hubs
                            // the hubid provided by user is likely just a placeholder until hub is read later in oauth flow
                            console.log(">>>> adding a new hub with hubid= ", hubid);
                            var res2 = mydb.addRow("hubs", hub)
                            .then(result => {
                                if ( result ) {
                                    var id = result.getAutoIncrementValue();
                                    hub.id = id;
                                    console.log(">>>> updating user with default hub at row: ", userid," hubid= ", hubid);
                                    return mydb.updateRow("users",{defhub: hubid},"id = "+userid);
                                } else {
                                    console.log( (ddbg()), "error - problem atempting to create a new hub: ", hub);
                                    return null;
                                }
                            })
                            .catch(reason => {
                                console.log( (ddbg()), "DB update error", reason);
                            });
                            return res2;
                        }
                    })
                    .then( proceed => {

                        if ( proceed ) {

                            // first handle user provided auth which only works for ISY and legacy ST and HE
                            if ( hub.useraccess && hub.userendpt ) {
                                // get all new devices and update the options index array
                                // this forces page reload with all the new stuff
                                // notice the reference to /reauth in the call to get Devices
                                // this makes the final read redirect back to reauth page
                                var hubType = hub["hubtype"];

                                // for ISY and legacy ST/HE we can go right to getting hub details and devices
                                // this meets up with the js later by pushing hub info back to reauth page
                                if ( hubType==="ISY" || hubType==="SmartThings" || hubType==="Hubitat" ) {
                                    getHubInfo(hub, true);
                                    return result;
                                }
                            }
                        }

                    }).catch(reason => {console.log("dberror 30 - apiCall - ", reason);});
                    
                    var hubName = hub["hubname"];
                    var hubType = hub["hubtype"];
                    var clientId = hub.clientid;
                    var clientSecret = hub.clientsecret;
                    var host = hub["hubhost"];
                    

                    // determine what to retun to browser to hold callback info for hub auth flow
                    if ( hub.useraccess && hub.userendpt ) {
                        // get all new devices and update the options index array
                        // this forces page reload with all the new stuff
                        // notice the reference to /reauth in the call to get Devices
                        // this makes the final read redirect back to reauth page

                        // for ISY and legacy ST/HE we can go right to getting hub details and devices
                        if ( hubType==="ISY" || hubType==="SmartThings" || hubType==="Hubitat" ) {
                            result = {action: "things", hubType: hubType, hubName: hubName};
                        } else {
                            result = "error - user access and user endpoint can only be used with ISY, legacy SmartThings, and Hubitat hubs.";
                        }
        
                    // oauth flow for Ford and Lincoln vehicles
                    // we complete the flow later when redirection happens back to /oauth GET call
                    } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
                        var fordloc = GLB.returnURL + "/oauth";
                        var model = hubType.substr(0,1);
                        result = {action: "fordoauth", userid: userid, host: host, model: model, hubName: hubName, hubId: hubid, 
                                  clientId: clientId, clientSecret: clientSecret, url: fordloc};


                    // oauth flow for ST legacy and HE hubs
                    // we complete the flow later when redirection happens back to /oauth GET call
                    } else if ( hubType==="SmartThings" || hubType==="Hubitat" ) {
                        var returnloc = GLB.returnURL + "/oauth";
                        result = {action: "oauth", userid: userid, host: host, hubName: hubName, clientId: clientId, clientSecret: clientSecret, 
                                scope: "app", url: returnloc};

                    // handle new OAUTH flow for SmartThings
                    } else if ( hubType==="NewSmartThings" ) {
                        // we have to use our secure instance here
                        // var returnloc = "https://housepanel.net:3080/oauth";
                        var returnloc = GLB.returnURL + "/oauth";
                        result = {action: "oauth", userid: userid, host: host, hubName: hubName, clientId: clientId, clientSecret: clientSecret, 
                                scope: "r:devices:* x:devices:* r:scenes:* x:scenes:* r:locations:*", 
                                client_type: "USER_LEVEL", url: returnloc};

                    // otherwise return an error string message
                    } else {
                        result = "error - invalid hub type requesting an OAUTH flow. hubType: " + hubType;
                    }

                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
        
                break;
        
            case "hubdelete":
                // TODO - implement hubDelete() function
                if ( protocol === "POST" ) {
                    mydb.deleteRow("hubs","userid = "+userid+" AND id = " + swid)
                    .then(results => {
                        if ( results && results.getAffectedItemsCount() > 0 ) {
                            mydb.updateRow("users",{defhub: ""}, "id = " + userid);
                            var msg = "removed a hub with ID = " + hubid;
                            // console.log( (ddbg()),">>>> reset default hub for user ID = " + userid);
                        } else {
                            msg = "error - could not remove hub with ID = " + hubid;
                        }
                        pushClient(userid, "pagemsg", "auth", "#newthingcount", msg );
                        console.log( (ddbg()), msg);
                        return msg;
                    })
                    .catch(reason => {
                        console.log( (ddbg()), "error - ", reason);
                    });
                    result = "Attempting to removed hub #" + swattr + " hubid = " + hubid;
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                // console.log( (ddbg()), "Hub deletion is not yet supported...");
                // result = "success";
                break;

            case "getclock":
                // if ( !swid || swid==="none" ) { swid = "clockdigital"; }
                result = getClock(userid, swid, swattr);
                result = getCustomTile(userid, swattr, result, "clock", swid);
                // remove any LINKS
                // for (var key in result) {
                //     if ( result[key] && typeof result[key]==="string" && 
                //          (result[key].startsWith("LINK::") || result[key].startsWith("RULE::")) ) {
                //         delete result[key];
                //     }
                // }

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
                pushClient(userid, "reload", "main", "/");
                break;

            default:
                result = "error - unrecognized " + protocol + " api call: " + api;
                break;
        }

        // console.log(api, " API Results: ", result);
        return result;
}

// setup socket between server and all user browsers
function setupBrowserSocket() {
    var wsServer;
    var secinfo;

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
        server.listen(GLB.webSocketServerPort, function() {
            console.log( (ddbg()), secinfo, " webSocket Server is listening on port: ", GLB.webSocketServerPort);
        });
    } else {
        console.log( (ddbg()), "webSocket could not be established. webSocketServerPort= ", GLB.webSocketServerPort);
    }

    // This function handles new connections, messages from connections, and closed connections
    if ( wsServer ) {
        wsServer.on('request', function(wsrequest) {
            console.log( (ddbg()), 'Requesting websocket connection: ', wsrequest.requestedProtocols );
            if ( wsrequest.requestedProtocols[0] === "housepanel" ) {
                wsrequest.accept("housepanel", wsrequest.origin); 
            }
        });

        // wsServer.on('message', function(wsrequest) {
        //     console.log( (ddbg()), 'websocket msg data: ', wsrequest.data );
        // });

        wsServer.on('connect', function(connection) {
            var userid = 0;
            var browserurl = "";

            console.log( (ddbg()), 'Connecting websocket. Address: ', connection.socket.remoteAddress );   // connection.remoteAddresses,
            // console.log( (ddbg()), 'Connection details: ', connection );   // connection.remoteAddresses,

            // shut down any existing connections to same remote host
            browserurl = connection.socket.remoteAddress;

            // wait for message from browser telling us what user id this is
            connection.on("message", function(msg) {
                if ( msg.type==="utf8" ) {
                    userid = parseInt(msg.utf8Data);
                    console.log(">>>> browserurl: ", browserurl, " userid: ", userid);
                }

                // create this user's list of pages if not there
                if ( !clients[userid] ) {
                    clients[userid] = [];
                }
                
                // now that we know the userid and the URL of the browser, register this client
                var i = 0;
                while ( i < clients[userid].length ) {
                    var oldhost = clients[userid][i].socket.remoteAddress;
                    if ( oldhost===browserurl ) {
                        clients[userid].splice(i, 1);
                    } else {
                        i++;
                    }
                }
                var index = clients[userid].push(connection) - 1;
                console.log( (ddbg()), 'Connection accepted. Client #' + index, " host: ", browserurl, " userid: ", userid, " # Clients: ", clients[userid].length);
    
            });
        
            // user disconnected - remove all clients that match this socket
            connection.on('close', function(reason, description) {
                var host = connection.socket.remoteAddress;
                console.log( (ddbg()), "Peer: ", host, " disconnected. for: ", reason, " desc: ", description);

                // remove clients that match this host
                // clients.splice(indexsave, 1);
                var i = 0;
                if ( clients && userid && clients[userid] ) {
                    while ( i < clients[userid].length ) {
                        var oldhost = clients[userid][i].socket.remoteAddress;
                        if ( oldhost===host ) {
                            clients[userid].splice(i, 1);
                        } else {
                            i++;
                        }
                    }
                }
            });

        });
    }
}

// TODO - move this to a connector app or the javascript client browser side since ISY hubs are local
//        this way ISY things can be updated on the panel served by my central server
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
                    // console.log(">>>> ISY message from user: ", hub.userid, " msg: ", msg.utf8Data);
                    processIsyMessage(hub.userid, hub, msg.utf8Data);
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

// ***************************************************
// beginning of main routine
// ***************************************************
// var d = new Date();
// var hpcode = d.getTime();
// GLB.hpcode = hpcode.toString();

// open the database
GLB.dbinfo = JSON.parse(fs.readFileSync("dbinfo.cfg","utf8"));
// console.log(GLB.dbinfo);
var mydb = new sqlclass.sqlDatabase(GLB.dbinfo.dbhost, GLB.dbinfo.dbname, GLB.dbinfo.dbuid, GLB.dbinfo.dbpassword);

if ( DEBUG2 ) {
    console.log( (ddbg()), "Startup Options: ", UTIL.inspect(GLB.options, false, null, false));
}

var port = GLB.port;
GLB.defhub = "new";
GLB.newcss = {};

// start our main server
var httpServer;
var httpsServer;
var credentials;
try {
    // the Node.js app loop - can be invoked by client or back end
    app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    var dir = path.join(__dirname, '');
    app.use(express.static(dir));
    app.use(cookieParser());

    if ( fs.existsSync("housepanel_server.key") && fs.existsSync("housepanel_server.crt") && fs.existsSync("housepanel_server.ca") ) {
        try {
            var key = fs.readFileSync("housepanel_server.key");
            var crt = fs.readFileSync("housepanel_server.crt");
            var cabundle = fs.readFileSync("housepanel_server.ca");
            credentials = {key: key, cert: crt, ca: cabundle};
            httpsServer = https.createServer(credentials, app);
            httpsServer.listen(port, function () {
                console.log( (ddbg()), "HousePanel secure server is running at location: ", dir, " on port: ", port);
            });
        } catch (e) {
            console.log( (ddbg(), "Error attempting to start secure server", e));
            httpsServer = null;
            credentials = null;
            httpServer = http.createServer(app);
            httpServer.listen(port, function () {
                console.log( (ddbg()), "HousePanel insecure server is running at location: ", dir, " on port: ", port);
            });
        }
    } else {
        // list on the port
        httpServer = http.createServer(app);
        httpServer.listen(port, function () {
            console.log( (ddbg()), "HousePanel insecure server is running at location: ", dir, " on port: ", port);
        });
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

    // resetRules();
    GLB.rules = [];
    // resetRuleTimers();

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

        // var $tc = "";

        // handle ngrok which thinks it is http but is really https
        var hostname = req.headers.host;
        if ( req.headers.host.endsWith("ngrok.io") ) {

            GLB.returnURL = "https://" + hostname;
        } else {
            GLB.returnURL = req.protocol + "://" + hostname;
        }

        // first check to see if user is requesting a password reset or new account confirmation
        // in both cases a cookie will not be set but we can check for valid user from hpcode query parameter
        if ( req.path === "/activateuser" || req.path === "/confirmreset" ) {

            
            var queryobj = req.query || {};
            var result;
            if ( queryobj.userid && queryobj.hpcode ) {
                var userid = queryobj.userid;
                mydb.getRow("users","*", "id = "+userid)
                .then(row => {
                    if ( row && row.hpcode === queryobj.hpcode ) {
                        // set the cookies to log the user in

                        if ( req.path === "/activateuser" ) {
                            setCookie(res, "uname", pw_hash(row.email));
                            setCookie(res, "pname", pw_hash("default"));
                            result = getNewUserPage(row, hostname);
                        } else {
                            result = getNewPasswordPage(row, hostname);
                        }
                    } else {
                        result = getLoginPage(0, 0, "", hostname, "skin-housepanel");
                    }
                    res.send(result);
                    res.end();
                })
            } else {
                result = getLoginPage(0, 0, "", hostname, "skin-housepanel");
                res.send(result);
                res.end();
            }
            return;

        }


        // everything starts with finding the username which drives which rows we read from the DB
        getUserName(req.cookies)
        .then(results => {

            
            if ( !results || !results["users_id"] ) {
                if ( DEBUG3 ) {
                    console.log( (ddbg()), "login rejected.");
                }

                var result = getLoginPage(0, 0, "", hostname, "skin-housepanel");
                res.send(result);
                res.end();
        
            } else {

                var user = results;
                var userid = user["users_id"];
                var useremail = user["users_email"];
                var uname = user["users_uname"];
                var defhub = user["users_defhub"];
                var usertype = user["users_usertype"];
                var panelid = user["panels_id"];
                var pname = user["panels_pname"];
                var skin = user["panels_skin"];

                // retrieve the configs and hubs
                mydb.getRows("configs", "*", "userid="+userid)
                .then(configoptions => {
                    return configoptions;
                })
                .then(configoptions => {
                    return mydb.getRows("hubs", "*", "userid="+userid)
                    .then(hubs => {
                        return [configoptions, hubs];
                    });
                })
                .then(result => {

                    var configoptions = result[0];
                    var hubs = result[1];
                    if ( DEBUG1 ) {
                        console.log( (ddbg()), "configoptions: ", configoptions);
                        console.log( (ddbg()), "hubs: ", hubs);
                    }

                    var $tc = "";

                    // first check for a valid login
                    if ( typeof req.path==="undefined" || req.path==="/" ) {

                        // find any query params - if provided then user is doing an API call with HP
                        var queryobj = req.query || {};
                        var isquery = (utils.count(queryobj) > 0);

                        // display the main page if user is in our database
                        // don't check password here because it is checked at login
                        // and the cookie is set which means all is okay
                        if ( DEBUG3 ) {
                            console.log( (ddbg()), "login accepted. user: ", user);
                        }

                        if ( isquery ) {
                            $tc = apiCall(user, configoptions, queryobj, "GET", req, res);

                        // this is what makes the main page
                        } else {
                            getMainPage(user, configoptions, hubs, req, res);
                            $tc = null;
                        }

                        if ( $tc && typeof $tc === "object" && $tc.then && typeof $tc.then==="function" ) {
                            $tc.then(result => {
                                res.send(result);
                                res.end();
                            });
                        } else if ($tc) {
                            res.send($tc);
                            res.end();
                        }

                    } else if ( req.path==="/showid" ) {
                        getInfoPage(user, configoptions, hubs, req)
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    } else if ( req.path==="/showoptions") {
                        getOptionsPage(user, configoptions, hubs, req)
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    } else if ( req.path==="/logout" ) {
                        // clear the cookie to force repeat of login page
                        res.clearCookie("uname");
                        res.clearCookie("pname");
                        var result = getLoginPage(userid, usertype, "", hostname, "skin-housepanel");
                        res.send(result);
                        res.end();

                    } else if ( req.path==="/reauth" ) {
                        getAuthPage(user, configoptions, req.headers.host, "/reauth", "")
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    } else if ( req.path==="/userauth") {
                        getAuthPage(user, configoptions, req.headers.host, "/reauth", "")
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    // this is where the oauth flow returns from the first auth step
                    } else if ( req.path==="/oauth") {
                        if ( req.query && req.query["code"] ) {
                            var hubid = user["users_defhub"];
                            if ( DEBUG2 ) {
                                console.log( (ddbg()), "in /oauth apiCall - defhub = ", hubid);
                            }
                            var hub = findHub(hubid)
                            .then(row => {
                                if ( row ) {
                                    hub = row;
                                    if ( DEBUG2 ) {
                                        console.log( (ddbg()), "Getting access_token for hub: ", hub);
                                    }
        
                                    // get access_token, endpt, and retrieve devices
                                    // this goes through a series of callbacks
                                    // and ends with a pushClient to update the auth page
                                    getAccessToken(userid, req.query["code"], hub);
                                    return row;
                                } else {
                                    console.log( (ddbg()), "error - hub not found during authorization flow. hubid: ", hubid);
                                }
                            });
                        }

                        getAuthPage(user, configoptions, req.headers.host, "/reauth", "working...")
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

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

            }

        }).catch(reason => {console.log("dberror 31 - app.get - ", reason);});


    });
    
    app.put('*', function(req, res) {
        console.log( (ddbg()), "PUT api calls are not supported. Use POST instead. Requested put: ", req.path);
        res.end();
    });

    // *********************************************************************************************
    // POST api calls are handled here including those sent from ST and HE hubs
    // to process changes made outside of HP
    // from SmartThings legacy and Hubitat hubs this is done in the "changeHandler" function
    // found in the HousePanel.groovy application with this line
    //     postHub(state.directIP, state.directPort, "update", deviceName, deviceid, attr, value)
    // --------------
    // for new SmartThings accounts this is done via a callback to the /sinks endpoint below
    // *********************************************************************************************
    
    // TODO - add protection to ensure post came from an authenticated user
    app.post("*", function (req, res) {

        // get user name
        var hubid;

        // handle two types of messages posted from hub
        // the first initialize type tells Node.js to update elements
        if ( req.path==="/" && req.body['msgtype'] === "initialize" ) {
            hubid = req.body['hubid'] || null;

            if ( hubid ) {
                mydb.getRow("hubs","*","hubid = " + hubid)
                .then(hub => {
                    getDevices(hub, true, "/");
                }).catch(reason => {console.log("dberror 32 - app.post - msg initialize - ", reason);});
                if ( DEBUG2 ) {
                    console.log( (ddbg()), "New hub authorized: ", hubid);
                }
                res.json('hub info updated');
            } else {
                res.json('error - hubid not provided');
            }

        // handle register events callbacks from Groovy - legacy SmartThings and Hubitat here
        } else if ( req.path==="/" && req.body['msgtype'] === "update" ) {
            if ( DEBUG19 ) {
                console.log( (ddbg()), "Received update msg from hub: ", req.body["hubid"], " msg: ", req.body);
            }
            hubid = req.body['hubid'] || null;
            if ( hubid ) {
                mydb.getRow("hubs","*","hubid = '" + hubid + "'")
                .then(hub => {
                    if ( hub ) {
                        processHubMessage(hub.userid, hub, req.body, false);
                    }
                }).catch(reason => {console.log("dberror 33a - app.post - msg update - ", reason);});
            }
            res.json("msg received and processed");
            res.end();

        // handle connector for ISY hubs that process webSockets locally
        // there is a little local connector app that sends a post with the message to our server
        // only works with a single ISY hub as there is no elegant way to pass the hub IP here
        } else if ( req.path==="/" && req.body.type && req.body.type==="utf8" && req.body.utf8Data ) {
            if ( DEBUG19 ) {
                console.log( (ddbg()), "Received msg from ISY hub. msg: \n", req.body);
            }

            mydb.getRow("hubs","*","hubtype = 'ISY'")
            .then(hub => {
                if ( hub ) {
                    processIsyMessage(hub.userid, hub, req.body.utf8Data);
                }
            }).catch(reason => {console.log("dberror 33b - app.post - msg update - ", reason);});
            
            res.send("ISY msg done processing: " + req.body.utf8Data);
            res.end();

        // handle events from Sonos connector
        } else if ( req.path==="/" && req.body.type && req.body.type==="sonos" && req.body.sonosData && req.body.sonosDescription && req.body.sonosDevice ) {
            var userid = req.body.userid;
            var roomName = req.body.sonosDescription.roomName;
            var sonosData = req.body.sonosData;
            var sonosDevice = req.body.sonosDevice;

            // set the values
            // try getting audio device from DB with matching name
            mydb.getRow("devices","*","userid = "+userid+" AND devicetype = 'audio' AND name LIKE '%"+roomName+"%'")
            .then(device => {
                if ( device ) {
                    var pvalue = JSON.parse(decodeURI2(device.pvalue));
                    pvalue.audioTrackData = {
                        title: sonosData.title,
                        artist: sonosData.artist,
                        album: sonosData.album,
                        albumArtUrl: sonosData.albumArtURI,
                        mediaSource: "Sonos " + sonosDevice.host
                    }
                    
                    if ( DEBUG19 ) {
                        console.log(">>>> updating Sonos device with pvalue: ", pvalue);
                    }
                    pushClient(userid, device.deviceid, "audio", "trackImage", pvalue, null);

                    // update device in DB
                    pvalue = encodeURI2(JSON.stringify(pvalue));
                    mydb.updateRow("devices",{pvalue: pvalue},"userid = "+userid+" AND id = "+device.id);

                    res.send("Sonos msg received and applied to device: " + device.name);
                    res.end();
                } else {
                    if ( DEBUG19 ) {
                        console.log(">>>> error applying Sonos msg from ",roomName," to a Sonos device. sonosData:", sonosData);
                    }
                    res.send("error - Sonos msg received but no matching device found to apply it to");
                    res.end();
                }
            });
        
        // handle events from new SmartThings
        } else if ( (req.path==="/" || req.path==="/sinks") && 
                    (req.body["messageType"] && req.body["messageType"]==="EVENT" && req.body.eventData ) ) {

            // first lets get the name of the Sink and the hub to know which user to update
            var events = req.body.eventData.events;
            events.forEach(function(eventgrp) {
                var subscription = eventgrp.subscriptions[0];
                var event = eventgrp.event;

                // if ( DEBUG19 && event.deviceEvent && 
                //      (event.deviceEvent.capability === 'mediaTrackControl' || event.deviceEvent.capability === 'audioTrackData') ) {
                //     console.log( (ddbg()), "Audio newST: ", UTIL.inspect(event, false, null, false));
                // }
                if ( event.eventType==="DEVICE_EVENT" && event.deviceEvent.stateChange ) {

                    hubid = subscription.installedAppId;
                    // console.log(">>>> hubid from ST msg: ", hubid);

                    // var hub = findHub(hubId);
                    // get hub and user from the DB
                    mydb.getRow("hubs","*","hubid = '" + hubid + "'")
                    .then(hub => {
                        if ( hub ) {
                            var userid = hub.userid;
                            var swid = event.deviceEvent.deviceId;
                            var attr = event.deviceEvent.attribute;
                            var valueType = event.deviceEvent.valueType;
                            var msg = {
                                msgtype: "update", 
                                hubid: hubid,
                                change_name: "",
                                change_device: swid,
                                change_attribute: attr,
                                change_type: valueType,
                                change_value: event.deviceEvent.value
                            };
    
                            processHubMessage(userid, hub, msg, true);
                            if ( DEBUG19s ) {
                                console.log( (ddbg()), "Event sink msg from new ST hub: ", hubid, " msg: ", msg, 
                                " stateChange: ", event.deviceEvent.stateChange,
                                " filterNames: ", subscription.sinkFilterNames);
                            }
                        }
                    }).catch(reason => {console.log("dberror 34 - app.post newST /sink - ", reason);});        
                }
            });
            
            // console.log( (ddbg()), "Event from new SmartThings: ", UTIL.inspect(req.body.eventData, false, null, false) );
            res.json("new SmartThings event received");
            res.end();

        // handle all api calls upon the server from js client and external api calls here
        // note - if user calls this externally then the userid and thingid values must be provided
        // most users won't know these values but they are shown on the showid page
        // GET calls from a browser are easier because the cookie will be set
        // this means that user GET API calls can only be made from a device that has HP running on it
        // POST calls can be made from any platform as long as the userid and thingid values are known
        } else if ( req.path==="/" &&  typeof req.body['useajax']!=="undefined" || typeof req.body["api"]!=="undefined" ) {
            var result = apiCall(null, null, req.body, "POST", req, res);

            if ( typeof result === "object" && typeof result.then === "function" ) {
                result.then(res2 => {
                    res.json(res2);
                    res.end();
                });
            } else {
                res.json(result);
                res.end();
            }

        // handle unknown requests
        } else {
            console.log( (ddbg()), "HousePanel received unknown POST message: ", req.body);
            res.json('HousePanel server received an unknown message.'+JSON.stringify(req.body));
            res.end();
        }

    });

    // set up sockets
    setupBrowserSocket();

    // this version skips MQTT for polisy boxes since that only works for local
    // we keep the option of using MQTT to communicate with each client
    var udclient;
    // var hostname = "housepanel.net";

    if ( MQTTHP && hostname ) {
        try {
            if ( fs.existsSync("__housepanel_server.crt") && fs.existsSync("__housepanel_server.key") && fs.existsSync("__housepanel_server.ca") ) {
                var cert = fs.readFileSync("housepanel_server.crt");
                var key = fs.readFileSync("housepanel_server.key");
                var ca = fs.readFileSync("housepanel_server.ca");
                var udopts = {host: hostname, port: "1883",
                            ca: ca, cert: cert, key: key,
                            checkServerIdentity: () => { return null; },
                            rejectUnauthorized: false};
                udclient = mqtt.connect("mqtts://" + hostname, udopts);
            } else {
                udclient = mqtt.connect("mqtt://" + hostname );
            }
        } catch (e) {
            console.log( (ddbg()), "Cannot establish MQTT connection. ", e);
            udclient = null;
        }

        if ( udclient ) {
            // for now just print out messages received
            udclient.on("message", function(topic, msg) {
                if ( topic.startsWith("housepanel/") ) {
                    console.log( (ddbg()), "HousePanel mqtt topic: ", topic, " msg: ", msg.toString() );
                } else {
                    console.log( (ddbg()), "Unknown mqtt topic: ", topic, " msg: ", msg.toString() );
                }
            });

            udclient.on("error", function(err) {
                console.log( (ddbg()), "UDI MQTT error: ", err);
            });

            // subscribe to our own HP publishing calls
            udclient.on("connect", function() {
                udclient.subscribe("housepanel/#", {qos: 0}, function(err, granted) {
                    if ( !err ) {
                        console.log( (ddbg()), "MQTT subscribed to: ", granted );
                        udclient.publish("housepanel", "HousePanel mqtt setup and listening...");
                    } else {
                        console.log( (ddbg()), "MQTT error subscribing to housepanel topic: ", err);
                    }
                });
                console.log( (ddbg()), "UDI mqtt status: ", udclient.connected);
            });
        }

    }

}