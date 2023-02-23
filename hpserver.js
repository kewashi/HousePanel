#!/usr/bin/env node

"use strict";
process.title = 'hpserver';

// debug options
const DEBUG1 = false;               // basic debug info - file loading, hub loading
const DEBUG2 = false;               // authorization flow and ISY programs
const DEBUG3 = false;               // passwords
const DEBUG4 = false;               // filters and options
const DEBUG5 = false;               // hub node detail
const DEBUG6 = false;               // tile adds and position moves
const DEBUG7 = false;               // hub responses
const DEBUG8 = false;               // API calls
const DEBUG9 =  false;              // ISY webSocket success
const DEBUG10 = false;              // sibling tag
const DEBUG11 = false;              // rules
const DEBUG12 = false;              // hub push updates
const DEBUG13 = false;              // URL callbacks
const DEBUG14 = false;              // tile link details
const DEBUG15 = false;              // new user and forgot password
const DEBUG16 = false;              // writing and custom names
const DEBUG17 = false;              // push client
const DEBUG18 = false;              // ST, HE, and Ford messages in callHub -> getHubResponse
const DEBUG19 = false;              // new ST Event Sink debugs
const DEBUG20 = false;              // New SmartThings detail
const DEBUG21 = false;              // New ST sink message debug
const DEBUG22 = false;              // login info
const DEBUGcurl = false;            // detailed inspection
const DEBUGsonos = false;           // Sonos hub debugging
const DEBUGisy = false;              // ISY debug info
const DEBUGtmp = true;              // used to debug anything temporarily using ||

// various control options
const DONATE = false;                 // set this to true to enable donation section
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
// const bodyParser = require('body-parser');
const xml2js = require('xml2js').parseString;
const crypto = require('crypto');
const UTIL = require('util');
// const mqtt = require('mqtt');
// const os = require('os');
const cookieParser = require('cookie-parser');
const request = require('request');
const url = require('url');
const nodemailer = require('nodemailer');
// const countrytime = require('countries-and-timezones');

// load supporting modules
var sqlclass = require("./mysqlclass");
var devhistory = require("./devhistory.js");

// global variables are all part of GLB object
var GLB = {};

GLB.devhistory = devhistory.DEV;
GLB.HPVERSION = GLB.devhistory.substring(1,9).trim();
GLB.APPNAME = 'HousePanel V' + GLB.HPVERSION;

GLB.port = 3080;
GLB.webSocketServerPort = 8180;

GLB.defaultrooms = {
    "Kitchen": "clock|kitchen|sink|pantry|dinette" ,
    "Family": "clock|family|mud|fireplace|casual|thermostat",
    "Living": "clock|living|dining|entry|front door|foyer",
    "Office": "clock|office|computer|desk|work",
    "Bedroom": "clock|bedroom|kid|kids|bathroom|closet|master|guest",
    "Outside": "clock|garage|yard|outside|porch|patio|driveway|weather",
    "Music": "clock|sonos|music|tv|television|alexa|echo|stereo|bose|samsung|pioneer"
};

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
    switchlevel: [ ["switch","switchLevel"], ["_on","_off"]],
    bulb: [ ["colorControl","switch"],["_on","_off","color"]], 
    button: [ ["button"],["_pushed","_held"]],
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
    power: [ ["powerMeter","energyMeter"],null],
    // energy: [ ["energyMeter"],null],
    fan: [ ["fanSpeed"],null],
    smoke: [ ["smokeDetector"],null], 
    sound: [ ["soundSensor"],null], 
    tamper: [ ["tamperAlert"],null], 
    cosensor: [ ["carbonMonoxideMeasurement"],null], 
    co2sensor: [ ["carbonDioxideMeasurement"],null], 
    valve: [ ["valve"],["_open","_close"]], 
    weather: [ ["temperatureMeasurement","relativeHumidityMeasurement","illuminanceMeasurement"],["_refresh"]],
    audio: [ ["mediaPlayback","audioVolume","audioMute"],["_previousTrack","_pause","_play","_stop","_nextTrack","_volumeDown","_volumeUp","_mute","_unmute","_refresh"]], 
    shade: [ ["windowShade","switchLevel"],["_open","_close","_pause","_presetPosition"]], 
    tone: [ ["tone"],["_beep"]], 
    uvindex: [["ultravioletIndex"],null],
    voltage: [["voltageMeasurement"],null],
    washer: [ ["washerOperatingState","washerMode","switch"],["_on","_off","_pause","_run","_stop","_setWasherMode"]],
    vacuum: [ ["robotCleanerCleaningMode"],["_auto","_part","_repeat","_manual","_stop"]],
    water: [ ["waterSensor"],null],
    location: [ ["location"],["_refresh"]]
    // , other: ["sensor",null], 
    // actuator: ["actuator",null] 
};

// list of capabilities that generate an event
GLB.trigger1 = [
    "audioMute", "audioVolume", "battery", "colorControl", "colorTemperature", "contactSensor", "doorControl",
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

// server variables
var app;
var applistening = false;

function setCookie(res, avar, theval, days) {
    var options = {SameSite: "lax"};
    if ( !days ) {
        days = 365;
    }
    options.maxAge = days*24*3600*1000;
    // modified cookie routines to tack on port to ensure we match this instance of the app
    var thevar = avar + GLB.port;
    res.cookie(thevar, theval, options);
}

function getCookie(req, avar) {
    // modified cookie routines to tack on port to ensure we match this instance of the app
    var cookies = req.cookies;
    var thevar = avar + GLB.port;
    if ( is_object(cookies) && typeof cookies[thevar]==="string" ) {
        var val = cookies[thevar];
    } else {
        val = null;
    }
    return val;
}

function delCookie(res, avar) {
    // modified cookie routines to tack on port to ensure we match this instance of the app
    var thevar = avar + GLB.port;
    res.clearCookie(thevar);
}

function hidden(pname, pvalue, id) {
    var inpstr = "<input type='hidden' name='" + pname + "'  value='" + pvalue + "'";
    if (id) { inpstr += " id='" + id + "'"; }
    inpstr += " />";
    return inpstr;
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

function getHeader(userid, pname, skin, skip) {

    var $tc = '<!DOCTYPE html>';
    $tc += '<html lang="en"><head>';
    $tc += '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">';
    
    // specify icon and color for windows machines
    $tc += '<meta name="msapplication-TileColor" content="#2b5797">';
    $tc += '<meta name="msapplication-TileImage" content="media/mstile-144x144.png">';

    $tc += "<title>HousePanel</title>";
    
    // specify icons for browsers and apple
    $tc += '<link rel="icon" type="image/png" href="media/favicon-16x16.png" sizes="16x16"> ';
    $tc += '<link rel="icon" type="image/png" href="media/favicon-32x32.png" sizes="32x32"> ';
    $tc += '<link rel="icon" type="image/png" href="media/favicon-96x96.png" sizes="96x96"> ';
    $tc += '<link rel="apple-touch-icon" href="media/apple-touch-icon.png">';
    // $tc += '<link rel="shortcut icon" href="media/favicon.ico">';
    
    // load jQuery and themes
    $tc += '<link rel="stylesheet" type="text/css" href="jquery-ui.css">';
    $tc += '<script src="jquery-1.12.4.min.js"></script>';
    $tc += '<script src="jquery-ui.min.js"></script>';

    // include hack from touchpunch.furf.com to enable touch punch through for tablets
    $tc += '<script src="jquery.ui.touch-punch.min.js"></script>';
    
    if ( !skip ) {
        // minicolors library
        $tc += '<script src="jquery.minicolors.min.js"></script>';
        $tc += '<link rel="stylesheet" href="jquery.minicolors.css">';

        // analog clock support
        $tc += '<!--[if IE]><script type="text/javascript" src="excanvas.js"></script><![endif]-->';
        $tc += '<script type="text/javascript" src="coolclock.js"></script>';
    }
    
    // load main script file
    var customhash = "js001_" + GLB.HPVERSION;
    // $tc.= "<link id=\"customtiles\" rel=\"stylesheet\" type=\"text/css\" href=\"$skin/customtiles.css?v=". $customhash ."\">";
    $tc += '<script type="text/javascript" src="housepanel.js?v='+customhash+'"></script>';  

    if ( !skip ) {
        // load tile editor and customizer
        $tc += "<script type='text/javascript' src='tileeditor.js'></script>";
        $tc += '<script type="text/javascript" src="customize.js"></script>';
    }
    
    // load fixed css file with cutomization helpers
    $tc += "<link id='tileeditor' rel='stylesheet' type='text/css' href='tileeditor.css'>";	
    
    // load the main css file - first check for valid skin folder
    if (!skin) {
        skin = "skin-housepanel";
    }
    $tc += "<link rel=\"stylesheet\" type=\"text/css\" href=\"" + skin + "/housepanel.css\">";
    
    if ( userid && pname && !skip ) {
    
        // load the custom tile sheet for this user if it exists
        // replaced logic to make customizations skin specific
        var userfn = "user" + userid + "/" + pname + "/customtiles.css";
        // var userfn = "user" + userid + "/" + skin + "/customtiles.css";
        if ( fs.existsSync(userfn ) ) {
            $tc += "<link id=\"customtiles\" rel=\"stylesheet\" type=\"text/css\" href=\"" + userfn + "\">";
        }
    }
    
    // begin creating the main page
    $tc += '</head><body>';
    $tc += '<div class="maintable">';
    return $tc;
}

function getFooter() {
    return "</div></body></html>";
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jsonshow(obj) {
    return UTIL.inspect(obj, false, null, false);
}

// trying to not use encoding
function encodeURI2(obj) {
    var str = JSON.stringify(obj)
    str = str.replace(/'/g,"");
    // return encodeURI(str);
    return str;
}

function decodeURI2(str) {
    if ( !str || typeof str !== "string" || str==="undefined" ) {
        return null;
    }
    
    var obj;
    var decodestr = str;
    if ( str.startsWith("%7B") ) {
        decodestr = decodeURI(str);
    }
    try {
        obj = JSON.parse(decodestr);
    } catch(e) {
        console.log( (ddbg()),"error parsing existing string into an object, string: ", decodestr);
        obj = null;
    }
    return obj;
}

function hsv2rgb(h, s, v) {
    var r, g, b;

    function toHex(thenumber) {
        var hex = thenumber.toString(16);
        if (hex.length === 1) {
          hex = "0" + hex;
        }
        return hex;
    }

    h = Math.round(h);
    s /= 100.0;
    v /= 100.0;
    if ( h == 360 ) {
        h = 0;
    } else {
        h = h / 60;
    }
    var i = parseInt(Math.floor(h));
    var f = h - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    
    r = parseInt(Math.round(r*255));
    g = parseInt(Math.round(g*255));
    b = parseInt(Math.round(b*255));
    
    var rhex = toHex(r);
    var ghex = toHex(g);
    var bhex = toHex(b);
    return "#"+rhex+ghex+bhex;
}

function objCount(obj) {
    if ( typeof obj === "object" )  {
        return Object.keys(obj).length;
    } else {
        return 0;
    }
}
        
function findDevice(bid, swtype, devices) {
    for (var id in devices) {
        var device = devices[id];
        if ( device["devices_deviceid"] === bid && device["devices_devicetype"] === swtype ) {
            return device["devices_id"];
        } else if ( device["deviceid"] === bid && device["devicetype"] === swtype ) {
            return device["id"];
        }
    }
    return null;
}

function getConfigItem(configoptions, tag) {
    // skip everything if configs are not defined or bogus tag given
    if ( !configoptions || !tag ) {
        return null;
    }

    var result = null;
    configoptions.forEach(function(opt) {
        if ( opt.configkey === tag ) {
            result = opt.configval;
        }
    });

    // try converting to object
    if ( (result && typeof result === "string") && 
         (tag==="useroptions" || tag==="specialtiles" || tag.startsWith("user_") || tag.startsWith("[") || tag.startsWith("{")) ) {
        var original = result;
        try {
            result = JSON.parse(result);
        } catch (e) {
            result = original;
        }
    }
    return result;
}

// this function gets the user name and panel name that matches the hashes
async function getUserName(req) {
    var uhash = getCookie(req, "uname");
    var phash = getCookie(req, "pname");
    if ( phash && phash.substr(1,1) === ":" ) {
        phash = phash.substr(2);
    }

    // get all the users and check for one that matches the hashed email address
    // emails for all users must be unique
    // *** note *** changed to map userid to the usertype to support multiple logins mapped to same user
    var joinstr = mydb.getJoinStr("panels", "userid", "users", "usertype");
    var fields = "users.id as users_id, users.email as users_email, users.uname as users_uname, users.mobile as users_mobile, users.password as users_password, " +
                 "users.usertype as users_usertype, users.defhub as users_defhub, users.hpcode as users_hpcode, " + 
                 "panels.id as panels_id, panels.userid as panels_userid, panels.pname as panels_pname, panels.password as panels_password, panels.skin as panels_skin";
    var result = mydb.getRows("panels", fields, "", joinstr)
    .then(rows => {
        var therow = null;
        if ( uhash && rows ) {
            for ( var i=0; i<rows.length; i++ ) {
                var row = rows[i];

                // if username hash matches uname hash or email hash and if panel name hash match then proceed
                if ( ( pw_hash(row["users_email"]) === uhash || pw_hash(row["users_uname"]) === uhash ) && 
                        ( pw_hash(row["panels_pname"]) === phash ) ) {
                    therow = row;
                    break;
                }
            }
        }
        return therow;
    }).catch(reason => {
        console.log( (ddbg()), "user not found, returning null. reason: ", reason);
        return null;
    });
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
    thingtypes.push("sonos");
    thingtypes.push("variables");
    thingtypes.push("piston");

    thingtypes.sort();
    return thingtypes;
}

// we no longer use this function - but it could be a good replacement for echo Speaks
// function speakText(userid, phrase) {
//     var params = {
//         key: GLB.dbinfo.voicekey,
//         hl: "en-us",
//         v: "Amy",
//         f: "16khz_16bit_mono",
//         c: "MP3",
//         src: phrase
//     };
//     var headers = {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
//     var opts = {};
//     opts.form = params;
//     opts.url = "https://api.voicerss.org";
//     opts.headers = headers;

//     var filename = "user" + userid.toString() +"_speak.mp3";
//     request(opts)
//     .pipe(fs.createWriteStream(filename))
//     .on('error',function(err) {
//         console.log((ddbg()), "error - failed to speak for userid: ", userid," speak error:", err);
//     });
// }

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
        
        // check for custom directory and if not there make it
        var panelfolder = "user" + userid + "/" + pname;
        if ( !fs.existsSync(panelfolder) ) {
            makeDefaultFolder(userid, pname);
        }
                
        var fname = panelfolder + "/customtiles.css";
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
        } catch (e) {
            console.log( (ddbg()), e);
        }
    } else {
        console.log( (ddbg()), "custom CSS file not saved to file:", fname);
    }
}

function sendText(phone, msg) {
    // if a twilio account was provided, text the code
    if ( twilioClient && phone && phone.length>=7 ) {
        twilioClient.messages.create({   
            messagingServiceSid: twilioService,  
            to: phone,
            body: msg
        }) 
        .then(message => {
            console.log( (ddbg()), "Sent txt: ", msg," to: ", phone, " SID: ", message.sid);
        });
    }
}

function sendEmail(emailname, msg) {
    if ( emailname ) {
        var transporter;
        transporter = nodemailer.createTransport({
            secure: false,
            host: GLB.dbinfo.emailhost,
            port: GLB.dbinfo.emailport,
            auth: {
                user: GLB.dbinfo.emailuser,
                pass: GLB.dbinfo.emailpass
            },
            tls: {rejectUnauthorized: false}
        });

        // setup the message
        var textmsg = "If you did not request a new HousePanel acount for user [" + emailname + "] please ignore this email.\n\n";
        textmsg+= "To confirm and activate your HousePanel account, paste this into your browser window:\n\n";
        textmsg+= msg;
        textmsg+= "This code expires in 15 minutes.";
        var htmlmsg = "<strong>If you did not request a new HousePanel account for user [" + emailname + "] please ignore this email.</strong><br><br>";
        htmlmsg+= msg;
        htmlmsg+= "<br><br>This code expires in 15 minutes.";

        var message = {
            from: GLB.dbinfo.emailuser,
            to: emailname,
            subject: "HousePanel confirmation code",
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
    }
}

function json2query(params) {
    var queryString = Object.keys(params).map(key => key + '=' + params[key]).join('&');
    return queryString;   
}

// this curl function uses promises so it can be chained with .then() like any other promise
function _curl(host, headers, nvpstr, calltype, callback) {
    var promise = new Promise(function(resolve, reject) {
        // var myURL = url.parse(host);
        if ( ! host.startsWith("http") ) {
            host = "http://" + host;
        }
        var myURL = new URL(host);
        if ( DEBUGcurl ) {
            console.log( (ddbg()),"myURL: ", myURL );
        }

        // add query string if given separately
        var formbuff;
        if ( typeof nvpstr === "string" || typeof nvpstr === "number" ) {
            nvpstr = nvpstr.toString();
            if ( calltype==="GET" ) {
                if ( nvpstr!=="" ) { host = host + "?" + nvpstr; }
            } else {
                formbuff = nvpstr; // Buffer.from(nvpstr);
            }
        } else if ( typeof nvpstr === "object" ) {
            formbuff = Buffer.from(JSON.stringify(nvpstr));
        } 

        if ( DEBUGcurl ) {
            console.log((ddbg()), "_curl buffer: ", formbuff);
        }

        if ( formbuff ) {
            if ( !headers ) {
                headers = {};
            }
            if ( typeof nvpstr === "string" ) {
                headers['Content-Length'] = nvpstr.length;
            } else {
                headers['Content-Length'] = Buffer.byteLength(formbuff);
            }
        }

        var myport = myURL.port;
        // if ( !myport ) {
        //     if ( myURL && myURL.protocol === "https:" ) {
        //         myport = 443;
        //     } else {
        //         myport = 80;
        //     }
        // }

        const opts = {
            hostname: myURL.hostname,
            port: myport,
            path: myURL.pathname,
            rejectUnauthorized: false,
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
                if ( DEBUGcurl ) {
                    console.log((ddbg()), "_curl debug: body: ", body, " totalbody: ", totalbody);
                }
            });
            res.on("end", ()=> {
                resolve(totalbody);
                if ( callback && typeof callback === "function"  ) {
                    if ( statusCode === 200 ) {
                        callback(statusCode, totalbody);
                    } else {
                        callback(statusCode, null);
                    }
                }
                if ( DEBUGcurl ) {
                    console.log((ddbg()), "end of _curl message. status: ", statusCode, statusMsg, " body: ", totalbody);
                }
            });
        }
    });
    return promise;

}

function curl_call(host, headertype, nvpstr, formdata, calltype, callback) {
    var opts = {url: host, rejectUnauthorized: false};
    if ( !calltype ) {
        calltype = "GET";
    }
    opts.method = calltype;
    
    if ( nvpstr && typeof nvpstr === "object" ) {
        opts.form = nvpstr;
    } else if ( nvpstr && typeof nvpstr === "string" ) {
        opts.url = host + "?" + nvpstr;
    }
    
    if (formdata || formdata==="") {
        opts.formData = formdata;
    }
    
    if ( headertype ) {
        opts.headers = headertype;
    }
    request(opts, callback);
}

// rewrote this function to use promises and return actual results when it is done
// this way hub authorizations work and return number of devices properly
function getHubInfo(hub) {
    if ( DEBUG2 ) {
        console.log( (ddbg()), "in getHubInfo - hub: ", hub);
    }

    // use promises so we can return actual number of devices returned
    const errMsg = "error processing getHubInfo";
    var access_token = hub.hubaccess;
    var clientId = hub.clientid;
    var clientSecret = hub.clientsecret;
    var endpt = hub.hubendpt;
    var userid = hub.userid;

    var promise = new Promise( function(resolve, reject) {
    
        // for legacy ST and Hubitat hubs we make a call to get hub name and other info
        if ( hub.hubtype==="Hubitat" ) {
            var namehost = endpt + "/gethubinfo";
            var header = {"Authorization": "Bearer " + access_token};
            var nvpreq = {"scope": "app", "client_id": clientId, "client_secret": clientSecret};
            curl_call(namehost, header, nvpreq, false, "POST", hubitatCallback);

        // handle Sonos hubs
        // start by making a call to retrieve all households
        // limited to reading only the first household found
        } else if ( hub.hubtype==="Sonos" ) {
            var namehost = endpt + "/v1/households";
            var header = {"Content-Type": "application/json",
                        "Authorization": "Bearer " + access_token,
                        "Content-Length": 0};

            _curl(namehost, header, "", "GET")
            .then(body => {
            // curl_call(namehost, header, null, null, "GET", function(err, res, body) {
                // console.log("sonos households returned err: ", err, " body: ", body);
                var jsonbody = body ? JSON.parse(body) : null;
                if ( jsonbody ) {
                    var households = jsonbody.households;
                    var sonoscount = households.length;
                    if ( sonoscount===0 ) {
                        throw "No sonos households in this account";
                    } else if ( sonoscount=== 1 ) {
                        var oldhubId = hub.hubid;
                        hub.hubid = households[0].id;
                        updateHub(hub, oldhubId);
                    } else {
                        updateMultiSonos(sonoscount, households, hub);
                    }
                } else {
                    reject(errMsg);
                }
            })
            .catch(reason => {
                reject(reason);
            })

        // this branch is for ISY, New SmartThings and other hubs that don't need to get their name via a hub call
        } else {
            updateHub(hub, hub.hubid);
        }

        // this saves hubid in the user table and updates or adds the hub to the hub table
        function updateHub(hub, oldhubId) {
            mydb.updateRow("users",{defhub: hub.hubid},"id = " + userid)
            .then( () => {
                if ( DEBUG2 ) {
                    console.log( (ddbg()), "Ready to update or add hub: ", hub);
                }
                // update any hub with the same hubid attribute
                // if no such hub exists this will add it
                mydb.updateRow("hubs", hub, "userid = " + userid+" AND hubid = '"+oldhubId+"'")
                .then( row => {
                    hub.id = mydb.getId();
                    var autoid = row.getAutoIncrementValue();
                    if ( DEBUG2 ) {
                        console.log( (ddbg()), "updated hub with id: ", hub.id, " auto: ", autoid, " hub: ", hub, " row: , row");
                    }
                    return getDevices(hub);
                })
                .then(mydevices => {
                    resolve(mydevices);
                }).catch(reason => {
                    console.log( (ddbg()), reason);
                    reject(reason);
                });
            })
            .catch(reason => {
                console.log( (ddbg()), reason);
                reject(reason);
            });
        }

        function updateMultiSonos(numhubs, households, hub) {
            // function checkSonosDone(hubid) {
            //     nsonos ++;
            //     if ( nsonos >= sonoscount ) {
            //         mydb.updateRow("users",{defhub: hubid},"id = "+userid)
            //         .then( () => {
            //             resolve(mydevices);
            //         });
            //     }
            // }

        }

        function hubitatCallback(err, res, body) {
            var jsonbody;
            var hubName = hub.hubname;;
            var access_token = hub.hubaccess;
            var endpt = hub.hubendpt;
            var hubId = hub.hubid;
            var oldhubId = hubId;

            try {
                jsonbody = JSON.parse(body);
                hubName = jsonbody["sitename"];
                // the groovy hub info object uses hubId while other objects use hubid
                hubId = jsonbody["hubId"];
                if ( DEBUG2 ) {
                    console.log( (ddbg()), "hub info: ", hubName, hubId );
                }
                if ( !hubId || !hubName ) {
                    reject("hubName or hubId is not defined");
                    return;
                }
            } catch(e) {
                console.log( (ddbg()), "error retrieving hub ID and name. ", e, "\n body: ", body);
                hubName = hub.hubname
                hubId = hub.hubid;
                reject(e);
                return;
            }

            if ( DEBUG2 ) {
                console.log( (ddbg()), "hub info: access_token= ", access_token, " endpt= ", endpt, " hubName= ", hubName, " hubId= ", hubId);
            }
            
            // now update the placeholders with the real hub name and ID
            hub["hubname"]  = hubName;
            hub["hubid"] = hubId;
            updateHub(hub, oldhubId);

        }
    
    });
    return promise;
}

// rewrote to return a promise so we can send directly to the auth page
function getAccessToken(userid, code, hub) {
    
    var promise = new Promise( function(resolve, reject) {

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

        // Hubitat functions to get accesstoken and endpoint
        if ( hubType === "Hubitat" ) {
            tokenhost = hubHost + "/oauth/token";
            var nvpreq = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
            "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};
            if ( DEBUG2 ) {
                console.log( (ddbg()), "Hubitat calling with nvpreq: ", nvpreq);
            }
            curl_call(tokenhost, header, nvpreq, false, "POST", tokenCallback);

        // Ford and Lincoln tokens
        } else if ( hubType === "Ford" || hubType === "Lincoln" ) {
            endpt = "https://api.mps.ford.com/api/fordconnect/vehicles/v1";
            var policy = "B2C_1A_signup_signin_common";
            if ( hub.hubtype==="Lincoln" ) {
                policy = policy + "_Lincoln";
            }

            // we now always assume clientId and clientSecret are already encoded
            var tokenhost = "https://dah2vb2cprod.b2clogin.com/" + GLB.dbinfo.fordapicode + "/oauth2/v2.0/token";
            var nvpreq = "p=" + policy;
            var formData = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
                            "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};

            if ( DEBUG2 ) {
                console.log( (ddbg()), "clientId: ", clientId," clientSecret: ", clientSecret, "tokenhost: ", tokenhost, " nvpreq: ", nvpreq, " formData: ", formData);
            }
            curl_call(tokenhost+"?"+nvpreq, header, false, formData, "POST", fordCallback);

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
            if ( DEBUG19 ) {
                console.log( (ddbg()), "NewSmartThings - clientId: ", clientId," clientSecret: ", clientSecret, "tokenhost: ", tokenhost, " nvpreq: ", nvpreq);
            }
            _curl(tokenhost, header, nvpreq, "POST")
            .then( body => {
                newTokenCallback(body);
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
                pushClient(userid, "reload", "auth", "/userauth");
                return;
            });

        // get token for Sonos cloud account using basic auth method
        } else if ( hubType === "Sonos" ) {
            tokenhost = hubHost + "/login/v3/oauth/access";
            var idsecret = clientId + ":" + clientSecret;
            var buff = Buffer.from(idsecret);
            var base64 = buff.toString('base64');
            header = {"Content-Type" : "application/x-www-form-urlencoded;charset=utf-8",
                    "Authorization": "Basic " + base64};
            var formData = {"grant_type": "authorization_code", "code": code, "redirect_uri": encodeURI(redirect)};
            // var nvpreq = "grant_type=authorization_code&code=" + code + "&redirect_uri=" + encodeURI(redirect);
            if ( DEBUG2 ) {
                console.log( (ddbg()), "clientId: ", clientId," clientSecret: ", clientSecret," base64: ", base64);
                console.log( (ddbg()), "tokenhost: ", tokenhost, " nvpreq: ", nvpreq, " formData: ", formData);
            }
            curl_call(tokenhost, header, false, formData, "POST", tokenCallback);

        // Any other types of hubs assume a Hubitat style flow for accesstoken and endpoint
        } else {
            tokenhost = hubHost + "/oauth/token";
            var nvpreq = {"grant_type": "authorization_code", "code": code, "client_id": clientId, 
                        "client_secret": clientSecret, "redirect_uri": encodeURI(redirect)};
            if ( DEBUG2 ) {
                console.log( (ddbg()), "processing unknown hub type:", hubType, ", calling with nvpreq: ", nvpreq);
            }
            curl_call(tokenhost, header, nvpreq, false, "POST", tokenCallback);
        }

        function tokenCallback(err, res, body) {
            var hubType = hub.hubtype;
            // save the access_token
            try {
                var jsonbody = JSON.parse(body);
            } catch(e) {
                jsonbody = null;
            }
            if ( DEBUG2 ) {
                console.log( (ddbg()), " access_token return body: ", body," jsonbody:", jsonbody);
            }

            if ( (err && err!==200) || !jsonbody ) {
                console.log( (ddbg()), "error authorizing hub ", hubType, " error: ", err);
                reject("error authorizing hub " + hubType);                
                // pushClient(userid, "reload", "auth", "/reauth");
                return;

            } else if ( jsonbody && jsonbody["access_token"] ) {
                access_token = jsonbody["access_token"];
                refresh_token = "";
                if ( jsonbody["refresh_token"] ) {
                    refresh_token = jsonbody["refresh_token"];
                }
                if (access_token) {
                    var ephost;
                    hub.hubaccess = access_token;
                    hub.hubrefresh = refresh_token;
                    hub.hubtype = hubType;
                    if ( !hub.hubname ) {
                        hub.hubname = hubType;
                    }
                    if ( hubType === "Hubitat" ) {
                        header = {"Authorization": "Bearer " + access_token};
                        ephost = hubHost + "/apps/api/endpoints";
                        curl_call(ephost, header, false, false, "GET", endptCallback);
                    } else if ( hubType === "Sonos" ) {
                        hub.hubendpt = "https://api.ws.sonos.com/control/api";

                        var expiresin = jsonbody["expires_in"];
                        expiresin = (parseInt(expiresin) - 3600) * 1000;
                        hub.hubtimer = expiresin.toString();

                        // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
                        if ( expiresin ) {
                            setTimeout( function() {
                                refreshSonosToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, true);
                            }, expiresin);
                        }
                        // assign random hub id and save our info
                        return getHubInfo(hub)
                        .then(mydevices => {
                            resolve(mydevices);
                        }). catch(reason => { 
                            reject(reason);
                        });

                    } else {
                        console.log( (ddbg()), "Invalid hub type: ", hubType, " in access_token request call");
                        reject("Invalid hub type: " + hubType + " in access_token request call");
                    }

                }
            } else {
                console.log( (ddbg()), "Unknown error authorizing hub: ", hubName, " error: ", err, " body: ", body);
                reject("Unknown error authorizing hub: " + hubName);
            }
        }

        function newTokenCallback(body) {
            try {
                var jsonbody = JSON.parse(body);
            } catch(e) {
                jsonbody = null;
            }

            if ( DEBUG2 ) {
                console.log( (ddbg()),"newTokenCallback: New SmartThings jsonbody: ", jsonbody);
            }
            
            if ( !jsonbody ) {
                console.log( (ddbg()), "error authorizing ", hubType, " error: ", err);
                reject("invalide body in tokenCallback");
                return;
            }

            access_token = jsonbody["access_token"];
            refresh_token = jsonbody["refresh_token"];
            hub.hubendpt = hubHost;
            hub.hubaccess = access_token;
            hub.hubrefresh = refresh_token;
            hub.hubtype = hubType;
            if ( !hub.hubname ) {
                hub.hubname = hubType;
            }

            // we can safely ignore the legacy device_id field
            hub.hubid = jsonbody["installed_app_id"];
            var expiresin = jsonbody["expires_in"];

            // convert refresh token from seconds to msec and two minutes before expiration
            expiresin = (parseInt(expiresin) - 3600) * 1000;
            hub.hubtimer = expiresin.toString();

            if ( DEBUG2 ) {
                console.log( (ddbg()),"newTokenCallback: New SmartThings access_token: ", access_token, " refresh_token: ", refresh_token, 
                                    " endpoint: ", endpt, " expiresin: ", expiresin);
            }

            // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
            if ( expiresin ) {
                setTimeout( function() {
                    refreshSTToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, true, null);
                }, expiresin);
            }

            // register the sinks to cause events to come back to me
            newSTRegisterEvents(hub);

            // save our info - could skip this and save options and reload screen
            getHubInfo(hub);
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
                hub.hubaccess = access_token;
                hub.hubrefresh = refresh_token;
                hub.hubendpt = endpt;

                if ( DEBUG2 ) {
                    console.log( (ddbg()),"Ford access_token: ", access_token, " refresh_token: ", refresh_token, " endpoint: ", endpt);
                }

                // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
                if ( expiresin ) {
                    setTimeout( function() {
                        console.log( (ddbg()), "Ford access_token will be refreshed in ", expiresin," msec");
                        refreshFordToken(userid, hub, true);
                    }, expiresin);
                }

                // note - for Ford API the hubId must be provided by the user and match the Ford App ID assigned to them
                getHubInfo(hub)
                .then(mydevices => {
                    resolve(mydevices);
                }) .catch(reason => { reject(reason); });

            } else {
                var errMsg = "fordCallback error authorizing hub, access_token: " + access_token +", endpt: " + endpt + ", refresh: " + refresh_token;
                console.log( (ddbg()), errMsg, "\n body: ", body);
                reject(errMsg);
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

            // get all existing sinks and delete them and re-register new sink for this hub
            // check for a prior registration tied to our sink and this hub
            _curl(host, header, null, "GET", function(err, body) {
                if (err && err !== 200) { 
                    console.log((ddbg()), "error - attempting to check for previously registered sink events: ", err);
                    regNewFilter();                    
                } else {
                    var jsonsink = JSON.parse(body);
                    if ( jsonsink.items && is_array(jsonsink.items) && jsonsink.items.length ) {
                        var numsinks = jsonsink.items.length;
                        var num = 0;
                        for (var i in jsonsink.items) {
                            var sink = jsonsink.items[i];
                            if ( sink.filterName === filterName ) {
                                var delhost = host + "/" + sink.sinkFilterId;
                                _curl(delhost, header, null, "DELETE")
                                .then( () => {
                                    num++;
                                    if ( num >= numsinks ) {
                                        regNewFilter();
                                    }
                                });
                            } else {
                                num++;
                                if ( num >= numsinks ) {
                                    regNewFilter();
                                }
                            }
                        }
                    } else {
                        regNewFilter();                    
                    }
                }
            });

            function regNewFilter() {

                // gather all the capability events as groups
                // for now just get a few categories to limit things
                var qitem1 = [
                    {"field": "eventType", "value": "DEVICE_EVENT", "operator": "EQ"},
                    {"field": "deviceEvent.capability", "value": GLB.trigger1, "operator": "IN"},
                    {"field": "deviceEvent.stateChange", "value": true, "operator": "EQ"}
                ];
                var qitem2 = [
                    {"field": "eventType", "value": "DEVICE_EVENT", "operator": "EQ"},
                    {"field": "deviceEvent.capability", "value": GLB.trigger2, "operator": "IN"},
                    {"field": "deviceEvent.stateChange", "value": true, "operator": "EQ"}
                ];
                // don't require mode change for buttons
                var qitembutton = [
                    {"field": "eventType", "value": "DEVICE_EVENT", "operator": "EQ"},
                    {"field": "deviceEvent.capability", "value": "button", "operator": "EQ"}
                ];
                // register for mode changes
                var qitemmode = [
                    {"field": "eventType", "value": "MODE_EVENT", "operator": "EQ"}
                ];
                var qgroups = [
                    {queryItems: qitem1}, 
                    {queryItems: qitem2},
                    {queryItems: qitembutton},
                    {queryItems: qitemmode}
                ];

                // set up event sinks for the new ST app
                // this uses the sink provided by ST staff
                var sinkdata = {
                    filterName: filterName,
                    forEntity: { entityType: "INSTALLEDAPP", entityId: hub.hubid},
                    sink: GLB.dbinfo["st_sinkalias"],
                    query: {queryGroups: qgroups}
                };

                header = {
                    "Authorization": "Bearer " + hub.hubaccess,
                    "Content-Type": "application/json",
                    "Accept": "application/vnd.smartthings+json;v=20200812"
                };

                _curl(host, header, sinkdata, "POST", function(err, body) {
                    if ( err && err !== 200 ) {
                        // hub["sinkFilterId"] = "";
                        console.log((ddbg()), "error in registerEvents: ", err);
                    } else {
                        // save the filter ID for use in confirming events for this user
                        if ( DEBUG2 ) {
                            var jsonbody = JSON.parse(body);
                            console.log( (ddbg()), "registerEvents result: ", jsonshow(jsonbody) );
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
                    console.log( (ddbg()), "endpoint return: ", jsonshow(jsonbody));
                }
            } catch(e) {
                reject(e);
                return;
            }

            if ( err ) {
                console.log( (ddbg()), "getEndpoint error authorizing " + hub.hubtype + " hub.\n error: ", err, "\n JSON body: ", body);
                // pushClient(userid, "reload", "auth", "/reauth");
                reject(err);
                return;
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
                getHubInfo(hub)
                .then(mydevices => {
                    resolve(mydevices);
                }) .catch(reason => { reject(reason); });

            } else {
                var errMsg = "getEndpoint error authorizing " + hub.hubtype + " hub, either bad access_token: " + access_token + " or endpt: " + endpt;
                console.log( (ddbg()), errMsg);
                reject(errMsg);
                // pushClient(userid, "reload", "auth", "/reauth");
            }
        }

    });
    
    return promise;

}

function refreshSTToken(userid, hub, refresh_token, clientId, clientSecret, refresh, postCallback) {
    // var nohttp = hub.hubhost.substr(8);
    var nohttp = "api.smartthings.com";
    var header = {'Content-Type' : "application/x-www-form-urlencoded"};
    var tokenhost = "https://" + clientId + ":" + clientSecret + "@" + nohttp + "/oauth/token";
    var nvpreq = "grant_type=refresh_token" + "&client_id=" + clientId + 
                "&refresh_token=" + refresh_token;
    if ( DEBUG2 ) {
        console.log( (ddbg()), "Refreshing ST token via call with nvpreq: ", nvpreq);
    }

    _curl(tokenhost, header, nvpreq, "POST", function(err, body) {
        if ( err && err !== 200 ) {
            console.log((ddbg()), "error - _curl call in refresh token: ", err);
            return;
        }

        try {
            var jsonbody = JSON.parse(body);
        } catch(e) {
            var errmsg = "error - attempting parsing JSON from refresh of new ST token";
            console.log( (ddbg()), errmsg, "\n", e, "\n body: ", body);
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
        mydb.updateRow("hubs", hub, "userid = "+userid+" AND hubid = '"+hub.hubid+"'")
        .then(result => {
            if ( !result ) {
                console.log( (ddbg()), "error - hub update to DB failed while trying to refresh new ST token");
                return;
            }

            // if we provided a callback to do something after hub updates, do it
            if ( postCallback && typeof postCallback === "function" ) {
                postCallback();
            }
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
            return;
        });

        // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
        if ( refresh && hub.hubtimer ) {
            setTimeout( function() {
                refreshSTToken(userid, hub, hub.hubrefresh, clientId, clientSecret, true, null);
            }, expiresin);
        }

    });

}

function refreshSonosToken(userid, hub, refresh_token, clientId, clientSecret, refresh) {
    var tokenhost = hub.hubhost + "/login/v3/oauth/access";
    var idsecret = clientId + ":" + clientSecret;
    var buff = Buffer.from(idsecret);
    var base64 = buff.toString('base64');
    var header = {"Content-Type" : "application/x-www-form-urlencoded",
                "Authorization": "Basic " + base64};
    var formData = {"grant_type": "refresh_token", "refresh_token": refresh_token};
    curl_call(tokenhost, header, "", formData, "POST", function(err, res, body) {
        
        if ( err && err !== 200 ) {
            console.log((ddbg()), "error - call to refresh token: ", err);
            return;
        }

        try {
            var jsonbody = JSON.parse(body);
        } catch(e) {
            var errmsg = "error - attempting parsing JSON from refresh of new ST token";
            console.log( (ddbg()), errmsg, "\n", e, "\n body: ", body);
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
            console.log( (ddbg()),"Sonos refresh results. access_token: ", hub.hubaccess, " refresh_token: ", hub.hubrefresh, " expiresin: ", expiresin, " jsonbody: ", jsonbody, " hub: ", hub);
        }

        // now update the hub info in our DB
        mydb.updateRow("hubs", hub, "userid = "+userid+" AND hubid = '"+hub.hubid+"'")
        .then(result => {
            if ( !result ) {
                console.log( (ddbg()), "error - hub update to DB failed while trying to refresh new Sonos token");
                return;
            }
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
        });

        // refresh the access_token using the refresh token and signal to repeat again inside itself if success before expiration
        if ( refresh && expiresin ) {
            setTimeout( function() {
                refreshSonosToken(userid, hub, hub.hubrefresh, clientId, clientSecret, true);
            }, expiresin);
        }

    });
}

function refreshFordToken(userid, hub, refresh) {

    var access_token = hub["hubaccess"];
    var endpt = hub["hubendpt"];
    var refresh_token = hub["hubrefresh"];
    var clientId = hub["clientid"];
    var clientSecret = hub["clientsecret"];

    var header = {'Content-Type' : "application/x-www-form-urlencoded"};
    var policy = "B2C_1A_signup_signin_common";
    if ( hub.hubtype==="Lincoln" ) {
        policy = policy + "_Lincoln";
    }
    var tokenhost = "https://dah2vb2cprod.b2clogin.com/" + GLB.dbinfo.fordapicode + "/oauth2/v2.0/token";
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

        if ( body ) {
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

                // schedule the next refresh
                if ( refresh && expiresin ) {
                    setTimeout( function() {
                        refreshFordToken(userid, hub, true);
                    }, expiresin);
                }
    
                // update hub in DB
                mydb.updateRow("hubs",hub,"userid = "+userid+" AND hubid = '"+hub.hubid+"'")
                .then( () => {
                    hub.id = mydb.getId();
                    return getDevices(hub);
                })
                .then(mydevices => {
                    // var devices = Object.values(mydevices);
                    // console.log( (ddbg()), "Ford token refreshed, devices: ", devices);
                    pushClient(userid,"reload","all","/");
                })
                .catch(reason => {
                    console.log( (ddbg()), reason );
                    // console.log( (ddbg()), "refresh token error for hub: ", hub.hubtype, " access_token: ", access_token, 
                    // "\n refresh_token: ", refresh_token, "\n expiresin: ", expiresin, "\n endpoint: ", endpt, "\n body: ", body);
                });
            }

            if ( DEBUG2 ) {
                console.log( (ddbg()),"Refresh return... access_token: ", access_token, 
                "\n refresh_token: ", refresh_token, "\n expiresin: ", expiresin, "\n endpoint: ", endpt, "\n body: ", body);
            }
        }
    });
}

function findGroup(player, allGroups) {
    var group = null;
    if ( allGroups ) {
        allGroups.forEach(agroup => {
            if ( agroup.playerIds.includes(player.id) ) {
                group = agroup;
            }
        });
    }
    return group;
}

// rewrote this to use a promise to return the actual array of devices
// or a reject with a message
function getDevices(hub) {

    if ( DEBUG1 ) {
        console.log( (ddbg()), "getDevices debug for hub: ", hub);
    }

    // the support functions below for reading devices will resolve or reject the promise returned to the caller
    var promise = new Promise( function(resolve, reject) {
        
        var hubindex = hub.id;
        var userid = hub.userid;
        var hubid = hub.hubid;
        var hubType = hub.hubtype;
        var hubAccess  = hub.hubaccess;
        var hubEndpt = hub.hubendpt;
        var clientId = hub.clientid;
        var clientSecret = hub.clientsecret;

        if ( !is_object(hub) ) {
            reject("error - hub object not provided to getDevices call");
            return;
        }

        if ( !hubid ) {
            console.log( (ddbg()), "error - hubid not found in DB. hub: ", hub);
            reject("error - hubid not proviced");
            // pushClient(userid, "reload", "all", reloadpath);
        } else if ( !hubAccess || !hubEndpt ) {
            console.log( (ddbg()), "error - hub has not been authorized. hub: ", hub);
            reject("error - hub has not been authorized");
            // pushClient(userid, "reload", "all", reloadpath);

        // retrieve all things from Hubitat
        } else if ( hubType==="Hubitat" ) {
            getGroovyDevices();

        // retrieve all things from new ST
        } else if ( hubType==="NewSmartThings") {
            getNewSmartDevices();

        // retrieve all things from ISY
        } else if ( hubType==="ISY" ) {
            getIsyDevices(hub);

        // retrieve all things from Ford of Lincoln
        } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
            getFordVehicles();

        } else if ( hubType==="Sonos" ) {
            getSonosDevices();

        } else {
            console.log( (ddbg()), "error - attempt to read an unknown hub type= ", hubType);
            reject("error - attempt to read an unknown hub type= " + hubType);
            // pushClient(userid, "reload", "all", reloadpath);
        }

        // Hubitat call to Groovy API
        function getGroovyDevices() {
            const errMsg = "error retrieving devices from this Hubitat hub";
            var stheader = {"Authorization": "Bearer " + hubAccess};
            var mydevices = {};
            var params = {client_secret: clientId,
                scope: "app",
                client_id: clientSecret};
            // _curl(hubEndpt + "/getallthings", stheader, params, "POST")
            curl_call(hubEndpt + "/getallthings", stheader, params, false, "POST", hubInfoCallback);
            return;

            // callback for loading Hubitat devices
            function hubInfoCallback(err, res, body) {
                try {
                    var jsonbody = JSON.parse(body);
                } catch (e) {
                    console.log( (ddbg()), "error translating devices. body: ", body, " error: ", e);
                    reject(errMsg);
                    return;
                }

                // configure returned array with the "id"
                if (jsonbody && is_array(jsonbody) ) {
                    var devicecnt = 0;
                    var numdevices = jsonbody.length;
                    var currentDevices = [];

                    // now add them one at a time until we have them all
                    jsonbody.forEach(function(content) {
                        var thetype = content["type"];
                        var deviceid = content["id"];
                        var sqldevid = "'" + deviceid + "'";
                        if ( !currentDevices.includes(sqldevid) ) {
                            currentDevices.push(sqldevid);
                        }
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
                        if ( pvalue["presence"]==="not present" ) {
                            pvalue["presence"] = "absent";
                        }

                        // remove ignored items from pvalue
                        for (var field in pvalue) {
                            if ( GLB.ignoredAttributes.includes(field) || field.startsWith("supportedWasher") ) {
                                delete pvalue[field];
                            }
                        }

                        // add counter and duration for things with switch, contact, presence, motion, or lock
                        if ( array_key_exists("switch",pvalue)  ||
                            array_key_exists("contact",pvalue) ||
                            array_key_exists("presence",pvalue) ||
                            array_key_exists("motion",pvalue) ||
                            array_key_exists("lock",pvalue) ) 
                        {
                            pvalue.count = "0";
                            pvalue.duration = "0.0";
                            pvalue.deltaT = 0;
                            if ( (array_key_exists("switch",pvalue) && pvalue.switch==="on") ||
                                (array_key_exists("contact",pvalue) && pvalue.contact==="open") ||
                                (array_key_exists("presence",pvalue) && pvalue.presence==="present") ||
                                (array_key_exists("motion",pvalue) && pvalue.motion==="active") ||
                                (array_key_exists("lock",pvalue) && pvalue.lock==="unlocked") 
                            ) {
                                var d = new Date();
                                pvalue.deltaT = d.getTime();                            
                            }
                        }

                        // handle audio and weather tiles
                        if ( thetype==="audio" || thetype==="sonos" || pvalue.audioTrackData ) {
                            pvalue = translateAudio(pvalue);
                        } else if ( thetype==="music" || pvalue.trackData ) {
                            pvalue = translateMusic(pvalue);
                        } else if ( thetype==="weather" ) {
                            var thisorigname = pvalue.name || "Weather";
                            pvalue = translateWeather(thisorigname, pvalue);
                        } else {
                            pvalue = translateObjects(pvalue);
                        }
                        var pvalstr = encodeURI2(pvalue);
                        var device = {userid: userid, hubid: hubindex, deviceid: deviceid, name: origname, 
                            devicetype: thetype, hint: hint, refresh: refresh, pvalue: pvalstr};
                        
                        // update the device in our db
                        mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+" AND devicetype = '"+thetype+"' AND deviceid = '"+deviceid+"'")
                        .then(resp => {

                            device.id = mydb.getId();
                            mydevices[deviceid] = device;
                            devicecnt++;

                            // check if this is our last one and return array of devices
                            if ( devicecnt >= numdevices ) {
                                resolve(mydevices);
                                removeDeadNodes(userid, hubindex, currentDevices)
                                .then(results => {
                                    if ( DEBUG2 ) {
                                        console.log( (ddbg()), results);
                                    }
                                })
                                .catch(reason => {
                                    console.log( (ddbg()), reason );
                                });
                            }                    
                        })
                        .catch( reason => {
                            console.log( (ddbg()), reason );
                        });
                    });

                } else {
                    // an error occurred with this hub
                    reject(errMsg);
                    // updateOptions(userid, reload, reloadpath, 0);
                }
            }
        }

        function getSonosDevices() {
            var mydevices = {};
            var header = {"Content-Type": "application/json",
                        "Authorization": "Bearer " + hubAccess,
                        "Content-Length": 0};

            var sonosPlayers;
            var sonosGroups;
            var namehost = hubEndpt + "/v1/households/" + hubid + "/groups";
            _curl(namehost, header, "", "GET") // function(err, body) {
            .then(body => {
                if ( body ) {
                    var jsonbody = JSON.parse(body);
                    if ( DEBUG2 ) {
                        console.log((ddbg()), "Sonos devices for house: ", hubid, " devices: ", jsonshow(jsonbody));
                    }
                    
                    sonosGroups = jsonbody.groups;
                    sonosPlayers = jsonbody.players;

                    if ( !sonosPlayers ) {
                        console.log( (ddbg()), "no Sonos devices found for Household: ", hubid);
                        resolve(mydevices);
                        return;
                    }

                    var devicecnt = 0;
                    var numdevices = sonosPlayers.length;
                    sonosPlayers.forEach(function(player) {
                        var pvalue = {
                            name: player.name,
                            "_previousTrack": "previousTrack", "_pause": "pause", "_play": "play", "_stop":"stop", "_nextTrack":"nextTrack",
                            "_unmute":"unmute", "_mute":"mute", "_volumeDown":"volumeDown","_volumeUp":"volumeUp","playbackStatus":"", "mute":"false", "volume":50,
                            wss: player.websocketUrl
                        };
                        var group = findGroup(player, sonosGroups);
                        if ( DEBUG2 ) {
                            console.log((ddbg()), "player: ", player," in group: ", group);
                        }

                        if ( group ) {

                            var jlast = group.playbackState.lastIndexOf("_");
                            if ( jlast !== -1 ) {
                                pvalue.playbackStatus = group.playbackState.substr(jlast+1).toLowerCase();
                            } else {
                                pvalue.playbackStatus = group.playbackState.toLowerCase();
                            }
                            if ( group.coordinatorId === player.id && group.playerIds.length===1 ) {
                                pvalue.grouped = "Not grouped";
                            } else if ( group.coordinatorId === player.id ) {
                                pvalue.grouped = "Primary in group " + group.name; // + " with " + group.playerIds.length + " other";
                                // group.playerIds.forEach( item => {
                                //     if ( item !== player.id ) {
                                //         pvalue.grouped += "<br>" + item; 
                            //         pvalue.grouped += "<br>" + item; 
                                //         pvalue.grouped += "<br>" + item; 
                                //     }
                                // });
                            } else {
                                pvalue.grouped = "Secondary in group " + group.name; // group.coordinatorId;
                                // group.playerIds.forEach( item => {
                                //     if ( item !== player.id && item !== group.coordinatorId ) {
                                //         pvalue.grouped += "<br>" + item; 
                            //         pvalue.grouped += "<br>" + item; 
                                //         pvalue.grouped += "<br>" + item; 
                                //     }
                                // });
                            }

                            // obtain the meta data of the device
                            namehost = hubEndpt + "/v1/groups/" + group.id + "/playbackMetadata";
                            _curl(namehost, header, "", "GET", function(err, metabody) {
                                if ( DEBUG2 ) {
                                    console.log((ddbg()), "Sonos metadata for: ", group, " metadata: ", jsonshow(metabody));
                                }
                                if ( (err && err!==200) || !metabody ) { return false; }
                                try {
                                    var metadata = JSON.parse(metabody);
                                } catch (e) {
                                    metadata = null;
                                }
                                var serviceUrl = "";
                                var albumUrl = "";
                                if ( metadata ) {
                                    if ( metadata.container && metadata.container.service ) {
                                        serviceUrl = metadata.container.imageUrl;
                                    }

                                    if ( metadata.currentItem && metadata.currentItem.track ) {
                                        pvalue.audioTrackData = {
                                            title: "", artist: "", album: "", mediaSource: ""
                                        };
                                        pvalue.audioTrackData.title = metadata.currentItem.track.name || "";
                                        if ( metadata.currentItem.track.artist ) {
                                            pvalue.audioTrackData.artist = metadata.currentItem.track.artist.name || "";
                                        }
                                        if ( metadata.currentItem.track.album ) {
                                            pvalue.audioTrackData.album = metadata.currentItem.track.album.name || "";
                                        }
                                        if ( metadata.currentItem.track.service ) {
                                            pvalue.audioTrackData.mediaSource = metadata.currentItem.track.service.name || "";
                                        }
                                        albumUrl = metadata.currentItem.track.imageUrl || "";

                                        // use the service URL if it is secure and the album art is not
                                        if ( albumUrl.startsWith("https://") ) {
                                            pvalue.audioTrackData.albumArtUrl = albumUrl;
                                        } else if ( serviceUrl.startsWith("https://") ) {
                                            pvalue.audioTrackData.albumArtUrl = serviceUrl;
                                        } else {
                                            pvalue.audioTrackData.albumArtUrl = GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png";
                                        }
                                    }
                                } else {
                                    pvalue.audioTrackData = {
                                        title: "",
                                        artist: "",
                                        album: "",
                                        mediaSource: "",
                                        albumArtUrl: GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png"
                                    };
                                }

                                // get the volume
                                namehost = hubEndpt + "/v1/groups/" + group.id + "/groupVolume";
                                _curl(namehost, header, "", "GET")
                                .then( body => {
                                    try {
                                        var groupVolume = JSON.parse(body);
                                        pvalue.mute = groupVolume.muted.toString();
                                        pvalue.volume = groupVolume.volume;
                                    } catch(e) {
                                        pvalue.mute = "false";
                                        pvalue.volume = 50;
                                    }
                                    var deviceid = player.id;
                                    pvalue = encodeURI2(pvalue);

                                    // note that we store the group id in the hint so we can use it later easily to control the player
                                    var rowdevice = {
                                        userid: userid, hubid: hubindex, deviceid: deviceid, name: player.name, 
                                        devicetype: "sonos", hint: group.id, refresh: "normal", pvalue: pvalue
                                    };
                                    devicecnt++;
                                    mydevices[deviceid] = rowdevice;
                                    // check if this is our last one
                                    if ( devicecnt >= numdevices ) {
                                        resolve(mydevices);
                                        if ( DEBUG2 ) {
                                            console.log( (ddbg()), "new Sonos devices for Household: ", hubid," devices: ", mydevices);
                                        }
                                    }
                                    mydb.updateRow("devices", rowdevice, "userid = "+userid+" AND hubid = "+hubindex+
                                                    " AND devicetype = 'sonos' AND deviceid = '"+deviceid+"'")
                                    .catch( reason => {
                                        console.log( (ddbg()), reason );
                                    });
            
                                });

                                // subscribe to volume for this player
                                var namehost = hubEndpt + "/v1/players/" + player.id + "/playerVolume/subscription";
                                _curl(namehost, header, "", "DELETE")
                                .then( () => {
                                    _curl(namehost, header, "", "POST");
                                });
            
                            });
                        } else {

                            pvalue = encodeURI2(pvalue);
                            var deviceid = player.id;
                            var rowdevice = {
                                userid: userid,
                                hubid: hubindex,
                                deviceid: deviceid,
                                name: player.name, 
                                devicetype: "sonos",
                                hint: "Sonos", 
                                refresh: "normal",
                                pvalue: pvalue
                            };

                            devicecnt++;
                            mydevices[deviceid] = rowdevice;
                            if ( devicecnt >= numdevices ) {
                                resolve(mydevices);
                                if ( DEBUG2 ) {
                                    console.log( (ddbg()), "new Sonos devices for Household: ", hubid," devices: ", mydevices);
                                }
                            }
                            mydb.updateRow("devices", rowdevice, "userid = "+userid+" AND hubid = "+hubindex+
                                           " AND devicetype = 'sonos' AND deviceid = '"+deviceid+"'")
                            .catch( reason => {
                                console.log( (ddbg()), reason );
                            });
                        }
                    });

                    // only do subscriptions if we are a secure site
                    if ( hubEndpt.startsWith("https") ) {
                        // subscribe to group changes
                        var namehost = hubEndpt + "/v1/households/" + hubid + "/groups/subscription";
                        _curl(namehost, header, "", "POST");

                        sonosGroups.forEach( group => {
                            var namehost = hubEndpt + "/v1/groups/" + group.id + "/playback/subscription";
                            _curl(namehost, header, "", "POST");
                            // });

                            var namehost = hubEndpt + "/v1/groups/" + group.id + "/playbackMetadata/subscription";
                            _curl(namehost, header, "", "POST");
                            // });
                        });
                    }

                } else {
                    console.log( (ddbg()), "error - ", err, " body: ", body);
                    reject("error reading Sonos devices from hub");
                }
            })
            .catch(reason => {
                console.log( (ddbg()), reason);
                reject(reason);
            });
        }

        // implement logic using new ST api
        function getNewSmartDevices() {
            var stheader = {"Authorization": "Bearer " + hubAccess};

            // first get all the devices
            var doneNewST = {};
            var currentDevices = [];
            var mydevices = {};
            for ( var swtype in GLB.capabilities ) {
                doneNewST[swtype] = false;
            }

            for ( var swtype in GLB.capabilities ) {
                var caparray = GLB.capabilities[swtype];

                // get the list of capabilities this device must have to show up
                // note this approach will 
            // note this approach will 
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
                        break;hubEndpt

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

                    case "location":
                        getLocation();
                        break;

                    default:
                        checkNewSTDone(swtype);
                        break;
                }

            }

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
                        console.log( (ddbg()), "finished reading all newST types. devices: ", mydevices);
                    }
                    resolve(mydevices);
                    removeDeadNodes(userid, hubindex, currentDevices)
                    .then(results => {
                        console.log( (ddbg()), results);
                    })
                    .catch(reason => {
                        console.log( (ddbg()), reason );
                    });
                    // updateOptions(userid, reload, reloadpath, 2000);
                }
            }

            function getLocation() {

                // now read the locations and make a device for each one
                _curl(hubEndpt + "/locations", stheader, null, "GET")
                .then(body => {
                    try {
                        var jsonbody = JSON.parse(body);
                        var locations = jsonbody.items;
                    } catch (e) {
                        console.log( (ddbg()), "error translating ST locations: ", body, " error: ", e);
                        reject("error translating ST locations");
                        locations = null;
                    }
                    if ( locations && is_array(locations) && locations.length ) {
                        var numlocations = locations.length;
                        var devicecnt = 0;
                        locations.forEach(location => {
                            var locationId = location.locationId;
                            var locationName = location.name;
                            var sqldevid = "'"+locationId+"'";
                            if ( !currentDevices.includes(sqldevid) ) {
                                currentDevices.push(sqldevid);
                            }

                            _curl(hubEndpt + "/locations/" + locationId, stheader, null, "GET")
                            .then(body => {
                                if ( body ) {
                                    var locvalue = JSON.parse(body);
                                    if ( locvalue.additionalProperties ) {
                                        delete locvalue.additionalProperties;
                                    }
                                    if ( locvalue.parent ) {
                                        locvalue.parentid = locvalue.parent.id;
                                        delete locvalue.parent;
                                    }
                                    if ( locvalue.locationId ) {
                                        delete locvalue.locationId;
                                    }
                                    if ( locvalue.backgroundImage ) {
                                        delete locvalue.backgroundImage;
                                    }
                                    locvalue["deviceType"] = "location";
                                } else {
                                    locvalue = null;
                                    devicecnt++;
                                    if ( devicecnt >= numlocations ) {
                                        checkNewSTDone("location");
                                    }
                                }
                                return locvalue;
                            })
                            .then( locvalue => {

                                if ( !locvalue ) { 
                                    throw "error translating ST locations";
                                }

                                // now get the modes
                                _curl(hubEndpt + "/locations/" + locationId + "/modes", stheader, null, "GET")
                                .then(body => {
                                    if ( body ) {
                                        var modevalue = JSON.parse(body);

                                        // we add two modes for each. One is the actual mode name with the ID attached
                                        // the other one is a command to set the mode to this value. The mode names with ID's should be hidden
                                        if ( modevalue.items && is_array(modevalue.items) ) {
                                            modevalue.items.forEach( modeobj => {
                                                var subid = modeobj.label;
                                                var cmdid = "_" + subid;
                                                locvalue[subid] = modeobj.id;
                                                locvalue[cmdid] = subid;
                                            })
                                        }
                                    }
                                })
                                .then( () => {

                                    _curl(hubEndpt + "/locations/" + locationId + "/modes/current", stheader, null, "GET")
                                    .then(body => {
                                        var themode = JSON.parse(body);
                                        if ( is_object(themode) ) {
                                            locvalue.themode = themode.label;
                                        }
                                        // add a counter
                                        // locvalue.count = "0";

                                        var pvalue = encodeURI2(locvalue);
                                        var rowdevice = {
                                            userid: userid,
                                            hubid: hubindex,
                                            deviceid: locationId,
                                            name: locationName, 
                                            devicetype: "location",
                                            hint: hubType, 
                                            refresh: "never",
                                            pvalue: pvalue
                                        };
                                        mydb.updateRow("devices", rowdevice, "userid = "+userid+" AND hubid = "+hubindex+
                                                       " AND devicetype = 'location' AND deviceid = '"+locationId+"'")
                                        .then( result => {
                                            if ( !result ) throw "location device not updated or added";
                                            rowdevice.id = result.getAutoIncrementValue();
                                            mydevices[locationId] = rowdevice;
                                            devicecnt++;
                                            if ( devicecnt >= numlocations ) {
                                                checkNewSTDone("location");
                                            }
                                        })
                                        .catch( reason => {
                                            devicecnt++;
                                            if ( devicecnt >= numlocations ) {
                                                checkNewSTDone("location");
                                            }
                                            console.log( (ddbg()), reason );
                                        });
                                    });
                                });
                            })
                            .catch(reason => {
                                console.log( (ddbg()), "error translating ST locations: ", reason);
                                reject("error translating ST locations");
                            });
                        });
                    }
                })
                .catch(reason => {
                    console.log( (ddbg()), "error translating ST locations: ", reason);
                    reject("error translating ST locations");
                });
            }

            function newSTCallback(swtype, userid, hubindex, err, res, body) {
                try {
                    var jsonbody = JSON.parse(body);
                } catch (e) {
                    console.log( (ddbg()), "error translating devices of type: ", swtype, " error: ", e, " body: ", body);
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

                    // get the health status
                    _curl(hubEndpt + "/devices/" + deviceid+"/health", stheader, null, "GET")
                    .then(body => {
                        if ( body ) {
                            try {
                                var healthStatus = JSON.parse(body);
                                pvalue["status"] = healthStatus.state;
                            } catch(e) {
                                pvalue["status"] = "OFFLINE";
                            }
                        }

                        // now get the device details
                        // curl_call(hubEndpt + "/devices/" + device.deviceId+"/status", stheader, params, false, "GET", function(err, res, bodyStatus) {
                        _curl(hubEndpt + "/devices/" + deviceid+"/status", stheader, null, "GET", function(err, bodyStatus) {

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
                                        // if ( swtype==="other" || swtype==="actuator" || cap==="battery" || capabilitiesList.includes(cap) || true ) {

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
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                    }
                                }
                            }

                            // add color attribute if hsl is there
                            if ( array_key_exists("hue", pvalue) && array_key_exists("saturation",pvalue) && array_key_exists("level",pvalue) ) {
                                var h = Math.round((parseInt(pvalue["hue"]) * 360) / 100);
                                var s = Math.round(parseInt(pvalue["saturation"]));
                                var v = Math.round(parseInt(pvalue["level"]));
                                pvalue["color"] = hsv2rgb(h, s, v);
                            }

                            // add counter and duration for things with switch, contact, presence, motion, or lock
                            if ( array_key_exists("switch",pvalue)  ||
                            array_key_exists("contact",pvalue) ||
                            array_key_exists("presence",pvalue) ||
                            array_key_exists("motion",pvalue) ||
                            array_key_exists("lock",pvalue) ) 
                            {
                                pvalue.count = "0";
                                pvalue.duration = "0.0";
                                pvalue.deltaT = 0;
                                if ( (array_key_exists("switch",pvalue) && pvalue.switch==="on") ||
                                    (array_key_exists("contact",pvalue) && pvalue.contact==="open") ||
                                    (array_key_exists("presence",pvalue) && pvalue.presence==="present") ||
                                    (array_key_exists("motion",pvalue) && pvalue.motion==="active") ||
                                    (array_key_exists("lock",pvalue) && pvalue.lock==="unlocked") 
                                ) {
                                    var d = new Date();
                                    pvalue.deltaT = d.getTime();                            
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
                                    albumArtUrl: GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png",
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
                            pvalue = encodeURI2(pvalue);
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

                            var sqldevid = "'"+deviceid+"'";
                            if ( !currentDevices.includes(sqldevid) ) {
                                currentDevices.push(sqldevid);
                            }

                            mydb.updateRow("devices", rowdevice, "userid = "+userid+" AND hubid = "+hubindex+
                                " AND devicetype = '"+swtype+"' AND deviceid = '"+deviceid+"'")
                            .then( result => {
                                rowdevice.id = result.getAutoIncrementValue();
                                mydevices[deviceid] = rowdevice;
                                devicecnt++;
    
                                // check if this is our last one
                                if ( devicecnt >= numdevices ) {
                                    if ( DEBUG20 ) {
                                        console.log( (ddbg()), "new ST numdevices = ", numdevices," devices: ", mydevices);
                                    }
                                    checkNewSTDone(swtype);
                                }
                            })
                            .catch( reason => {
                                console.log( (ddbg()), reason );
                            });
        
                            
                        });  // end of this device node detail curl callback

                    }); // end of health check

                }); // end of all devices of this type

            }  // end of newSTCallback

        } // end of new ST 
        
        // remove tiles and devices that are no longer on the hub
        function removeDeadNodes(userid, hubindex, currentDevices) {
            var result = removeDeadTiles(userid, hubindex, currentDevices)
            .then( numtiles => {
                var indev = "(" + currentDevices.join(",") + ")";
                return mydb.deleteRow("devices","userid = "+userid+" AND hubid = "+hubindex+" AND deviceid NOT IN " + indev)
                .then( results => {
                    var numdevices = results.getAffectedItemsCount();
                    return "Removed " + numdevices + " devices and " + numtiles + " tiles";
                })
                .catch(reason => {
                    console.log( (ddbg()), reason, "\nsqlstr: ", mydb.getRequest() );
                    return "Removed " + 0 + " devices and " + numtiles + " tiles";
                });
            })
            .catch(reason => {
                console.log( (ddbg()), reason, "\nsqlstr: ", mydb.getRequest() );
                return "No devices and no tiles removed";
            });
            return result;
        }

        // remove dead tiles
        function removeDeadTiles(userid, hubindex, currentDevices) {

            // go through all tiles and remove those that don't have devices
            var joinstr = mydb.getJoinStr("things","tileid","devices","id");
            return mydb.getRows("things","things.id as things_id, devices.deviceid as devices_deviceid, devices.hubid as devices_hubid",
                                "things.userid = "+userid+" AND devices.hubid = "+hubindex,joinstr)
            .then(things => {
                if ( !things ) return 0;
                var numremoved = 0;
                things.forEach(thing => {
                    var devstr = "'"+thing["devices_deviceid"]+"'";
                    if ( !currentDevices.includes(devstr) ) {
                        numremoved++
                        mydb.deleteRow("things","id = " + thing["things_id"]);
                    }
                });
                return numremoved;
            })
            .catch(reason => {
                console.log( (ddbg()), reason );
                return 0;
            });
        }

        function getFordVehicles() {

            // now we call vehicle information query to get vehicle ID
            // API version is a defined constant at front of code
            var mydevices = {};
            var header = {
                "Authorization": "Bearer " + hubAccess,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-version": FORDAPIVERSION,
                "Application-Id": hub.hubid,
            };
            var endpt = hub.hubendpt;
            curl_call(endpt, header, false, false, "GET", vehicleInfoCallback);

            function vehicleInfoCallback(err, res, body) {

                try {
                    var jsonbody = JSON.parse(body);
                } catch(e) {
                    console.log( (ddbg()), e, " body: ", body);

                    reject("Problem loading vehicle info for Ford or Lincoln");
                    // pushClient(userid, "reload", "all", reloadpath);
                    return;
                }
                var thetype = "ford";
                var devicecnt = 0;

                if ( jsonbody && jsonbody.status === "SUCCESS" && array_key_exists("vehicles", jsonbody) && is_array(jsonbody.vehicles) ) {
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

                        var pvalstr = encodeURI2(pvalue);
                        var device = {userid: userid, hubid: hubindex, deviceid: vehicleid, name: vehiclename, 
                            devicetype: thetype, hint: hubType, refresh: "normal", pvalue: pvalstr};
                        mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+
                                                        " AND devicetype = '"+thetype+"' AND deviceid = '"+vehicleid+"'")
                        .then(result => {
                            devicecnt++;

                            // check if this is our last one
                            if ( devicecnt >= numdevices ) {
                                updateOptions(userid, reload, reloadpath, 2000);
                            }
                        }).catch(reason => {
                            console.log( (ddbg()), reason);
                        });

                    });
                } else {
                    updateOptions(userid, false, reloadpath, 0);
                }
            }
        }

        // function for loading ISY hub devices
        function getIsyDevices(hub) {

            var hubindex = hub.id;
            var userid = hub.userid;
            var hubAccess  = hub.hubaccess;
            var hubEndpt = hub.hubendpt;
        
            const errMsg = "error retrieving devices from ISY hub with accessToken = " + hubAccess;
            var buff = Buffer.from(hubAccess);
            var base64 = buff.toString('base64');
            var stheader = {"Authorization": "Basic " + base64};
            var thetype = "isy";
            // var vardefs = {};
    
            // use this object to keep track of which things are done
            var done = {"Int" : false, "State" : false, "Int_defs" : false, "State_defs" : false, "variables" : false, "programs" : false, "nodes" : false, "states": false };
    
            // now read in any int and state variables and their definitions
            var mydevices = {};
            var variables = {name: "ISY Variables", "status_": "INACTIVE"};

            curl_call(hubEndpt + "/vars/definitions/1", stheader, false, false, "GET", getIntVarsDef);
            curl_call(hubEndpt + "/vars/definitions/2", stheader, false, false, "GET", getStateVarsDef);
            curl_call(hubEndpt + "/vars/get/1", stheader, false, false, "GET", getIntVars);
            curl_call(hubEndpt + "/vars/get/2", stheader, false, false, "GET", getStateVars);
            curl_call(hubEndpt + "/programs?subfolders=true", stheader, false, false, "GET", getAllProgs);
            curl_call(hubEndpt + "/nodes", stheader, false, false, "GET", getAllNodes);

            // cool sort function to put variable names in front of values and precision after values
            function sortVariables(variables) {
                var keys = Object.keys(variables);
                var newkeys = keys.sort( 
                    function test(a, b) {
                        
                        var compa;
                        var compb;
                       
                        if ( a==="name" ) {
                            compa = "1";
                        } else if ( a==="status_" ) {
                            compa = "2";
                        } else if ( a.startsWith("def_" ) ) {
                            compa = a.substring(4)+"_A";
                        } else if ( a.startsWith("prec_") ) {
                            compa = a.substring(5)+"_C";
                        } else {
                            compa = a+"_B";
                        }

                        if ( b==="name" ) {
                            compb = "1";
                        } else if ( b==="status_" ) {
                            compb = "2";
                        } else if ( b.startsWith("def_" ) ) {
                            compb = b.substring(4)+"_A";
                        } else if ( b.startsWith("prec_") ) {
                            compb = b.substring(5)+"_C";
                        } else {
                            compb = b+"_B";
                        }

                        if ( compa===compb ) { return 0; }
                        else if ( compa > compb ) { return 1; }
                        else { return -1; }
                    }
                );
                var sortedVariables = {};
                newkeys.forEach(key => {
                    sortedVariables[key] = variables[key];
                })
                return sortedVariables;
            }
                
            function checkDone( stage ) {
                if ( stage ) {
                    done[ stage ] = true;
                } else {
                    return ( done["variables"] && done["programs"] && done["nodes"] && done["states"] );
                }

                if ( !done["variables"] && done["Int"] && done["State"] && done["Int_defs"] && done["State_defs"] ) {
                    // Now that we have all the isy variables and names, create a mapping of ids to names
                    // set all the alias values here so that updates can use alias names
                    // variables["alias"] = vardefs;

                    // sort variables so names show up in front of variable values
                    variables = sortVariables(variables);
                    var pvalstr = encodeURI2(variables);
                    var device = {userid: userid, hubid: hubindex, deviceid: "vars", name: variables.name, 
                                  devicetype: thetype, hint: "ISY_variable", refresh: "never", pvalue: pvalstr};
                                  
                    mydevices["vars"] = device;
                    mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid = 'vars'")
                    .then( () => {
                        done["variables"] = true;
                    })
                    .catch( reason => {
                        console.log( (ddbg()), reason );
                        done["variables"] = true;
                    });
                }

                if ( !done["states"] && stage==="nodes" ) {
                    curl_call(hubEndpt + "/status", stheader, false, false, "GET", callbackStatusInfo);
                    return false;
                }

                if ( DEBUGisy ) {
                    console.log( (ddbg()), "done stage: ", stage, " done: ", done);
                }
                if ( done["variables"] && done["programs"] && done["nodes"] && done["states"] ) {
                    resolve(mydevices);
                    return true;
                } else {
                    return false;
                }
            }

            function getIntVarsDef(err, res, body) {
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
            
            async function getISY_Defs( body, vartype ) {
                // console.log("ISY Defs body: ", body);
                await xml2js(body, function(err, result) {
                    try {
                        var varobj = result.CList.e;
                    } catch(e) {
                        checkDone(vartype + "_defs");
                        return;
                    }
                    if ( !is_object(varobj) ) {
                        checkDone(vartype + "_defs");
                        return;
                    }
                    if (DEBUGisy && result) {
                        console.log( (ddbg()), vartype + " variables defs: ", UTIL.inspect(result, false, null, false) );
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
                            // varname = varname.replace(/ /g,"_");
                        } catch (e) {
                            varid = 0;
                            varname = "";
                        }
                        if ( varid > 0 ) {
                            variables["def_"+defname+varid] = varname;
                            // vardefs[defname+varid] = varname;
                        }
                    });
                    checkDone(vartype + "_defs");
                });
            }
               
            async function getISY_Vars(body, vartype) {
                // console.log("ISY Vars body: ", body);
                const vartypes = ["", "Int", "State"];    
                await xml2js(body, function(err, result) {
                    if ( !result ) {
                        checkDone(vartype);
                        return;
                    }

                    var varobj = result.vars.var;
                    if ( !is_object(varobj) ) {
                        checkDone(vartype);
                        return;
                    }

                    if (DEBUGisy && result) {
                        console.log( (ddbg()), vartype, body, "variables: ", UTIL.inspect(result, false, null, false) );
                    }
    
                    // convert single variable object into an array of variable objects
                    if ( !is_array(varobj) ) {
                        varobj = [varobj];
                    }
                        
                    varobj.forEach(function( obj) {
                        try {
                            var varid = obj["$"]["id"];
                            var vartypeid = parseInt(obj["$"]["type"]);
                            if ( vartypeid > 2 ) { vartypeid = 0; }
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
                            variables["status_"] = "ACTIVE";
                            variables[vartype+"_"+varid] = val10.toString();
                            variables["prec_"+vartype+"_"+varid] = prec.toString();
                        }
                    });
                    
                    if ( DEBUGisy ) {
                        console.log( (ddbg()), "New variable value: ", variables);
                    }
                    checkDone(vartype);
                });
    
            }
    
            // get programs and setup program tiles much like how Piston tiles are done in ST and HE
            async function getAllProgs(err, res, body) {
                if ( err ) {
                    console.log( (ddbg()), "error retrieving ISY Programs. Error: ", err);
                    checkDone("programs");
                    return;
                }

                // console.log("ISY Progs body: ", body);
                // have to use the full parsing function here
                await xml2js(body, function(xmlerr, result) {
                    var thetype = "isy";
                    if ( !result ) {
                        checkDone("programs");
                        return;
                    }
                
                    var programlist = result.programs.program;
                    if ( !is_object(programlist) ) {
                        checkDone("programs");
                        return;
                    }
                    if ( DEBUGisy && result ) {
                        console.log( (ddbg()), "xml2js programs: ", UTIL.inspect(result, false, null, false) );
                    }

                    // // convert single variable object into an array of variable objects
                    if ( !is_array(programlist) ) {
                        programlist = [programlist];
                    }

                    // now lets get all the master program nodes
                    // and create a tile for any program that is not a folder
                    // TODO: recurse into folders and get programs there too
                    var pvalue;
                    var nprogs = programlist.length;
                    var n = 0;
                    programlist.forEach(function(prog) {
                        n++;
                        var proginfo = prog["$"];
                        var isfolder = proginfo.folder;
                        // if we have a folder don't add it
                        if ( isfolder==="true" ) {
                            if ( DEBUGisy ) {
                                console.log( (ddbg()), "Program ", prog.name, " is a folder. id: ", proginfo.id, " Status: ", proginfo.status);
                            }
                            if ( n >= nprogs ) {
                                checkDone("programs");
                            }
                        // create tile for programs that are not folders
                        } else {
                            if ( DEBUGisy ) {
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
                            // map true to green dot of active - the websocket updates this
                            pvalue["status_"] = proginfo.status === "true" ? "ACTIVE" : "INACTIVE";

                            // get the enabled and runat states
                            pvalue.enabled  = proginfo.enabled;
                            pvalue.runAtStartup = proginfo.runAtStartup;
                            var pvalstr = encodeURI2(pvalue);

                            var device = {userid: userid, hubid: hubindex, deviceid: progid, name: progname, 
                                            devicetype: thetype, hint: "ISY_program", refresh: "never", pvalue: pvalstr};
                            mydevices[progid] = device;
                            mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid = '" + progid + "'")
                            .then( res => {
                                console.log("prog update: ", res);
                                if ( n >= nprogs ) {
                                    checkDone("programs");
                                }
                            })
                            .catch(reason => {
                                console.log( (ddbg()), reason);
                                checkDone("programs");
                            });
                        }
                    });
                    if ( nprogs === 0 ) checkDone("programs");
                });
    
            }
    
            function getAllNodes(err, res, body) {
                if ( err ) {
                    console.log( (ddbg()), "error retrieving ISY Nodes. Error: ", err);
                    checkDone("nodes");
                    return;
                }
                
                // console.log("ISY Nodes body: ", body);
                const thetype = "isy";
                xml2js(body, function(xmlerr, result) {
                    if ( !result ) {
                        checkDone("nodes");
                        return;
                    }
                
                    var thenodes = result.nodes["node"];
                    var groups = result.nodes["group"];
                    var numnodes = thenodes.length + groups.length;
                    var n = 0;
                    if ( !is_object(thenodes) ) {
                        checkDone("nodes");
                        return;
                    }

                    if ( DEBUGisy && result ) {
                        console.log( (ddbg()), "xml2js nodes: ", UTIL.inspect(result, false, null, false) );
                    }

                    for ( var obj in thenodes ) {
                        var node = thenodes[obj];
                        var id = fixISYid(node["address"][0].toString());
                        var hint = node["type"][0].toString();
    
                        // set hint to nothing if default of zeros is provided
                        // TODO - provide a more useful mapping of hints to type names
                        // until then user can still style hints using CSS
                        if ( hint ) {
                            hint.replace( /\./g, "_" );
                            hint = "ISY " + hint;
                        }
    
                        var name = node["name"][0] || "Node";
                        var pvalue = {"name": name};

                        const ignoreNodes = ["$","address","name","family","type","pnode"];
                        for (var nodeitem in node) {
                            if ( !ignoreNodes.includes(nodeitem) ) {
                                pvalue[nodeitem] = node[nodeitem][0].toString();
                            }
                        }

                        var pvalstr = encodeURI2(pvalue);
    
                        // set bare minimum info
                        // this is updated below in the callback after getting node details
                        var device = {userid: userid, hubid: hubindex, deviceid: id, name: name, 
                            devicetype: thetype, hint: hint, refresh: "never", pvalue: pvalstr};
                        mydevices[id] = device;
                        mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid = '" + id + "'")
                        .then(res => {
                            n++;
                            if ( n >= numnodes ) {
                                checkDone("nodes");
                            }
                        })
                        .catch(reason => {
                            console.log( (ddbg()), reason);
                        });
                    }

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
                        var pvalstr = encodeURI2(pvalue);
                        var device = {userid: userid, hubid: hubindex, deviceid: id, name: name, 
                                      devicetype: thetype, hint: hint, refresh: "never", pvalue: pvalstr};
                        mydevices[id] = device;
                        mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid = '" + id + "'")
                        .then(res => {
                            n++;
                            if ( n >= numnodes ) {
                                checkDone("nodes");
                            }
                        });
                    }                    
                });
            }
            
            function callbackStatusInfo(err, res, body) {
                xml2js(body, function(xmlerr, result) {
                    try {
                        if ( DEBUGisy ) {
                            console.log( (ddbg()), "node details: ", UTIL.inspect(result, false, null, false) );
                        }
                        if ( !result || !result.nodes ) {
                            checkDone("states");
                            return;
                        }
                        var nodes = result.nodes.node;
                        var numnodes = nodes ? nodes.length : 0;
                        if ( numnodes ) {
                            var n = 0;
                            nodes.forEach(function(node) {
                                var nodeid = fixISYid(node["$"]["id"]);

                                var props = node["property"];
                                if ( props && mydevices[nodeid] ) {
                                    var pvalstr = setIsyFields(nodeid, mydevices[nodeid], props);
                                    mydevices[nodeid]["pvalue"] = pvalstr;
                                    var device = mydevices[nodeid];
                                    mydb.updateRow("devices", device, "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid = '" + nodeid + "'")
                                    .then(res => {
                                        n++;
                                        if ( n >= numnodes ) {
                                            checkDone("states");
                                        }
                                    });
                                } else {
                                    n++;
                                    if ( n >= numnodes ) {
                                        checkDone("states");
                                    }
                            }
                            });
                        } else {
                            checkDone("states");
                        }
                    } catch(e) { 
                        console.log( (ddbg()), "error - ", e);
                        checkDone("states");
                    }
                });
            }
        }

    // end of the promise function to return to caller
    });
    return promise;

}
// ------ end of getDevices

function mapIsy(isyid, uom) {
    const idmap = {"ST": "switch", "OL": "onlevel", "SETLVL": "level", "BATLVL": "battery", "CV": "voltage", "TPW": "power",
                   "CLISPH": "heatingSetpoint", "CLISPC": "coolingSetpoint", "CLIHUM": "humidity", "LUMIN": "illuminance", 
                   "CLIMD": "thermostatMode", "CLIHCS": "thermostatState", "CLIFS": "thermostatFanMode",
                   "CLIFRS": "thermostatOperatingState", "CLISMD": "thermostatHold", "CLITEMP":"temperature"};

    // TODO - what is GV0 ?
                
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

// this takes an array of props and updates values
function setIsyFields(nodeid, device, props) {

    var value = device.pvalue;
    if ( props && value && is_array(props) ) {
        value = decodeURI2(value);
        props.forEach(function(aprop) {
            var obj = aprop['$'];
            // map ISY logic to the HousePanel logic based on SmartThings and Hubitat
            var subid = mapIsy(obj.id, obj.uom);
            value["uom_" + subid] = obj.uom;
            var val = obj.value;
            value = translateIsy(nodeid, obj.id, obj.uom, subid, value, val, obj.formatted);
        });        
        if ( DEBUGisy ) {
            console.log( (ddbg()), "in setIsyFields - node: ", nodeid, " device: ", device, " value: ", value, " props: ", props);
        }
        value = encodeURI2(value);
    }
    return value;
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
function updateOptions(userid, reload, reloadpath, delay) {

    if ( reload && reloadpath ) {

        if ( delay && delay > 0 ) {
            setTimeout(function pc() {
                pushClient(userid, "reload", "all", reloadpath);
            }, delay);
        } else {
            pushClient(userid, "reload", "all", reloadpath);
        }
    }
}

function getSpecials(configoptions) {

    var spobj = getConfigItem(configoptions, "specialtiles");
    var obj = decodeURI2(spobj);

    // fix the old logic that used to store this info for getFile
    if ( !obj ) {
        obj = {"video": 4, "frame": 4, "image": 4, "blank": 4, "custom": 8};
    }

    return obj;
}

// this sends control over to processLogin upon return
function getLoginPage(req, userid, pname, emailname, mobile, hostname) {
    var tc = "";
    if ( !pname ) pname = "default";
    tc+= getHeader(userid, null, null, true);


    tc+= "<form id=\"loginform\" name=\"login\" action=\"#\"  method=\"POST\">";
    tc+= hidden("returnURL", GLB.returnURL);
    tc+= hidden("pagename", "login");
    var webSocketUrl = getSocketUrl(hostname);
    tc+= hidden("webSocketUrl", webSocketUrl);
    tc+= hidden("webSocketServerPort", GLB.webSocketServerPort);
    tc+= hidden("api", "dologin");
    tc+= hidden("userid", userid, "userid");

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"emailid\" class=\"startupinp\">Email or Username: </label><br>";
    tc+= "<input id=\"emailid\" tabindex=\"1\" name=\"emailid\" size=\"60\" type=\"text\" value=\"" + emailname + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"mobileid\" class=\"startupinp\">Mobile: </label><br>";
    tc+= "<input id=\"mobileid\" tabindex=\"2\" name=\"mobile\" size=\"60\" type=\"text\" value=\"" + mobile + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pword\" class=\"startupinp\">Password: </label><br>";
    tc+= "<input id=\"pword\" tabindex=\"3\" name=\"pword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pname\" class=\"startupinp\">Panel Name: </label><br>";
    tc+= "<input id=\"pname\" tabindex=\"4\" name=\"pname\" size=\"60\" type=\"text\" value=\"" + pname + "\"/>"; 
    tc+= "</div>";

    var currentport = getCookie(req, "pname") || "1:default";
    if ( currentport.substr(1,1)!==":" ) {
        currentport = "1";
    } else {
        currentport = currentport.substr(0,1);
    }
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pnumber\" class=\"startupinp\">Panel Number (must be unique): </label><br>";
    tc+= "<input id=\"pnumber\" tabindex=\"5\" name=\"pnumber\" type='number' min='1' max='9' step='1' value='" + currentport + "'>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"panelpword\" class=\"startupinp\">Panel Password: </label><br>";
    tc+= "<input id=\"panelpword\" tabindex=\"6\" name=\"panelpword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="dologin" tabindex=\"7\" class="formbutton">Sign In</div>';
    tc+= "</div>";

    // the forgot pw link only uses the email and mobile fields
    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "Forgot Password? Enter email and mobile phone number above and then<br>";
    tc+= '<div id="forgotpw" tabindex=\"8\" class="inlinebutton">Click Here to Reset</div>';
    tc+= "</div>";

    // disable creating new accounts
    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "Don't have an account?";
    tc+= '<div id="newuser" tabindex=\"9\" class="inlinebutton">Create One Here</div>';
    tc+= "</div>";

    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "<div>By signing in, you are agreeing to our <div id=\"privacypolicy\" class=\"inlinebutton\">Privacy Policy</div></div>";
    tc+= "<br><div>For login instructions<div id=\"moreinfo\" tabindex=\"10\" class=\"inlinebutton\">Click Here...</div></div>";
    tc+="<div id=\"loginmore\" class=\" loginmore hidden\">Enter your username or email and password to access HousePanel " +
            "and gain access to your smart home devices. " +
            "To access an existing user's devices, enter their mobile number in the field below. All accounts must be password protected.<br><br>" +

            "Each user can have any number of panels defined with each one having its own password and skin. " + 
            "This allows a single account holder to display their smart devices in different ways on different devices. " +
            "Each device at the same physical location must be given a unique number from 1 to 9 to ensure that it has its own network port. " +
            "To load a specific panel skin, please enter its name and password. " +
            "If this is left blank, the first panel available that is not password protected in the user's account will be loaded. " +
            "If all panels are password protected you must provide the name and password of a valid panel to sign into HousePanel." +
            "</div><br />";
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= "<form id=\"newuserform\" class=\"hidden\" name=\"newuserform\" action=\"#\"  method=\"POST\">";
    tc+= hidden("returnURL", GLB.returnURL);
    tc+= hidden("pagename", "login");
    var webSocketUrl = getSocketUrl(hostname);
    tc+= hidden("webSocketUrl", webSocketUrl);
    tc+= hidden("webSocketServerPort", GLB.webSocketServerPort);
    tc+= hidden("api", "newuser");
    // tc+= hidden("userid", userid);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    if ( !GLB.dbinfo.allownewuser || GLB.dbinfo.allownewuser==="false" ) {
        tc+= "<div class='loginline'>";
        tc+= "Sorry, but HousePanel is no longer available for new public users. You can still use the \"freeware\" ";
        tc+= "version of HousePanel by downloading the files onto your own server or rPI. Instructions for how ";
        tc+= "to do this and where to find the files are available at <a href=\"https://www.housepanel.net\" target=\"_blank\">https://www.housepanel.net</a>";
        tc+= "</div>";
    } else {

        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newemailid\" class=\"startupinp\">Email (required): </label><br>";
        tc+= "<input id=\"newemailid\" tabindex=\"1\" name=\"newemailid\" size=\"60\" type=\"text\" value=\"\"/>"; 
        tc+= "</div>";

        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newmobileid\" class=\"startupinp\">Mobile phone (required): </label><br>";
        tc+= "<input id=\"newmobileid\" tabindex=\"2\" name=\"newmobile\" size=\"60\" type=\"text\" value=\"\"/>"; 
        tc+= "</div>";

        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newunameid\" class=\"startupinp\">Username (optional): </label><br>";
        tc+= "<input id=\"newunameid\" tabindex=\"3\" name=\"newuname\" size=\"60\" type=\"text\" value=\"\"/>"; 
        tc+= "</div>";
        
        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newpword\" class=\"startupinp\">Password: </label><br>";
        tc+= "<input id=\"newpword\" tabindex=\"4\" name=\"newpword\" size=\"60\" type=\"password\" value=\"\"/>"; 
        tc+= "</div>";
        
        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newpword2\" class=\"startupinp\">Confirm Password: </label><br>";
        tc+= "<input id=\"newpword2\"tabindex=\"5\"  name=\"newpword2\" size=\"60\" type=\"password\" value=\"\"/>"; 
        tc+= "</div>";

        tc+= "<br>";
        tc+= "<div class='loginline'>";
        tc+= "<div>By creating a new account, you are agreeing to our <div id=\"privacypolicy\" tabindex=\"6\" class=\"inlinebutton\">Privacy Policy</div></div>";
        tc+= "</div><br>";
            
        tc+= "<div class='loginline'>";
        tc+= '<div id="createuser" tabindex=\"6\" class="formbutton">Create Account</div>';
        tc+= "</div>";
    }

    tc+= "<br><hr>";
    tc+= "<div class='loginline'>";
    tc+= "Already have an account?";
    tc+= '<div id="olduser" tabindex=\"8\" class="inlinebutton">Click Here To Login</div>';
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= getFooter();
    return tc;
}

function createNewUser(body) {

    var emailname = body.email;
    var username = body.uname;
    var pname = "default";
    var mobile = body.mobile;
    var pword = body.pword;
    var userid;

    // change username to email if none given
    if ( !username ) {
        username = emailname;
    }

    var promise = checkUser(emailname)
    .then( () => {
        // disable usertype confirmation if email or txt is not activated
        return addNewUser(emailname, username, mobile, pword);
    })
    .then( newuser => {

        if ( DEBUG15 ) {
            console.log( (ddbg()), "newuser: ", newuser );
        }
        if ( !newuser || !newuser.id ) throw "error creating new user";
        userid = newuser.id;

        // the first promise below is to just return newuser since we don't need to get it from the db again
        return Promise.all( [
                // mydb.getRow("users","*","id = "+userid),
                new Promise( function (resolve, reject) { resolve(newuser); }),
                makeNewConfig(userid),
                makeNewRooms(userid, pname),
                makeDefaultHub(userid)
            ] );
    })
    .then(results => {

        // get all the results from the promise check
        var newuser = results[0];
        var configs = results[1];
        var panel = results[2][0];
        var rooms = results[2][1];
        var defhub = results[3];

        if ( DEBUG15 ) {
            console.log( (ddbg()), "new configs: ", configs);
            console.log( (ddbg()), "new rooms: ", rooms);
            console.log( (ddbg()), "new default hub: ", defhub);
            console.log( (ddbg()), "new panel: ", panel);
        }

        // if new user object isn't valid then we have a problem
        if ( !configs || !panel || !rooms || !defhub ) { 
            throw "error - encountered a problem adding a new user to HousePanel with email = " + emailname; 
        }

        var userid = panel.userid;
        var hubid = defhub.id;

        // set new user if no validation is used
        if ( GLB.dbinfo.service!=="twilio" && GLB.dbinfo.service!=="email" && GLB.dbinfo.service!=="both"  ) {
            newuser.usertype = userid;
        }         

        // create the default devices
        makeDefaultDevices(userid, hubid, configs)
        .then( result => {
            if ( DEBUG15 ) {
                console.log( (ddbg()), "default devices created for userid: ", userid, " hubid: ", hubid, " result: ", result);       
            }

            // all went well so make a new folder for this user
            makeDefaultFolder(userid, pname);
        }).catch(reason => {
            throw reason;
        })

        // get the confirmation code from the new user
        var thecode = newuser.hpcode;

        // var d = new Date();
        // var time = d.toLocaleTimeString();
        // var logincode = pw_hash(mobile + time).toUpperCase();
        // var len = logincode.length;
        // var mid = len / 2;
        // var thecode = logincode.substring(0,1) + logincode.substring(mid,mid+1) + logincode.substring(len-4);
        var msg = "HousePanel confirmation code: " + thecode;

        // write confirmation to console and email and/or text it to user
        console.log( (ddbg()), msg );
           
        if ( (GLB.dbinfo.service==="twilio" || GLB.dbinfo.service==="both") ) {
            sendText(mobile, msg);
        }
        if ( GLB.dbinfo.service==="email" || GLB.dbinfo.service==="both" ) {
            msg += "<br>\n\nTo confirm and activate your HousePanel account, <a href=\"" + GLB.returnURL + "/activateuser?userid="+userid+"&hpcode="+thecode+"\">click here</a>, or enter the above code manually."
            sendEmail(emailname, msg);
        }
    
        // make the hpcode expire after 15 minutes
        var delay = 15 * 60000;
        setTimeout(function() {
            mydb.updateRow("users",{hpcode: ""},"id = "+userid)
            .then( () => {
                if ( DEBUG2 ) {
                    console.log( (ddbg()), "confirmation code removed from database for user: ", userid);
                }
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
            });
        }, delay);

        return newuser;
    })
    .catch(reason => {
        console.log( (ddbg()), reason );
    });

    return promise;
}

// promise function to check for existing user
function checkUser(emailname) {
    var promise = new Promise(function(resolve, reject) {
        if ( !emailname ) {
            reject("error - A valid email address must be provided to create a new account.");
        }
        mydb.getRow("users","*","email = '"+emailname+"'")
        .then(row => {
            if ( row ) {
                throw "error - user with email [" + emailname + "] already exists"; 
            } else {
                resolve("success");
            }
        })
        .catch(reason => {
            reject(reason);
        });    
    });
    return promise;
}

function addNewUser(emailname, username, mobile, pword) {
    // create confirmation code
    var d = new Date();
    var time = d.toLocaleTimeString();
    var logincode = pw_hash(mobile + time).toUpperCase();
    var len = logincode.length;
    var mid = len / 2;
    var thecode = logincode.substring(0,1) + logincode.substring(mid,mid+1) + logincode.substring(len-4);

    // create new user but set type to 0 until we get validation
    // note that validation is skipped if usertype was set to an existing user's id
    // if it is set to zero here then we will later set it to its own id mapping to a real new user
    var newuser = {email: emailname, uname: username, mobile: mobile, password: pw_hash(pword), usertype: 0, defhub: "", hpcode: thecode };
    return mydb.addRow("users", newuser)
    .then(result => {
        if ( !result ) { 
            throw "error - encountered a problem adding a new user to HousePanel with email = " + emailname; 
        }
        if ( DEBUG15 ) {
            console.log( (ddbg()), "add user result: ", result, " user: ", newuser );
        }
        var userid = result.getAutoIncrementValue();
        if ( GLB.dbinfo.service!=="twilio" && GLB.dbinfo.service!=="email" && GLB.dbinfo.service!=="both"  ) {
            var usertype = userid;
            mydb.updateRow("users",{usertype: usertype}, "id = " + userid);
        } else {
            usertype = 0;
        }
        newuser.id = userid;
        newuser.usertype = usertype;
        return newuser;
    })
    .catch(reason => {
        console.log( (ddbg()), reason );
        return reason;
    });
}

function makeDefaultFolder(userid, pname) {
    var userfolder = "user"+userid.toString();
    if (!fs.existsSync(userfolder) ) {
        fs.mkdirSync(userfolder);
    }

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

async function makeNewConfig(userid) {

    var d = new Date();
    var timesig = GLB.HPVERSION + " @ " + d.getTime();
    var specials = {video:4, frame:4, image:4, blank:4, custom:8};
    var useroptions = getTypes();

    var configs = [];
    configs.push( await addConfigItem(userid, "time", timesig) );
    configs.push( await addConfigItem(userid, "skin", "skin-housepanel") );
    configs.push( await addConfigItem(userid, "kiosk", "false") );
    configs.push( await addConfigItem(userid, "blackout", "false") );
    configs.push( await addConfigItem(userid, "rules", "true") );
    configs.push( await addConfigItem(userid, "timezone", "America/Los_Angeles") );
    configs.push( await addConfigItem(userid, "phototimer","0") );
    configs.push( await addConfigItem(userid, "fcastcity", "san-carlos") );   // addConfigItem(userid, "fcastcity") || "ann-arbor" );
    configs.push( await addConfigItem(userid, "fcastregion","San Carlos") );  // addConfigItem(userid, "fcastregion","Ann Arbor") );
    configs.push( await addConfigItem(userid, "fcastcode","37d51n122d26") );  // addConfigItem(userid, "fcastcode","42d28n83d74") );
    configs.push( await addConfigItem(userid, "accucity","san-carlos") );     // addConfigItem(userid, "accucity","ann-arbor-mi") );
    configs.push( await addConfigItem(userid, "accuregion","us") );           // addConfigItem(userid, "accuregion","us") );
    configs.push( await addConfigItem(userid, "accucode", "337226") );        // addConfigItem(userid, "accucode", "329380") );
    configs.push( await addConfigItem(userid, "hubpick", "all") );
    configs.push( await addConfigItem(userid, "useroptions", useroptions) );
    configs.push( await addConfigItem(userid, "specialtiles", specials) );
    if ( DEBUG15 ) {
        console.log( (ddbg()), "added configs: ", configs );
    }
    return mydb.getRows("configs","*","userid = "+userid);
}

function addConfigItem(userid, key, value) {
    var promise = new Promise(function(resolve, reject) {
        if ( typeof value === "string" ) {
            var updval = {userid, userid, configkey: key, configval: value};
        } else {
            updval = {userid, userid, configkey: key, configval: JSON.stringify(value)};
        }
        mydb.addRow("configs", updval)
        .then(result => {
            updval.id = result.getAutoIncrementValue();
            resolve(updval);
        });
    });
    return promise;
}

function makeDefaultHub(userid) {
    // make a default hub for this user
    var promise = new Promise(function(resolve, reject) {
        var nullhub = {userid: userid, hubid: "-1", hubhost: "None", hubtype: "None", hubname: "None", 
            clientid: "", clientsecret: "", hubaccess: "", hubendpt: "", hubrefresh: "", 
            useraccess: "", userendpt: "", hubtimer: "0" };

        // add a blank hub for this new user - if this fails defhub will be set to error to flag an issue
        mydb.addRow("hubs", nullhub)
        .then(result => {
            nullhub.id = result.getAutoIncrementValue();
            resolve(nullhub);
        })
        .catch(reason => {
            console.log( (ddbg()), reason);
            reject(reason);
        });
    });
    return promise;
}

function makeDefaultDevices(userid, hubid) {
    // make a default hub for this user
    var specials = {video:4, frame:4, image:4, blank:4, custom:8};

    var promise = new Promise(function(resolve, reject) {
        var dclock;
        var aclock;
        var acontrol;

        var clock = getClock("clockdigital");
        var clockname = clock.name;
        clock = encodeURI2(clock);
        dclock = {userid: userid, hubid: hubid, deviceid: "clockdigital", name: clockname,
                  devicetype: "clock", hint: "clock", refresh: "never", pvalue:  clock};
        mydb.addRow("devices", dclock)
        .then( row => {
            dclock.id = row.getAutoIncrementValue();

            var clock = getClock("clockanalog");
            var clockname = clock.name;
            clock = encodeURI2(clock);
            aclock = {userid: userid, hubid: hubid, deviceid: "clockanalog", name: clockname,
                      devicetype: "clock", hint: "clock", refresh: "never", pvalue:  clock};
            return mydb.addRow("devices", aclock);
        })
        .then( row => {
            aclock.id = row.getAutoIncrementValue();

            var controlval = {"name": "Controller", "showoptions": "Options","refreshpage": "Refresh","c__refactor": "Reset",
                "c__userauth": "Re-Auth","showid": "Show Info","toggletabs": "Toggle Tabs", "showdoc": "Documentation",
                "blackout": "Blackout","operate": "Operate","reorder": "Reorder","edit": "Edit"};
            controlval = encodeURI2(controlval);
            acontrol = {userid: userid, hubid: hubid, deviceid: "control_1", "name": "Controller",
                        devicetype: "control", hint: "controller", refresh: "never", pvalue: controlval};
            return mydb.addRow("devices", acontrol);
        })
        .then( row => {
            acontrol.id = row.getAutoIncrementValue();
            return  [dclock, aclock, acontrol];
        })
        .then(theclocks => {
            // now make the special tiles
            for ( var stype in specials ) {
                var newcount = specials[stype];
                updSpecials(userid, hubid, stype, newcount, null);
            }          
            resolve(theclocks);
        })
        .catch(reason => {
            console.log( (ddbg()), reason);
            reject(reason);
        });
    });
    return promise;
}


function makeNewRooms(userid, pname) {
    var promise = new Promise(function(resolve, reject) {
        var defaultpanel = {userid: userid, pname: pname, password: "", skin: "skin-housepanel"};
        mydb.addRow("panels", defaultpanel)
        .then(resultPanel => {
            // if we added a default panel okay create a set of default rooms
            var panelid = resultPanel.getAutoIncrementValue();
            defaultpanel.id = panelid;
            var rooms = [];
            var k = 0;
            for ( var roomname in GLB.defaultrooms ) {
                k++;
                var room = {userid: userid, panelid: panelid, rname: roomname, rorder: k};
                mydb.addRow("rooms", room)
                .then(resultRoom => {
                    room.id = resultRoom.getAutoIncrementValue();
                    rooms.push(room);

                    // if we added the last room then resolve the promise
                    if ( k === Object.keys(GLB.defaultrooms).length ) {
                        resolve([defaultpanel, rooms]);
                    }
                })
                .catch( reason => {
                    console.log( (ddbg()), reason );
                    reject(reason);
                });
            }
        })
        .catch( reason => {
            console.log( (ddbg()), reason );
            reject(reason);
        });
    });
    return promise;
}

function validateUserPage(user, thecode) {
    var userid = user.id;
    var tc = "";
    tc+= getHeader(userid, null, null, true);
    tc+= "<h2>Activate HousePanel Account</h2>";
    tc+= "<div class='userinfo'>A security code was sent as a txt to your mobile number. Enter it below to activate your account.";
    tc+= "If you did not provide a mobile number or if Twilio service is not available, the code was sent to the log. ";
    tc+= "</div>";
    tc+= "<hr>";

    tc+= "<form id=\"validateuserpage\" name=\"validateuserpage\" action=\"#\"  method=\"POST\">";
    tc+= hidden("returnURL", GLB.returnURL);
    tc+= hidden("pagename", "login");
    tc+= hidden("userid", userid);
    tc+= hidden("email", user.email);
    tc+= hidden("uname", user.uname);
    tc+= hidden("mobile", user.mobile);
    // tc+= hidden("hpcode", user.hpcode);
    // var webSocketUrl = getSocketUrl(hostname);
    // tc+= hidden("webSocketUrl", webSocketUrl);
    // tc += hidden("webSocketServerPort", GLB.webSocketServerPort);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    tc+= "<div class='userinfo'><strong>User ID:</strong>" + userid + "</div>";
    tc+= "<div class='userinfo'><strong>Email: </strong>" + user.email + "</div>";
    tc+= "<div class='userinfo'><strong>Username:</strong>" + user.uname + "</div>";
    tc+= "<div class='userinfo'><strong>Mobile:</strong>" + user.mobile + "</div>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newhpcode\" class=\"startupinp\">Security Code: </label><br>";
    tc+= "<input id=\"newhpcode\" name=\"newhpcode\" size=\"40\" type=\"text\" value=\"" + thecode + "\"/>"; 
    tc+= "</div>";

    tc+= "<div class='loginline'>";
    tc+= '<div id="newuservalidate" class="formbutton">Validate User</div>';
    tc+= "</div>";

    tc+= "<div><a href=\"" + GLB.returnURL + "\">Click Here</a> to abort and log in with existing credentials.</div>";
    tc+= "</form>";
    tc+= getFooter();

    return tc;
}

function validatePasswordPage(user, thecode) {
    var userid = user.id;
    var tc = "";
    tc+= getHeader(userid, null, null, true);
    tc+= "<h2>Enter New Credentials Below</h2>";
    tc+= "<hr>";

    // only need to put the userid in a hidden field since email and uname are not updated
    // but we show them in a static field below
    tc+= "<form id=\"newpwform\" name=\"newpwform\" action=\"#\"  method=\"POST\">";
    tc+= hidden("returnURL", GLB.returnURL);
    tc+= hidden("pagename", "login");
    tc+= hidden("userid", userid);
    tc+= hidden("email", user.email);
    tc+= hidden("uname", user.uname);
    tc+= hidden("mobile", user.mobile);
    // tc+= hidden("hpcode", user.hpcode);
    // var webSocketUrl = getSocketUrl(hostname);
    // tc+= hidden("webSocketUrl", webSocketUrl);
    // tc += hidden("webSocketServerPort", GLB.webSocketServerPort);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    tc+= "<div class='userinfo'><strong>User ID:</strong>" + userid + "</div>";
    tc+= "<div class='userinfo'><strong>Email: </strong>" + user.email + "</div>";
    tc+= "<div class='userinfo'><strong>Username:</strong>" + user.uname + "</div>";
    tc+= "<div class='userinfo'><strong>Mobile:</strong>" + user.mobile + "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newhpcode\" class=\"startupinp\">Security Code: </label><br>";
    tc+= "<input id=\"newhpcode\" name=\"newhpcode\" size=\"40\" type=\"text\" value=\"" + thecode + "\"/>"; 
    tc+= "</div>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newpword\" class=\"startupinp\">New Password: </label><br>";
    tc+= "<input id=\"newpword\" name=\"newpword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"newpword2\" class=\"startupinp\">Confirm Password: </label><br>";
    tc+= "<input id=\"newpword2\" name=\"newpword2\" size=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<hr>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pname\" class=\"startupinp\">Panel Name: </label><br>";
    tc+= "<input id=\"pname\" name=\"pname\" size=\"60\" type=\"text\" value=\"" + "default" + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"panelpword\" class=\"startupinp\">Panel Password: </label><br>";
    tc+= "<input id=\"panelpword\" name=\"panelpword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="newpassword" class="formbutton">Save Credentials</div>';
    tc+= "</div>";

    tc+= "<br><hr>";
    tc+= "<div class='loginline'>";
    tc+= "Think you remember your password after all?<br>";
    tc+= '<div id="revertolduser" class="inlinebutton">Click here to login with existing credentials</div><br>';
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= getFooter();

    return tc;

}

// email and mobile must match
// returns the user object
function forgotPassword(emailname, mobilefield) {

    // get the user from the database and send reminder if user exists
    return mydb.getRow("users","*","email = '"+emailname+"'")
    .then(row => {
        if ( !row ) { 
            return "error - user with email mobile = " + userfield + " and mobile = " + mobilefield + " does not exist"; 
        }

        // update the mobile number if one is given
        var mobile = mobilefield ? mobilefield : row.mobile;

        // compute a special code to check later
        var d = new Date();
        var time = d.toLocaleTimeString();
        var logincode = pw_hash(mobile + time).toUpperCase();
        var len = logincode.length;
        var mid = len / 2;
        var thecode = logincode.substring(0,1) + logincode.substring(mid,mid+1) + logincode.substring(len-4);
        
        // save code to the DB for confirming later, also update mobile number
        var userid = row.id;
        return mydb.updateRow("users",{mobile: mobile, hpcode: thecode},"id = "+userid)
        .then(result => {
            if ( !result ) { 
                return "error - could not process password reset for user " + emailname + " (ID #" + userid + ")"; 
            }
            row.mobile = mobile;
            row.hpcode = thecode;
            var msg = "HousePanel Security Code: " + thecode;
            console.log( (ddbg()), msg, " row: " + row );
            if ( (GLB.dbinfo.service==="twilio" || GLB.dbinfo.service==="both") ) {
                sendText(mobile, msg);
            }
            if ( GLB.dbinfo.service==="email" || GLB.dbinfo.service==="both" ) {
                msg += "<br>\n To confirm and activate your HousePanel account, <a href=\"" + GLB.returnURL + "/forgotpw?userid="+userid+"&hpcode="+thecode+"\">click here</a>"
                sendEmail(emailname, msg);
            }
    
            // make the hpcode expire after 15 minutes
            var delay = 15 * 60000;
            setTimeout(function() {
                mydb.updateRow("users",{hpcode: ""},"id = "+userid)
                .then( () => {
                })
                .catch( reason => {
                    console.log( (ddbg()), reason);
                });
            }, delay);
            return row;
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
            return null;
        });
    });
}

function validateUser(body) {
    
    var userid = body.userid;
    var emailname = body.email;
    var mobile = body.mobile;
    var newhpcode = body.hpcode;
    if ( !userid || !emailname ) {
        return "error - invalid user or the user account was not found - password cannot be updated.";
    }

    // user has been validated so lets update their usertype from 0 to equal their userid and clear out the code
    // the userid is used so it can be mapped to an existing user if desired later
    
    // check hpcode to see if it matches
    // and then update the designated user
    return mydb.getRow("users", "*", "id = " + userid + " AND hpcode ='" + newhpcode + "'")
    .then( row => {
        if ( row ) {
            var upduser = {email: emailname, mobile: mobile, hpcode: "", usertype: userid};
            return mydb.updateRow("users", upduser, "id = " + userid)
            .then( row => {
                return row;
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
                return "error - problem validating user";
            });
        } else {
            return "error - problem validating user, the code you provided probably did not match";
        }
    })
    .catch(reason => {
        console.log( (ddbg()), reason );
        return "error - problem with DB in when validating user = " + userid;
    });
}

function updatePassword(body) {
    
    var userid = body.userid;
    var emailname = body.email;
    var uname = body.uname;
    var mobile = body.mobile;
    var pname = body.pname;
    var hpcode = body.hpcode;
    var pword = pw_hash(body.pword);
    var panelpw = pw_hash(body.panelpw);

    // console.log(">>>> ", userid, emailname, uname, mobile, pname, hpcode, pword);
    if ( !userid || !emailname ) {
        return "error - invalid user or the user account was not found - password cannot be updated.";
    }
    if ( !hpcode ) {
        return "error - a valid security code was not provided - password cannot be updated.";
    }

    // check hpcode to see if it matches
    // and then update the designated user
    var retobj = mydb.getRow("users","*","id = " + userid + " AND hpcode = '" + hpcode + "'")
    .then(row => {
        if ( row ) {
            // console.log(">>>> users row: ", row);
            var upduser = {email: emailname, uname: uname, mobile: mobile, password: pword, usertype: userid, defhub: "", hpcode: ""};
            return mydb.updateRow("users", upduser, "id = " + userid)
            .then( row => {
                if ( row ) {
                    var updpanel = {userid: userid, pname: pname, password: panelpw};
                    return mydb.updateRow("panels", updpanel, "userid = " + userid + " AND pname = '"+pname+"'")
                    .then( row => {
                        if ( row ) {
                            return {pword: pword, pname: pname, panelpw: panelpw};
                        } else {
                            return "error - problem updating or creating a new panel for user = " + userid;
                        }
                    })
                    .catch(reason => {
                        console.log( (ddbg()), reason );
                        return "error - problem with DB in password reset for user = " + userid;
                    });                    
                } else {
                    return "error - problem updating user password for user = " + userid;
                }
            })
            .catch(reason => {
                console.log( (ddbg()), reason );
                return "error - problem with DB in password reset for user = " + userid;
            });                    
        } else {
            return "error - the provided security code is invalid for user = " + userid;
        }
    })
    .catch(reason => {
        console.log( (ddbg()), reason );
        return "error - problem with DB in password reset for user = " + userid;
    });

    // console.log("retobj in updatepassord: ", retobj);
    return retobj;
}

function processLogin(body, res) {

    // check the user name and password based on login form data
    var uname = encodeURI(body["emailid"].trim());
    var umobile = encodeURI(body["mobile"].trim());
    var uhash = pw_hash(body["pword"]);

    // get the panel number here
    var pnumber = body["pnumber"];
    if ( !pnumber ) {
        pnumber = "1";
    } else {
        pnumber = parseInt(pnumber);
        if ( isNaN(pnumber) || pnumber < 1 || pnumber > 9 ) {
            pnumber = 1;
        }
        pnumber = pnumber.toString();
    }

    if ( !body["pname"] ) {
        var pname = "";
        var phash = "";
    } else {
        pname = encodeURI(body["pname"].trim());
        phash = pw_hash(body["panelpword"]);
    }

    if ( DEBUG22 ) {
        console.log( (ddbg()), "dologin: uname= ", uname, " pword= ", uhash, " pname= ", pname, " panelpword= ", phash, " pnumber= ", pnumber, " body: ", body);
    }

    // query for panel name given with password and username or email with password
    // panel name can be skipped if the password is also skipped to retrieve the first panel without a password for the user given
    // emails for all users must be unique
    if ( pname ) {
        var conditions = "panels.pname = '" + pname + "' AND panels.password = '"+phash+"' AND ( users.email = '"+uname+"' OR users.uname ='"+uname+"' ) AND users.mobile = '"+umobile+"' AND users.password = '"+uhash+"'";
    } else {
        conditions = "panels.password = '' AND ( users.email = '"+uname+"' OR users.uname ='"+uname+"' ) AND users.mobile = '"+umobile+"' AND users.password = '"+uhash+"'";
    }

    // ** change id to usertype to map user to existing one
    var joinstr = mydb.getJoinStr("panels", "userid", "users", "usertype");
    var fields = "users.id as users_id, users.email as users_email, users.uname as users_uname, users.mobile as users_mobile, users.password as users_password, " +
                 "users.usertype as users_usertype, users.defhub as users_defhub, users.hpcode as users_hpcode, " + 
                 "panels.id as panels_id, panels.userid as panels_userid, panels.pname as panels_pname, panels.password as panels_password, panels.skin as panels_skin";
    var results = mydb.getRow("panels", fields, conditions, joinstr)
    .then(therow => {
        if ( therow ) {
            // make sure we get the actual email and panel names to store in our cookies
            // since this is what we check for a valid login
            // var userid = therow["users_id"];
            var userid = therow["users_id"];
            var usertype = therow["users_usertype"];

            uname = therow["users_email"];
            pname = therow["panels_pname"];
            setCookie(res, "uname", pw_hash(uname));

            // we take on the panel number to the start of the panel name in the cookie so we always have it
            setCookie(res, "pname", pnumber + ":" + pw_hash(pname));
            if ( DEBUG3 ) {
                console.log((ddbg()), therow);
                console.log((ddbg()), "Successful login. userid: ", userid, " Username: ", uname, " Panelname: ", pname, " on panel #"+pnumber);
            }

            // lets make sure there is a null hub for this user
            // actually - point this to the user we are reading which could be myself or someone else
            // if we are a new user not mapped to an existing then make the default hub stuff
            if ( userid === usertype ) {
                var nullhub = {userid: userid, hubid: "-1", hubhost: "None", hubtype: "None", hubname: "None", 
                    clientid: "", clientsecret: "", hubaccess: "", hubendpt: "", hubrefresh: "", 
                    useraccess: "", userendpt: "", hubtimer: "0" };
                mydb.updateRow("hubs",nullhub,"userid = " + userid + " AND hubid = '-1'")
                .then( () => {
                })
                .catch(reason => {
                    console.log( (ddbg()), reason );
                });
            
                // re-create the user directory and default custom css if not there
                makeDefaultFolder(userid, pname);
            }
        
            // pushClient(userid, "reload", "login", "/");
        } else {
            delCookie(res, "uname");
            delCookie(res, "pname");
            console.log( (ddbg()), "Failed login attempt. Username: ", uname, " Panelname: ", pname);
            therow = "error - invalid username or password";
            // pushClient(userid, "reload", "login", "/logout");
        }
        return therow;
    }).catch(reason => {
        console.log( (ddbg()), "processLogin - ", reason);
        return "error - something went wrong when logging in";
    });
    return results;
}

function getAuthPage(user, configoptions, hostname, rmsg) {

    // get the current settings from options file
    var userid = user["users_userid"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var defhub = user["users_defhub"] || "new";
    var usertype = user["users_usertype"];
    var panelid = user["panels_id"];
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    // if ( !rmsg ) { rmsg = ""; }
    var conditions = "userid = " + userid;
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
        var fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
        "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
        "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
        var result = mydb.getRows("devices", fields, "devices.userid = " + userid, joinstr)
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
        console.log( (ddbg()), reason );
        return "error - something went wrong trying to display info page";
    });

    return display;

    function getinfocontents(configoptions, hubs, devices) {

        var $tc = "";

        $tc += getHeader(userid, null, null, true);
        $tc += "<h2>" + GLB.APPNAME + " Hub Authorization</h2>";

        // provide welcome page with instructions for what to do
        // this will show only if the user hasn't set up HP
        // or if a reauth is requested or when converting old passwords
        $tc += "<div class=\"greeting\">";

        $tc +="<p>This is where you link a Hubitat or ISY hub to " +
                "HousePanel to gain access to your smart home devices. " +
                "Sonos hubs are also supported but updates will not be received. " +
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
        $tc += hidden("pagename", "auth");
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("pathname", "/");
        $tc += hidden("webSocketUrl", webSocketUrl);
        $tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        $tc += hidden("userid", userid, "userid");
        $tc += hidden("emailid", useremail, "emailid");
        $tc += hidden("skinid", skin, "skinid");
        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        $tc += hidden("configsid", JSON.stringify(configs), "configsid");
        $tc += "<div class=\"greetingopts\">";
        // $tc += "<h3><span class=\"startupinp\">Last update: " + lastedit + "</span></h3>";
            
        if ( hubs ) {
            var authhubs = clone(hubs);
        } else {
            authhubs = [];
        }

        if ( DEBUG2 ) {
            console.log( (ddbg()), "Hub auth default hub: ", defhub, " hubs: ", jsonshow(authhubs) );
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
        if ( rmsg==="" && defhub && defhub !== "new" && devices ) {
            var num = 0;
            devices.forEach(function(device) {
                if ( device["hubs_hubid"] === defhub ) {
                    num++;
                }
            });
            var ntc= "Hub with hubId= " + defhub + " is authorized with " + num + " devices";
            $tc += "<div id=\"newthingcount\">" + ntc + "</div>";
        } else {
            if ( !rmsg ) {
                rmsg = "";
            }
            $tc += "<div id=\"newthingcount\">" + rmsg + "</div>";
        }

        $tc += getHubPanels(authhubs, defhub);
        $tc += "<div id=\"authmessage\"></div>";
        $tc += "<br><br>";
        $tc += "<button class=\"infobutton\">Return to HousePanel</button>";
        $tc += getFooter();
        return $tc;
    }

    function getHubPanels(authhubs, defhub) {

        // TODO - finish fixing Ford and Sonos hubs so we can enable it
        // var allhubtypes = { SmartThings:"SmartThings", NewSmartThings:"New SmartThings", Hubitat: "Hubitat", ISY: "ISY", Ford: "Ford", Lincoln: "Lincoln" };
        // var allhubtypes = { SmartThings:"Legacy SmartThings", NewSmartThings:"SmartThings", Hubitat: "Hubitat", Sonos: "Sonos", Ford: "Ford" };
        // var allhubtypes = { SmartThings:"Legacy SmartThings", NewSmartThings:"SmartThings", Hubitat: "Hubitat" };
        var allhubtypes = { Hubitat: "Hubitat", ISY: "ISY", NewSmartThings:"SmartThings", Sonos: "Sonos", Ford: "Ford" };
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
            var hubType = hub["hubtype"];secretclass
            var hubId = hub["hubid"].toString();
            var hubindex = hub.id;
            var id = i+1;
            if ( !selected && hubId === defhub) {
                var hubclass = "authhub";
                selected = true;
            } else {
                hubclass = "authhub hidden";
            }

            // set fixed parameters for New SmartThings and Sonos
            var disabled = "";
            var secretclass = "startupinp";
            if ( hubType === "None" ) {
                hub.clientid = "";
                hub.clientsecret = "";
                hub.hubhost = "";
                secretclass += " hidden";
                disabled = " disabled";
            // } else if ( hubType === "Hubitat" ) {
            //     hub.hubhost = "https://oauth.cloud.hubitat.com";
            // } else if ( hubType === "NewSmartThings" ) {
            //     // hub.clientid = GLB.dbinfo["st_clientid"];
            //     // hub.clientsecret = encodeURI(GLB.dbinfo["st_clientsecret"]);
            //     hub.hubhost = "https://api.smartthings.com";
            //     // secretclass += " hidden";
            // } else if ( hubType === "Sonos" ) {
            //     hub.hubhost = "https://api.sonos.com";
            //     // secretclass += " hidden";
            // } else if ( hubType === "ISY" ) {
            //     hub.hubhost = "https://192.168.4.4:8443";
            // } else {
            //     hub.hubhost = "";
            }

            // for each hub make a section with its own form that comes back here as a post
            $tc +="<div id=\"authhub_" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" hubtype=\"" + hubType + "\" class=\"" + hubclass + "\">";
                $tc += "<form id=\"hubform_" + hubindex + "\" hubnum=\"" + id + "\" class=\"houseauth\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

                // insert the fields neede in the apiCall function
                $tc += hidden("userid", userid);
                $tc += hidden("uname", uname);
                $tc += hidden("panelid", panelid);
                $tc += hidden("pname", pname);
                $tc += hidden("skin", skin);

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
                    $tc += "<input class=\"startupinp\" title=\"Enter the hub OAUTH address here\" name=\"hubhost\" size=\"80\" type=\"text\" value=\"" + hub["hubhost"] + "\"/>"; 
    
                    $tc += "</div>";
                }
                // we load client secret in js since it could have special chars that mess up doing it here
                var csecret = decodeURI(hub.clientsecret);
                $tc += hidden("csecret", csecret, "csecret_"+hubindex);
                    
                // $tc += "<div><label class=\"startupinp required\">Host API Url: </label>";
                // $tc += "<input class=\"startupinp\" title=\"Enter the hub OAUTH address here\" name=\"hubhost\" size=\"80\" type=\"text\" value=\"" + hub["hubhost"] + "\"/></div>"; 

                // wrap all of this in a group that can be hidden for New SmartThings, Sonos, and blanks
                $tc += "<div id=\"hideid_" + hubindex + "\" class=\"" + secretclass + "\">";

                $tc += "<div><label class=\"startupinp\">Client ID: </label>";
                $tc += "<input class=\"startupinp\" name=\"clientid\" size=\"80\" type=\"text\" value=\"" + hub["clientid"] + "\"/></div>";

                $tc += "<div class=\"fixClientSecret\"><label class=\"startupinp\">Client Secret: </label>";
                $tc += "<input class=\"startupinp\" name=\"clientsecret\" size=\"80\" type=\"text\" value=\"\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">Fixed access_token: </label>";
                $tc += "<input class=\"startupinp\" name=\"useraccess\" size=\"80\" type=\"text\" value=\"" + hub["useraccess"] + "\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">Fixed Endpoint: </label>";
                $tc += "<input class=\"startupinp\" name=\"userendpt\" size=\"80\" type=\"text\" value=\"" + hub["userendpt"] + "\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">hub ID or App ID: </label>";
                $tc += "<input class=\"startupinp\" name=\"hubid\" size=\"80\" type=\"text\" value=\"" + hub["hubid"] + "\"/></div>"; 

                $tc += "</div>";

                $tc += "<div><label class=\"startupinp\">Hub Name: </label>";
                $tc += "<input class=\"startupinp\"" + disabled + " name=\"hubname\" size=\"80\" type=\"text\" value=\"" + hub["hubname"] + "\"/></div>"; 

                $tc += "<div><label class=\"startupinp\">Refresh Timer: </label>";
                $tc += "<input class=\"startupinp\"" + disabled + " name=\"hubtimer\" size=\"10\" type=\"text\" value=\"" + hub["hubtimer"] + "\"/></div>"; 

                $tc += "<input class=\"hidden\" name=\"hubaccess\" type=\"hidden\" value=\"" + hub["hubaccess"] + "\"/>"; 
                $tc += "<input class=\"hidden\" name=\"hubendpt\" type=\"hidden\" value=\"" + hub["hubendpt"] + "\"/>"; 
                $tc += "<input class=\"hidden\" name=\"hubrefresh\" type=\"hidden\" value=\"" + hub["hubrefresh"] + "\"/>"; 
                
                $tc += "<div>";
                $tc += "<input hubindex=\"" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" class=\"authbutton hubauth\" value=\"Authorize Hub #" + id + "\" type=\"button\" />";
                if ( hubId !== "new" && hubId!=="-1" ) {
                    $tc += "<input hubindex=\"" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" class=\"authbutton hubdel\" value=\"Remove Hub #" + id + "\" type=\"button\" />";
                } else {
                    $tc += "<input hubindex=\"" + hubindex + "\" hubnum=\"" + id + "\" hubid=\"" + hubId + "\" class=\"authbutton hubdel hidden\" value=\"Remove Hub #" + id + "\" type=\"button\" />";
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
    return ( obj!==null && typeof obj === "object" );
}

function array_key_exists(key, arr) {
    if ( !is_object(arr) ) {
        return false;
    }
    return ( typeof arr[key] !== "undefined" );
}

function ddbg() {
    var d = new Date();
    var dstr = "{" + d.toLocaleDateString() + " " + d.toLocaleTimeString() + "} => ";
    return "V" + GLB.HPVERSION +" " + dstr;
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
function getNewPage(userid, pname, skin, configoptions, cnt, roomid, roomname, kroom, things, alldevices) {
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
        var hubindex = thing["hubs_id"];
        var hint = thing["devices_hint"];
        var refresh = thing["devices_refresh"];
        var pvalue = decodeURI2(thing["devices_pvalue"]);
        var hubtype = thing["hubs_hubtype"];

        // new id to make it easy to get to this specific thing later
        var thingid = thing["things_id"];

        // for now and testing purposes hack up a sensor
        if ( !pvalue || typeof pvalue !== "object" ) {
            pvalue = {name: ""};
        }

        // construct the old all things equivalent but add the unique thingid and roomid fields
        var thesensor = {id: id, name: thingname, thingid: thingid, roomid: roomid, type: swtype, hubnum: hubid, hubindex: hubindex, hubtype: hubtype,
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
    var pattern = /[,;!-\'\*\<\>\{\}]/g;
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

    // only process this for special tiles that read files
    var specialtiles = getSpecials(configoptions);
    if ( !array_key_exists(thingtype, specialtiles) ) {
        return thingvalue;
    }

    var fw = "auto";
    var fh = "auto";

    // get the name, width, height to create
    if ( array_key_exists("name", thingvalue) ) {
        var fn = thingvalue["name"].trim();
    } else {
        // fn = specialtiles[thingtype][0];
        fn = thingtype.substring(0,1).toUpperCase() + thingtype.substring(1);
        thingvalue["name"] = fn;
    }
    if ( array_key_exists("width", thingvalue) ) {
        fw = thingvalue["width"];
    } else {
        thingvalue["width"] = fw;
    }

    if ( array_key_exists("height", thingvalue) ) {
        fh = thingvalue["height"];
    } else {
        thingvalue["height"] = fh;
    }

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
        var folder = "user" + userid + "/";
        var mediafolder = folder + pname + "/media/";
        var skins = ["skin-housepanel", "skin-modern", "skin-legacyblue"];

        if ( thingtype === "image" && fn.startsWith("http") ) {
            $vn = fn;
            $fext = "img";
        } else if ( fn.startsWith("http")) {
            $vn = fn;
            $fext = getext(fn);
        } else if (fs.existsSync(folder + fn) ) {
            $vn = folder + fn;
            $fext = getext(fn);
        } else if (fs.existsSync(mediafolder + fn)) {
            $vn = mediafolder + fn;
            $fext = getext(fn);
        } else {
            for ( var i in skins ) {
                var skin = skins[i];
                if ( $vn==="" && fs.existsSync(skin + "/media/"+ fn)) {
                    $vn = skin + "/media/" + fn;
                    $fext = getext(fn);
                }
            }
        }

        if ( DEBUG16 ) {
            console.log((ddbg()), "custom name debug: grtypes= ", grtypes, " fn= ", fn, " vn= ", $vn, " ext= ", $fext, " thingvalue: ", jsonshow(thingvalue));
        }
    
        // next check names with extensions
        if ( $vn==="" ) {
            grtypes.forEach(function($ext) {
                if ( $vn==="" && fs.existsSync(folder + fn + $ext) ) {
                    $vn = folder + fn + $ext;
                    $fext = $ext;
                } else if ( $vn==="" && fs.existsSync(mediafolder + fn + $ext) ) {
                    $vn = mediafolder + fn + $ext;
                    $fext = $ext;
                } else {
                    for ( var i in skins ) {
                        var skin = skins[i];
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
        if ( $fext.length && $fext.substring(0,1)==="." ) {
            $fext = $fext.substring(1);
        }

        switch ($fext) {
            // image files
            case "jpg":
            case "png":
            case "gif":
            case "img":
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
                if ( $vn.startsWith("http") || thingtype==="frame" ) {
                    $v = "<iframe width=\"" + fw + "\" height=\"" + fh + "\" src=\"" + $vn + "\" frameborder=\"0\"></iframe>";
                } else {
                    $v = "<div style=\"width: " + fw + "px; height: " + fh + "px;\"></div>";
                }
                break;
        }
    
    // if file wasn't found just make an empty block of the requested size
    } else {
        $v = "<div style=\"width: " + fw + "px; height: " + fh + "px;\"></div>";
    }

    if ( DEBUG16 ) {
        console.log((ddbg()), "custom name for type: ", thingtype, " vn= ", $vn, " fn= ", fn, " v= ", $v, " media file= ", mediafile);
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
function writeAccuWeather(userid, city, region, code) {
    if ( !city || !code || !region ) {
        return;
    }
    const acid = "awcc1531959686475";
    const unit = "F";
    var rcitycode = region + "/" + city + "/" + code + "/weather-forecast/" + code;
    var $tc = "<!DOCTYPE html>";
    $tc += "<html><body>";
    $tc += "<a href=\"https://www.accuweather.com/en/" + rcitycode + "\" class=\"aw-widget-legal\">";
    $tc += "</a><div id=\"" + acid + "\" class=\"aw-widget-current\"  data-locationkey=\"" + code + "\" data-unit=\"" + unit + "\" data-language=\"en-us\" data-useip=\"false\" data-uid=\"" + acid + "\"></div>";
    $tc += "<script type=\"text/javascript\" src=\"https://oap.accuweather.com/launch.js\"></script>";
    $tc += "</body></html>";
    var fname = "user" + userid + "/Frame2.html";
    fs.writeFileSync(fname, $tc, {encoding: "utf8", flag:"w"});
}

// function to create Frame1.html for a city
// the City Name and code must be provided
// data for my home town:  ("ann-arbor","Ann Arbor","42d28n83d74");
function writeForecastWidget(userid, city, region, code) {
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
    var fname = "user" + userid + "/Frame1.html";
    fs.writeFileSync(fname, $tc, {encoding: "utf8", flag:"w"});
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
    if ( thingtype==="audio" || thingtype==="sonos" || thesensor.value.audioTrackData ) {
        if ( !thesensor.value.audioTrackData || objCount(thesensor.value.audioTrackData)===0 ) {
            thesensor.value.audioTrackData = {
                title: "None",
                artist: "None",
                album: "None",
                albumArtUrl: GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png",
                mediaSource: "None"
            };
        }
        thesensor.value = translateAudio(thesensor.value);
    } else if ( thingtype==="music" || thesensor.value.trackData ) {
        thesensor.value = translateMusic(thesensor.value);
    } else if ( thingtype==="weather" ) {
        var thisorigname = thesensor.name || "Weather";
        thesensor.value = translateWeather(thisorigname, thesensor.value);
    } else {
        thesensor.value = translateObjects(thesensor.value);
    }

    // set custom name provided by tile editor
    // this is overruled by any name provided in the tile customizer
    if ( customname && array_key_exists("name", thesensor.value) ) { 
        thesensor.value["name"] = customname.trim();
    }

    // add in customizations here
    if ( configoptions && is_object(configoptions) ) {
        thesensor.value = getCustomTile(userid, configoptions, thesensor.value, bid);
        thesensor.value = returnFile(userid, pname, thesensor.value, thingtype, configoptions);
    }
    thesensor.value = setValOrder(thesensor.value);

    var thingvalue = thesensor.value;
        
    // set type to hint if one is given
    // this is to support ISY nodes that all register as ISY types
    // so we can figure out what type of tile this is closest to
    // this also is used to include the hub type in the tile
    var hint = thesensor["hint"] || "";
    var hubnum = thesensor["hubnum"] || "-1";
    var hubindex = thesensor["hubindex"];
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

    // clean up any custom provided name and set the extra classes based on name
    var subtype = "";
    if ( array_key_exists("name", thingvalue) ) { 
        var pnames = processName(thingvalue["name"], thingtype);
        thingvalue["name"] = pnames[0];
        subtype = pnames[1];
    }

    // use the position provided
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

    // no longer do this because it is stupid
    var bgcolor= "";
    // if ( array_key_exists("color", thingvalue) ) {
    //     var cval = thingvalue["color"];
    //     try {
    //         if ( cval && (cval.match(/^#[abcdefABCDEF\d]{6}/) !== null || cval.startsWith("rgb")) ) {
    //             bgcolor = " style=\"background-color:"+cval+";\"";
    //         }
    //     } catch (e) {
    //         bgcolor = "";
    //     }
    // }
    
    // wrap thing in generic thing class and specific type for css handling
    // include the new thingid value for direct access to the specific thing in the DB
    $tc=   "<div id=\""+idtag+"\" thingid=\""+thingid+"\" aid=\""+cnt+"\" hub=\""+hubnum+"\" hubindex=\""+hubindex+"\"  hubtype=\""+hubtype+"\" tile=\""+kindex+"\" bid=\""+bid+"\" type=\""+thingtype+"\"";
    
    // set up the class setting
    var classstr = "thing " + thingtype+"-thing" + subtype;
    if ( hint ) {
        // classstr += " " + hint.replace(/\./g,"_");
        if ( thingtype==="isy" ) {
            hint = hint.replace(/\./g,"_");
        }
        $tc += " hint=\""+hint+"\"";
    }
    classstr += " p_"+kindex;

    // add the panel name to the class
    // this allows styling to be page dependent or applied everywhere
    classstr = panelname + " " + classstr;
    classstr = uniqueWords(classstr);

    $tc += " panel=\""+panelname+"\" class=\""+classstr+"\"";
    $tc += " refresh=\""+refresh+"\"";
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
    if (thingtype==="weatherxxx" && array_key_exists("feelsLike", thingvalue) ) {
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

            // if definition for a variable name is given then use it
            // else if ( thingtype==="isy" && (tkey.startsWith("Int_") || tkey.startsWith("State_")) && thingvalue["def_"+tkey] ) {
            //     tval = thingvalue["def_"+tkey] + " = " + tval;
            //     $tc += putElement(kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, null, null, twidth, theight);
            // }

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

                if ( typeof tval === "string" && (tval.startsWith("LINK::") || tval.startsWith("TEXT::")) && alldevices ) {
                    // if (  array_key_exists(helperkey, thingvalue) ) { // } && thingvalue[helperkey] && thingvalue[helperkey].substr(0,2)==="::" ) {
                    var helperval = tval;
                    $tc += putLinkElement(bid, hint, helperval, kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, twidth, theight);
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
function putLinkElement(bid, hint, helperval, kindex, cnt, j, thingtype, tval, tkey, subtype, bgcolor, twidth, theight) {

    var linktype = thingtype;
    var linkhub = 0;
    var linkbid = bid;
    var subid = tkey;
    var realsubid = subid;
    var linkid = 0;

    var ipos = helperval.indexOf("::");
    var command = helperval.substr(0, ipos);
    var linkval = helperval.substr(ipos+2);
    var sibling;

    if ( command === "TEXT" ) {
        helperval = linkval;
        sibling= "<div id=\"sb-"+cnt+"-"+subid+"\""+" aid=\""+cnt+"\" linkid=\""+linkid+"\" linktype=\""+linktype+"\" linkhub=\""+linkhub+"\" linkval=\""+helperval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
        tval = linkval;

    } else if ( command === "LINK" ) {


        // get info for links but skip if the link had an error
        // links use format - LINK::subid::tileid
        // if ( linkval && command==="LINK" ) {
        var jpos = linkval.indexOf("::");
        if ( jpos !== -1 ) {

            realsubid = linkval.substr(0, jpos)
            var linkid = linkval.substr(jpos+2);
            
            // get the device for this linked tile
            var linkdev = alldevices[linkid];
            if ( linkdev ) {
                
                // replace the place holder value with the linked value
                try {
                    linktype = linkdev["devices_devicetype"];
                    linkid = linkdev["devices_id"];
                    linkbid = linkdev["devices_deviceid"];
                    linkhub = linkdev["hubs_id"];
                    hint = linkdev["devices_hint"];
                    var linktileval = decodeURI2(linkdev["devices_pvalue"]);

                    // handle special audio updates
                    if ( !linktileval ) {
                        linktileval = {};
                    } else if ( linktype==="audio" || linktype==="sonos" || linktileval.audioTrackData ) {
                        linktileval = translateAudio(linktileval);
                    } else if ( linktype==="music" || linktileval.trackData ) {
                        linktileval = translateMusic(linktileval);
                    } else if ( linktype==="weather" ) {
                        linktileval = translateWeather("Weather", linktileval);
                    } else {
                        linktileval = translateObjects(linktileval);
                    }

                } catch(e) {
                    linktileval = {};
                }
                
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

            sibling= "<div id=\"sb-"+cnt+"-"+subid+"\""+" aid=\""+cnt+"\" linkid=\""+linkid+"\" hint=\""+hint+"\" linktype=\""+linktype+"\" linkhub=\""+linkhub+"\" linkval=\""+helperval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
        }
    }

    // use the original type here so we have it for later
    // but in the actual target we use the linktype
    // var sibling= "<div aid=\""+cnt+"\" linktype=\""+linktype+"\" value=\""+tval+"\" linkval=\""+linkval+"\" command=\""+command+"\" subid=\""+realsubid+"\" linkbid=\"" + linkbid + "\" class=\"user_hidden\"></div>";
    if ( DEBUG10 ) {
        console.log( (ddbg()), "bid: ", bid, " helperval: ", helperval, " sibling: ", sibling,"\n new tval: ", tval);
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
    if ( typeof subtype === "undefined" ) {
        subtype = "";
    } else if ( typeof subtype === "string" && subtype.substr(0,1)!==" " ) {
        subtype = " " + subtype;
    }

    if ( tval===0 ) { tval = "0"; }
    else if ( typeof tval === "undefined" ) { tval = ""; }

    // do nothing if this is a rule and rules are disabled
    if ( !ENABLERULES && typeof tval==="string" && tval.substring(0,6)==="RULE::" ) {
        return $tc;
    }
        
    // fix thermostats to have proper consistent tags
    // this is supported by changes in the .js file and .css file
    
    if ( tkey==="hue" || tkey==="saturation" ||
         tkey==="heatingSetpoint" || tkey==="coolingSetpoint"  ||
         (tkey.startsWith("Int_") && thingtype==="isy") ||
         (tkey.startsWith("State_") && thingtype==="isy") ) {

        var modvar = tkey;

        // fix thermostats to have proper consistent tags
        // this is supported by changes in the .js file and .css file
        // notice we use alias name in actual value and original key in up/down arrows
        $tc += "<div class=\"overlay " + tkey + " " + subtype + " v_" + kindex + "\">";
        if (sibling) { $tc += sibling; }
        $tc += aidi + " subid=\"" + modvar + "-dn\" title=\"" + modvar + " down\" class=\"" + thingtype + " arrow-dn " + modvar + "-dn " + pkindex + "\"></div>";
        $tc += aidi + " subid=\"" + modvar + "\" title=\"" + thingtype + " " + modvar + "\" class=\"" + thingtype + " arrow-it " + modvar + pkindex + "\"" + " id=\"" + aitkey + "\">" + tval + "</div>";
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
        } else if ( tkey==="time" || tkey==="date" || tkey==="color" || typeof tval!=="string" || tval==="" || tval==="lastRunTime" || tval==="lastFinishTime" ||
                   (tkey.substr(0,6)==="event_") || tkey.startsWith("_") ||
                   tkey==="trackDescription" || tkey==="currentArtist" || tkey==="groupRole" ||
                   tkey==="currentAlbum" || tkey==="trackImage" || tkey==="mediaSource" ||
                   tkey==="weatherIcon" || tkey==="forecastIcon" ||
                   !isNaN(+tval) || thingtype===tval ||
                   (tval.substring(0,7)==="number_") || 
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
                    tval = "<img class='" + tkey + "' width='120px' height='120px' src='" + tval + "'>";
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

        // hide variable precisions and definitions
        if ( thingtype==="isy" && (tkey.startsWith("prec_") || tkey.startsWith("def_")) ) {
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
        // hide all fields that start with uom_ since that contains units 
        // couid do in CSS but this is easier and faster
        if ( tkey.startsWith("uom_") ) {
            $tc += "<div class=\"overlay "+tkey+" hidden v_"+kindex+"\">";
        } else {
            $tc += "<div class=\"overlay "+tkey+" v_"+kindex+"\">";
        }
        if (sibling) { $tc += sibling; }
        if ( tkey === "level" || tkey==="onlevel" || tkey==="colorTemperature" || tkey==="volume" || tkey==="position" ) {
            $tc += aidi + ttype + " subid=\"" + tkey+"\" value=\""+tval+"\" title=\""+tkey+"\" class=\"" + thingtype + tkeyshow + pkindex + "\" id=\"" + aitkey + "\"></div>";
        // } else if ( thingtype==="location" && tkey.substr(0,1)==="_" && tval.substr(0,6)!=="RULE::" ) {
        //     $tc += aidi + ttype + " subid=\"" + tkey+"\" modeid=\""+tval+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + extra + "\" id=\"" + aitkey + "\">" + tkey.substr(1) + "</div>";
        } else if ( typeof tkey==="string" && typeof tval==="string" && tkey.substr(0,8)==="_number_" && tval.substr(0,7)==="number_" ) {
            var numval = tkey.substring(8);
            $tc += aidi + ttype + " subid=\"" + tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + "\" id=\"" + aitkey + "\">" + numval + "</div>";
        } else {
            if ( typeof tval==="string" && tval.substring(0,6)==="RULE::" && subtype!=="rule" ) {
                tkeyshow += " rule";
            }
            // if ( thingtype === "variables" ) {
            //     $tc += "<div aid=\""+i+"\" type=\""+thingtype+"\"  subid=\""+tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + extra + "\" id=\"" + aitkey + "\">" + tkey + " = " + tval + "</div>";
            // } else {
            $tc += "<div aid=\""+i+"\" type=\""+thingtype+"\"  subid=\""+tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + extra + "\" id=\"" + aitkey + "\">" + tval + "</div>";
            // }
        }
        $tc += "</div>";
    }
    return $tc;
}

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

// if tzone isn't given the time in CA is provided
// since the server sits in California
// when providing a tzone you must account for daylight savings for your location
function getFormattedTime(fmttime, old, tzone) {
    if ( typeof old=== "undefined" || !old ) {
        old = new Date();
    }

    if ( !tzone || isNaN(parseInt(tzone)) ) {
        var d = old;
    } else {
        var tz = parseInt(tzone);
        var utc = old.getTime() + (old.getTimezoneOffset() * 60000);
        d = new Date(utc - tz*60000);
    }

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

function getClock(clockid) {
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
    var timeofday = getFormattedTime(fmttime, d, 0);

    var dclock = {"name": clockname, "skin": clockskin, "weekday": weekday,
        "date": dateofmonth, "time": timeofday, "tzone": timezone,
        "fmt_date": fmtdate, "fmt_time": fmttime};
    return dclock;
}

// make the default name start with a capital letter if we give a number
function getCustomName(defbase, cnum) {
    var defname = defbase.substring(0,1).toUpperCase() + defbase.substring(1);
    defname = defname + cnum;
    return defname;
}

// create addon subid's for any tile
// this enables a unique customization effect
// we pass in the config options so this function doesn't run async
function getCustomTile(userid, configoptions, custom_val, bid) {

    var configkey = "user_" + bid;
    var updated_val = clone(custom_val);
    for ( var i in configoptions ) {

        var key = configoptions[i].configkey;
        var val = configoptions[i].configval;
        var keyuser = configoptions[i].userid;
        if ( parseInt(userid) === parseInt(keyuser) && key === configkey ) {
            if ( DEBUG14 ) {
                console.log((ddbg()), "userid: ", userid, " key: ", key, " val: ", val);
            }
            if ( typeof val === "object" ) {
                updated_val = processCustom(val, updated_val);
            } else if ( typeof val === "string" ) {
                var lines = decodeURI2(val);
                if ( lines ) {
                    updated_val = processCustom(lines, updated_val);
                }
            }
            break;
        }
    }
   
    if ( DEBUG14 ) {
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
                    // custom_val[subid] = "TEXT::" + content;
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
            if ( array_key_exists("time", custom_val) && ( array_key_exists("fmt_time", custom_val) || array_key_exists("tzone", custom_val) ) ) {
                var tz = custom_val["tzone"] || 0;
                var tfmt = custom_val["fmt_time"] || "";
                custom_val["time"] = getFormattedTime(tfmt, d, tz);
            }
        } catch (e) {
            console.log((ddbg()), "error - setting custom date format for clock");
        }
        
        if ( DEBUG14 ) {
            console.log((ddbg()), "companion: ", companion, " customized tile: ", custom_val);
        }
        return custom_val;
    }
}

// this little gem makes sure items are in the proper order
function setValOrder(val) {
    const order = {"name": 1, "battery": 2, "color": 3, "switch": 7, "momentary": 7, "presence": 7,
                   "contact": 9, "door": 8, "garage":8, "motion": 9, "themode": 10,  
                   "make": 11, "modelName":12, "modelYear": 13, "vehiclecolor": 14, "nickName": 15,
                   "coolingSetpoint": 11, "heatingSetpoint": 12,
                   "thermostatMode": 21, "thermostatFanMode": 22, 
                   "thermostatSetpoint": 31, "thermostatOperatingState": 32, "humidity": 33, "thermostat": 34,
                   "mileage": 21, "longitude": 22, "latitude": 23, "distanceToEmpty": 24, 
                   "fuelLevel_value": 31,
                   "trackDescription": 11, "trackImage": 12, "currentAlbum": 13, 
                   "mediaSource": 14, "currentArtist": 15, "playbackStatus": 16, 
                   "_mute": 17, "_muteGroup": 17, "_unmute": 18, "_unmuteGroup": 18, "_volumeDown": 19, "_volumeUp": 20, 
                   "_previousTrack": 21, "_pause": 22, "_play": 23, "_stop": 24, "_nextTrack": 25,
                   "_number_0":60, "_number_1":61, "_number_2":62, "_number_3":63, "_number_4":64, 
                   "_number_5":65, "_number_6":66, "_number_7":67, "_number_8":68, "_number_9":69, 
                   "onlevel": 150, "level": 151, "volume": 152, "colorTemperature": 153, "hue": 141, "saturation": 142, "position": 152,
                   "allon": 41, "alloff": 42, "count": 148, "duration": 149, "deltaT": 149,
                   "temperature": 7, "feelsLike":8, "weatherIcon":20, "forecastIcon":21 };

    function getComp(vala) {
        var comp;
        if ( array_key_exists(vala, order) ) {
            comp = order[vala];
        } else if ( vala.startsWith("_number_") ) {
            comp = 60;
        } else if ( vala.startsWith("_") ) {
            comp = 140;
        } else if ( vala.startsWith("user_") ) {
            comp = 140;
        } else if ( vala.startsWith("event_") ) {
            comp = 200;
        } else {
            comp = 100;
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

function processHubMessage(userid, hubmsg, newST) {
    // loop through all devices tied to this message for any hub
    // push info to all things that match
    // we don't know the thing types so we have to check all things
    // this uses the format defined in the HousePanel.groovy file
    // that was also used in the old housepanel.push app
    var subid = hubmsg['change_attribute'];
    var hubmsgid = hubmsg['change_device'].toString();
    var change_type = hubmsg["change_type"];
    var value = hubmsg['change_value'];
    if ( DEBUG12 ) {
        console.log( (ddbg()), "processHubMessage - userid: ", userid, " hubmsg: ", hubmsg);
    }

    var pvalue;
    // pvalue[subid] = hubmsg['change_value'];

    // deal with presence tiles
    if ( hubmsg['change_value']==="not present" ) {
        hubmsg['change_value'] = "absent";
    }

    // update all devices from our list belonging to this user
    // the root device values are updated in the DB which causes all instances to update when pushClient is called below
    // all links are handled by code in the js updateTile function
    // var devid = null;

    if ( hubmsgid.indexOf("%") !== -1 ) {
        var conditions = "userid = " + userid + " AND deviceid LIKE '" + hubmsgid+"'";
    } else {
        conditions = "userid = " + userid + " AND deviceid = '" + hubmsgid+"'";
    }
    mydb.getRows("devices","*", conditions)
    .then(devices => {

        if ( !devices ) { return; }

        devices.forEach(function(device) {

            if ( device.pvalue && device.pvalue!=="undefined" ) {
                pvalue = decodeURI2(device.pvalue);
                if ( !pvalue ) { pvalue = {}; }
            } else {
                pvalue = {};
            }

            // handle colors - now we do this in the hub app
            // if ( array_key_exists("color",pvalue) && (subid==="hue" || subid==="saturation" || subid==="level") ) {
            //     var h = Math.round((parseInt(pvalue["hue"]) * 360) / 100);
            //     var s = Math.round(parseInt(pvalue["saturation"]));
            //     var v = Math.round(parseInt(pvalue["level"]));
            //     var color = hsv2rgb(h, s, v);
            //     if ( color ) {
            //         pvalue["color"] = color;
            //     }
            //     pvalue[subid] = value;

            // handle special case where groovy pushes an array for color changes
            if ( subid==="color" && is_array(value) ) {
                pvalue["hue"] = value[0];
                pvalue["saturation"] = value[1];
                pvalue["level"] = value[2];
                pvalue["color"] = value[3];
            // } else if ( subid==="object" && is_object(value) ) {
            //     for (var key in value) {
            //         pvalue[key] = value[key];
            //     }
            //     subid = Object.keys(value)[0];
            } else {
                pvalue[subid] = value;
            }

            // increment the count if this is not the inverse of a turn on action
            var d = new Date();
            if ( array_key_exists("duration",pvalue) && array_key_exists("deltaT",pvalue) ) {
                if ( pvalue[subid]==="on" || pvalue[subid]==="active" || pvalue[subid]==="present" || pvalue[subid]==="open" || pvalue[subid]==="unlocked" ) {
                    if ( pvalue.deltaT > 0 ) {
                        pvalue.duration = parseFloat(pvalue.duration);
                        if ( isNaN(pvalue.duration) ) { pvalue.duration = 0.0; }
                        pvalue.duration += (d.getTime() - pvalue.deltaT) / 60000.0;
                        pvalue.duration = (Math.round(pvalue.duration*10.0)/10.0).toString();
                    }
                    pvalue.deltaT = d.getTime();
                    if ( pvalue.count ) {
                        var n = parseInt(pvalue.count);
                        if ( isNaN(n) ) { 
                            n = 1; 
                        } else {
                            n++;
                        }
                        pvalue.count = n.toString();
                    } else {
                        pvalue.count = "1";
                    }
                } else {
                    pvalue.duration = parseFloat(pvalue.duration);
                    if ( isNaN(pvalue.duration) ) { pvalue.duration = 0.0; }
                    if ( pvalue.deltaT > 0 ) {
                        pvalue.duration += (d.getTime() - pvalue.deltaT) / 60000.0;
                    }
                    pvalue.duration = (Math.round(pvalue.duration*10.0)/10.0).toString();
                    pvalue.deltaT = 0;
                }
            }
            var swtype = device.devicetype;

            // set the event string to this time
            var timestr = d.toLocaleDateString() + " " +  d.toLocaleTimeString();
            if ( pvalue["event_3"] ) { pvalue["event_4"] = pvalue["event_3"]; }
            if ( pvalue["event_2"] ) { pvalue["event_3"] = pvalue["event_2"]; }
            if ( pvalue["event_1"] ) { pvalue["event_2"] = pvalue["event_1"]; }
            if ( typeof pvalue[subid] === "string" && pvalue[subid].length < 15 ) {
                pvalue["event_1"] = timestr + " " + subid + " " + pvalue[subid];
            } else {
                pvalue["event_1"] = timestr + " " + subid;
            }

            if ( DEBUG12 ) {
                console.log( (ddbg()), "processHubMessage - hubmsgid: ", hubmsgid, " swtype: ", swtype, " subid: ", subid, " pvalue: ", pvalue);
            }

            // update the DB
            device.pvalue = encodeURI2(pvalue);
            mydb.updateRow("devices", device, "userid = " + userid + " AND id = "+device.id)
            .then( res => {
                if ( DEBUG12 ) {
                    console.log( (ddbg()), "processHubMessage - db update: ", res);
                }
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
            });

            // handle special audio updates
            if ( swtype==="audio" || swtype==="sonos" || pvalue.audioTrackData ) {
                if ( !pvalue.audioTrackData || objCount(pvalue.audioTrackData)===0 ) {
                    pvalue.audioTrackData = {
                        title: "",
                        artist: "",
                        album: "",
                        albumArtUrl: GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png",
                        mediaSource: ""
                    };
                }
                pvalue = translateAudio(pvalue);
            } else if ( swtype==="music" || pvalue.trackData ) {
                pvalue = translateMusic(pvalue);
            } else if ( swtype==="weather" ) {
                pvalue = translateWeather("Weather", pvalue);
            } else {
                pvalue = translateObjects(pvalue);
            }

            pushClient(userid, hubmsgid, swtype, subid, pvalue);
            pvalue.subid = subid;
            processRules(userid, device.id, hubmsgid, swtype, subid, pvalue, "processMsg");
            delete pvalue.subid;

        });
        return devices;
    })
    // .then(devices => {
    //     if ( DEBUG12 ) {
    //         console.log( (ddbg()), "processHubMessage - hubmsg: ", hubmsg, " devices: ", devices);
    //     }
    // })
    .catch(reason => {
        console.log( (ddbg()), "processHubMessage - DB error: ", reason);
    });
}

// this function handles processing of all websocket calls from ISY
// used to keep clients in sync with the status of ISY operation
// because ISY hubs are local, this function must be invoked locally
// this magic is handled by the hpconnect.js helper app user must run
function processIsyXMLMessage(userid, isymsg) {
    xml2js(isymsg, function(err, result) {
        if ( !err && result.Event ) {
            var control = result.Event.control;
            var action = result.Event.action;
            var node = result.Event.node;
            var eventInfo = result.Event.eventInfo;
            var jsondata = {control: control, action: action, node: node, eventInfo: eventInfo};
            processIsyMessage(userid, jsondata);
        }
    });
}

function processIsyMessage(userid, jsondata) {
    var newval;
    var pvalue;
    var d = new Date();
    var timestr = d.toLocaleDateString() + " " +  d.toLocaleTimeString();

    if ( jsondata ) {
        var control = jsondata.control;
        var action = jsondata.action;
        var node = jsondata.node;
        var eventInfo = jsondata.eventInfo;

        var uom;
        if ( DEBUG9 || DEBUGisy ) {
            console.log( (ddbg()), "ISY event: ", jsonshow(jsondata) );
        }

        if ( is_array(node) && node.length && node[0]!=="" &&
                is_array(control) && control.length && control[0]!=="" &&
                action[0] && action[0]["$"] && action[0]["_"] ) 
        {
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
                        pvalue = decodeURI2(device.pvalue);
                        if ( !pvalue ) {
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

                if ( array_key_exists("duration",pvalue) && array_key_exists("deltaT",pvalue) ) {
                    if ( subid==="level" || subid==="position" || pvalue[subid]==="on" || pvalue[subid]==="DON" ) {
                        if ( pvalue.deltaT > 0 ) {
                            pvalue.duration = parseFloat(pvalue.duration);
                            if ( isNaN(pvalue.duration) ) { pvalue.duration = 0.0; }
                            pvalue.duration += (d.getTime() - pvalue.deltaT) / 60000.0;
                            pvalue.duration = (Math.round(pvalue.duration*10.0)/10.0).toString();
                        }
                        pvalue.deltaT = d.getTime();
                        if ( pvalue.count ) {
                            var n = parseInt(pvalue.count);
                            if ( isNaN(n) ) { 
                                n = 1; 
                            } else {
                                n++;
                            }
                            pvalue.count = n.toString();
                        } else {
                            pvalue.count = "1";
                        }
                    } else {
                        pvalue.duration = parseFloat(pvalue.duration);
                        if ( isNaN(pvalue.duration) ) { pvalue.duration = 0.0; }
                        if ( pvalue.deltaT > 0 ) {
                            pvalue.duration += (d.getTime() - pvalue.deltaT) / 60000.0;
                        }
                        pvalue.duration = (Math.round(pvalue.duration*10.0)/10.0).toString();
                        pvalue.deltaT = 0;
                    }
                }

                if ( pvalue["event_3"] ) { pvalue["event_4"] = pvalue["event_3"]; }
                if ( pvalue["event_2"] ) { pvalue["event_3"] = pvalue["event_2"]; }
                if ( pvalue["event_1"] ) { pvalue["event_2"] = pvalue["event_1"]; }
                if ( typeof pvalue[subid] === "string" && pvalue[subid].length < 15 ) {
                    pvalue["event_1"] = timestr + " " + subid + " " + pvalue[subid];
                } else {
                    pvalue["event_1"] = timestr + " " + subid;
                }

                pushClient(userid, bid, "isy", subid, pvalue);

                pvalue.subid = subid;
                processRules(userid, device.id, bid, "isy", subid, pvalue, "processMsg");
                delete pvalue.subid;
                
                // update the DB
                if ( DEBUG9 ) {
                    console.log( (ddbg()), "ISY webSocket updated node: ", bid, " trigger:", control[0], " subid: ", subid, " uom: ", uom, " newval: ", newval, " pvalue: ", pvalue);
                }
                device.pvalue = encodeURI2(pvalue);
                mydb.updateRow("devices", device, "userid = "+userid+" AND devicetype = 'isy' AND id = "+device.id)
                .then( () => {
                })
                .catch( reason => {
                    console.log( (ddbg()), reason);
                });
            }).catch(reason => {
                console.log( (ddbg()), "processIsyMessage - ", reason);
            });

        // set variable changes events
        // include test for an init action which is skipped (kudos to @KMan)
        } else if ( is_array(eventInfo) && eventInfo.length && is_object(eventInfo[0]) && array_key_exists("var", eventInfo[0]) && action && action[0]==="6" ) {
            var varobj = eventInfo[0].var[0];
            var bid = "vars";
            mydb.getRow("devices", "*", "userid = "+userid+" AND devicetype = 'isy' AND deviceid = '"+bid+"'")
            .then(results => {

                if ( !results ) { return; }

                var device = results;
                
                try {
                    if ( device.pvalue && device.pvalue!=="undefined" ) {
                        pvalue = decodeURI2(device.pvalue);
                        if ( !pvalue ) {
                            pvalue = {};
                        }
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

                        // set rolling event time info - convert from europe style time for consistent treatment
                        // unlike programs variables use a 4 digit year, programs use a 2 digit year for some reason
                        if ( pvalue["event_3"] ) { pvalue["event_4"] = pvalue["event_3"]; }
                        if ( pvalue["event_2"] ) { pvalue["event_3"] = pvalue["event_2"]; }
                        if ( pvalue["event_1"] ) { pvalue["event_2"] = pvalue["event_1"]; }
                        if ( array_key_exists("ts", varobj) && is_array(varobj.ts) ) {
                            var lrun = varobj.ts[0];
                            var d2 = new Date(lrun.substring(4,6)+"/"+lrun.substring(6,8)+"/"+lrun.substring(0,4)+lrun.substring(8));
                            var goodts = d2.toLocaleDateString() + " " +  d2.toLocaleTimeString();
                            pvalue["event_1"] = goodts  + " " + subid + " " + pvalue[subid];
                        } else {
                            pvalue["event_1"] = timestr + " " + subid + " " + pvalue[subid];
                        }

                        pushClient(userid, bid, "isy", subid, pvalue);
                        
                        pvalue.subid = subid;
                        processRules(userid, device.id, bid, "isy", subid, pvalue, "processMsg");
                        delete pvalue.subid;

                        // update the DB
                        if ( DEBUG9 ) {
                            console.log( (ddbg()), "ISY webSocket updated node: ", bid, " trigger:", control[0], " varobj: ", varobj, " subid: ", subid, " pvalue: ", pvalue);
                        }
                        device.pvalue = encodeURI2(pvalue);
                        mydb.updateRow("devices", device, "userid = "+userid+" AND devicetype = 'isy' AND id = "+device.id)
                        .then( () => {
                        })
                        .catch( reason => {
                            console.log( (ddbg()), reason);
                        });            
                    }
                } catch (e) {
                    console.log( (ddbg()), "warning - var // processIsyMessage: ", e, device);
                    return;
                }
            })
            .catch(reason => {
                console.log( (ddbg()), "processIsyMessage - ", reason);
            });

        // handle program changes events
        } else if ( is_array(eventInfo) && eventInfo.length && is_object(eventInfo[0]) && array_key_exists("id", eventInfo[0]) && 
                    array_key_exists("r",  eventInfo[0]) && array_key_exists("f",  eventInfo[0]) ) {
            // var idsymbol = parseInt(eventInfo[0]["id"]);
            // idsymbol = idsymbol.toString();
            var idsymbol = eventInfo[0]["id"][0].toString().trim();
            var len = 4 - idsymbol.length;
            var bid = "prog_" + "0000".substring(0,len) + idsymbol;
            var subid = "status";

            mydb.getRow("devices","*", "userid = "+userid+" AND devicetype = 'isy' AND deviceid = '"+bid+"'")
            .then(results => {

                if ( !results ) { return; }

                var device = results;
                try {
                    pvalue = decodeURI2(device.pvalue);
                    if ( !pvalue ) { pvalue = {}; }

                    // convert the date from the goofy 2 digit european year format used for programs
                    var lrun = eventInfo[0]["r"][0];
                    var d = new Date(lrun.substring(2,4)+"/"+lrun.substring(4,6)+"/"+lrun.substring(0,2)+lrun.substring(6));
                    var timestr = d.toLocaleDateString() + " " +  d.toLocaleTimeString();
                    pvalue["lastRunTime"] = timestr;

                    lrun = eventInfo[0]["f"][0];   // 
                    d = new Date(lrun.substring(2,4)+"/"+lrun.substring(4,6)+"/"+lrun.substring(0,2)+lrun.substring(6));
                    timestr = d.toLocaleDateString() + " " +  d.toLocaleTimeString();
                    pvalue["lastFinishTime"] = timestr;

                    // set our rolling event log
                    if ( pvalue["event_3"] ) { pvalue["event_4"] = pvalue["event_3"]; }
                    if ( pvalue["event_2"] ) { pvalue["event_3"] = pvalue["event_2"]; }
                    if ( pvalue["event_1"] ) { pvalue["event_2"] = pvalue["event_1"]; }
                    pvalue["event_1"] = pvalue["lastRunTime"];

                    // use decoder ring documented for ISY_program events
                    if ( array_key_exists("s", eventInfo[0]) ) {
                        var st = eventInfo[0]["s"][0].toString();
                        pvalue["status_"] = st;
                        if ( st.startsWith("2") ) {
                            pvalue["status_"] = "ACTIVE";
                        } else if ( st.startsWith("3") ) {
                            pvalue["status_"] = "INACTIVE";
                        } else if ( st.startsWith("1") ) {
                            pvalue["status_"] = "OFFLINE";
                        } else {
                            pvalue["status_"] = "OFFLINE"
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
                    pushClient(userid, bid, "isy", "lastRunTime", pvalue);

                    pvalue.subid = subid;
                    processRules(userid, device.id, bid, "isy", subid, pvalue, "processMsg");
                    delete pvalue.subid;

                    // update the DB
                    if ( DEBUG9 ) {
                        console.log( (ddbg()), "ISY webSocket updated program: ", bid, " pvalue: ", device);
                    }
                    device.pvalue = encodeURI2(pvalue);
                    mydb.updateRow("devices", device, "userid = "+userid+" AND devicetype = 'isy' AND id = "+device.id)
                    .then( () => {
                    })
                    .catch( reason => {
                        console.log( (ddbg()), reason);
                    });            
                
                } catch(e) {
                    console.log( (ddbg()), "warning - program // processIsyMessage: ", e, device);
                    return;
                }
            }).catch(reason => {
                console.log( (ddbg()), "processIsyMessage - ", reason);
            });

        }
    }
}

function processSonosMessage(userid, hub, req) {
    var devicetype = req.headers['x-sonos-target-type'];
    var namespace = req.headers['x-sonos-namespace'];
    var deviceid = req.headers['x-sonos-target-value'];
    var body = req.body;
    var trigger = "";
    var pvalue = {};
    if ( DEBUGsonos ) {
        console.log( (ddbg()), "Sonos message headers: ", req.headers, "\n body: ", req.body);
    }
    switch (namespace) {

        case "playerVolume":
            trigger = "volume";
            pvalue.volume = body.volume;
            pvalue.mute = body.muted.toString();
        break;

        case "playback":
            trigger = "playbackStatus";
            var pstat = body.playbackState;
            var jlast = pstat.lastIndexOf("_");
            if ( jlast !== -1 ) {
                pvalue.playbackStatus = pstat.substr(jlast+1).toLowerCase();
            } else {
                pvalue.playbackStatus =pstat.toLowerCase();
            }
        break;

        case "playbackMetadata":
            trigger = "audioTrackData";
            var metadata = body;
            var serviceUrl = "";
            pvalue.audioTrackData = {title: "", artist: "", album: "", service: ""};
            if ( metadata.container && metadata.container.imageUrl ) {
                serviceUrl = metadata.container.imageUrl;
                pvalue.audioTrackData.mediaSource = metadata.container.service || "";
            }

            if ( metadata.currentItem && metadata.currentItem.track ) {
                pvalue.audioTrackData.title = metadata.currentItem.track.name || "";
                if ( metadata.currentItem.track.artist ) {
                    pvalue.audioTrackData.artist = metadata.currentItem.track.artist.name || "";
                }
                if ( metadata.currentItem.track.album ) {
                    pvalue.audioTrackData.album = metadata.currentItem.track.album.name || "";
                }
                if ( metadata.currentItem.track.service && metadata.currentItem.track.service.name ) {
                    pvalue.audioTrackData.mediaSource = metadata.currentItem.track.service.name;
                }
                var albumUrl = metadata.currentItem.track.imageUrl || "";

                // use the service URL if it is secure and the album art is not
                if ( albumUrl.startsWith("https://") ) {
                    pvalue.audioTrackData.albumArtUrl = albumUrl;
                } else if ( serviceUrl.startsWith("https://") ) {
                    pvalue.audioTrackData.albumArtUrl = serviceUrl;
                } else {
                    pvalue.audioTrackData.albumArtUrl = GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png";
                }
            }
        break;

        default:
            pvalue = null;
        break;
    }

    // if this event is tied to a player, find it and udpate
    if ( pvalue && trigger && devicetype==="playerId" ) {
        mydb.getRow("devices","*","userid = " + userid + " AND hubid = " + hub.id  + " AND deviceid = '"+deviceid+"'")
        .then(device => {
            // console.log("sub device: ", device);
            if ( device ) {
                updatePlayer(device, trigger, pvalue);
            }
        })
        .catch(reason => {
            console.log( (ddbg()), reason );
        });

    // if tied to a group, find all players with that group and update
    // we take advantage here of the fact that we stored group in the hint
    } else if ( pvalue && trigger && devicetype==="groupId" ) {
        mydb.getRows("devices","*","userid = " + userid + " AND hubid = " + hub.id + " AND hint = '"+deviceid+"'")
        .then(devices => {
            // console.log("sub devices: ", devices);
            if ( devices ) {
                devices.forEach(device => {
                    updatePlayer(device, trigger, pvalue);
                });
            }
        })
        .catch(reason => {
            console.log( (ddbg()), reason );
        });
    }

    if ( DEBUGsonos ) {
        console.log( (ddbg()),"Sonos event processed. pvalue: ", pvalue, 
        "\n namespace: ", namespace, " deviceid: ", deviceid, " deviceytpe: ", devicetype, " trigger: ", trigger);
    }

    function updatePlayer(device, trigger, pvalue) {

        var newpvalue = decodeURI2(device.pvalue);
        if ( !newpvalue ) { newpvalue = {}; }

        for (var skey in pvalue) {
            newpvalue[skey] = pvalue[skey];
        }
        var pvalstr = encodeURI2(newpvalue);
        mydb.updateRow("devices", {pvalue: pvalstr}, "userid = " + userid + " AND id = "+device.id)
        .then( () => {
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
        });
        pushClient(device.userid, device.deviceid, device.devicetype, trigger, pvalue);

        // push new values to all clients and execute rules
        pvalue.subid = trigger;
        processRules(device.userid, device.id, device.deviceid, device.devicetype, trigger, pvalue, "processMsg");
        delete pvalue.subid;

    }

}

function getTimeStr(ifvalue, str, thedate) {
    str = str.toUpperCase();
    var firstcolon = str.indexOf(":");
    var secondcolon = -1;
    if ( firstcolon !== -1 ) {
        var str2 = str.substr(firstcolon+1);
        secondcolon = str2.indexOf(":");
    }
    var amloc = str.indexOf("AM");
    var pmloc = str.indexOf("PM");

    if ( thedate ) {
        var today = thedate;
    } else {
        today = new Date();
    }
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
            lines = decodeURI2(results.configval);
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
            })
            .catch(reason => {
                console.log( (ddbg()), reason );
            });
        }
    })
    .catch(reason => {
        console.log( (ddbg()), "processRules - ", reason);
    });

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
            console.log( (ddbg()), "RULE: id: ", bid, " type: ", thetype, " trigger: ", trigger, " tileid: ", tileid, " userid: ", userid, " rules: ", jsonshow(items) );
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

                                if ( DEBUG11 ) {
                                    console.log( (ddbg()), "rule: rulevalue: ", rulevalue, " ruleparts: ", ruleparts, " pvalue: ", pvalue);
                                }

                                // use this tile's existing value for check if $ symbol given
                                var jv = rulevalue.substring(0,1);
                                var kv = rulevalue.indexOf("$");
                                var rvindex;
                                if ( jv === "$" ) {
                                    rvindex = rulevalue.substr(1);
                                    if ( array_key_exists(rvindex, pvalue) ) {
                                        rulevalue = pvalue[rvindex];
                                    }
                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "rule: rvindex = ", rvindex, " rulevalue= ", rulevalue, " pvalue: ", pvalue);
                                    }

                                // use another tile's existing value for check using @tilenum$fieldname syntax
                                } else if ( jv === "@" && kv !== -1 ) {
                                    var rvtile = rulevalue.substring(1, kv);
                                    rvindex = rulevalue.substr(kv+1);
                                    var rulepvalue = decodeURI2(devices[rvtile].pvalue);
                                    if ( rulepvalue ) {
                                        rulevalue = rulepvalue[rvindex];
                                    } else {
                                        rulevalue = false;
                                    }
                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "rule: rvtile = ", rvtile, " rulevalue= ", rulevalue);
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
                                            var ifpvalue = decodeURI2(devices[ruletileid].pvalue);
                                            if ( ifpvalue ) {
                                                ifvalue = ifpvalue[rulesubid];
                                            } else {
                                                ifvalue = false;
                                            }
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

                        if ( isrule ) {
                            execRules(userid, rulecaller, deviceid, thetype, 1, testcommands, pvalue, hubs, devices);
                        }
                    }
                }

                // execute the statements after if for the cases that pass the logic test above
                // if ( isrule ) {
                //     execRules(userid, rulecaller, deviceid, thetype, 1, testcommands, pvalue, hubs, devices);
                // }

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
                if ( DEBUG11 ) {
                    console.log( (ddbg()), "RULE debug: exec step #", i, " rtileid: ", rtileid, " rsubid: ", rsubid, " rvalue: ", rvalue, " rswattr: ", rswattr, " delay: ", delay);
                }

                if ( rtileid && devices[rtileid] ) {
                    // var idxitems = ridx.split("|");
                    var rswtype = devices[rtileid].devicetype;
                    var rswid = devices[rtileid].deviceid;
                    var hubindex = devices[rtileid].hubid;
                    var rhint = devices[rtileid].hint;
                    var hub = hubs[hubindex];
                    var devpvalue = decodeURI2(devices[rtileid].pvalue);

                    // handle requests for parameters of the trigger tile ($) or destination tile (@)
                    // disable hub calls for this type of rule
                    var trigtype = rvalue.substr(0,1);
                    
                    // look for +n  or  -n  to modify rvalue if rvalue is a number
                    var kpos = rvalue.indexOf("+");
                    var kneg = rvalue.indexOf("-");
                    var rvaldelta = 0;
                    if ( kpos!==-1 && !isNaN(parseInt(rvalue.substr(kpos+1))) ) {
                        rvaldelta = parseInt(rvalue.substr(kpos+1).trim());
                        rvalue = rvalue.substr(0, kpos).trim();
                    }
                    else if ( kneg!==-1 && !isNaN(parseInt(rvalue.substr(kneg+1))) ) {
                        rvaldelta = 0 - parseInt(rvalue.substr(kneg+1).trim());
                        rvalue =  rvalue.substr(0, kneg).trim();
                    }

                    var trigsubid = "";
                    if ( trigtype==="$" || trigtype==="@" ) {
                        trigsubid = rvalue.substr(1);

                        if ( trigtype==="$" && array_key_exists(trigsubid, pvalue) ) {
                            rvalue = pvalue[trigsubid];
                        } else if ( trigtype==="@" && array_key_exists(trigsubid, devpvalue) ) {
                            rvalue = devpvalue[trigsubid];
                        }
                    }

                    // adjust the value with the math qualifier
                    if ( !isNaN(parseInt(rvalue)) ) {
                        rvalue = parseInt(rvalue) + rvaldelta;
                    }

                    // convert back to a string
                    rvalue = rvalue.toString();
                    if ( DEBUG11 ) {
                        console.log((ddbg()), "trigtype: ", trigtype, " trigsubid: ", trigsubid, " rvalue: ", rvalue, " rvaldelta = ", rvaldelta);
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
                    // var companion = "user_"+rsubid;
                    if ( devpvalue ) {
                        var webstr = devpvalue[rsubid];
                        var n = typeof webstr === "string" ? webstr.indexOf("::",2) : -1;
                        if ( n !== -1 ) {

                            var command = webstr.substring(0, n);
                            var linkv = webstr.substring(n+2);
                            // var actionstr = webstr.substring(n+2);
                            if ( DEBUG11 ) {
                                console.log( (ddbg()), "trigger other custom from rule. sib val: ", webstr, " command: ", command);
                            }

                            // take action if it is in a rule
                            if ( command==="GET" || command==="POST" ) {

                                doAction(userid, hub.hubid, hubindex, thingid, rswid, rswtype, rvalue, rswattr, rsubid, rhint, command, linkv);
                                
                                // neuter the hub call so we don't do both and invoke action function
                                hub = null;
                                
                            }

                        // if destination subid isn't found make a user TEXT field (disabled)
                        // } else if ( !array_key_exists(rsubid, devpvalue) ) {
                        //     // addCustom(userid, deviceid, rswid, rswtype, "TEXT", rvalue, rsubid);
                        //     if ( DEBUG11 ) {
                        //         console.log( (ddbg()), "custom field: ", rsubid, " not found in tile: ", devpvalue);
                        //     }
                            // restart all clients to show the newly created field
                            // this only happens the first time the rule is triggered
                            // pushClient(userid, "reload", "main", "/");
                        }
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
                        } else if ( rsubid==="position" ) {
                            rswattr= "position";
                        } else if ( rsubid==="switch" || rswtype==="isy" || (swval!=="on" && swval!=="off") ) {
                            rswattr="";
                        } else if ( !rswattr && rswtype!=="isy" ) {
                            if ( rvalue==="on" || rvalue==="off" ) {
                                var swval = rvalue==="on" ? " off" : " on";
                            } else {
                                swval = "";
                            }
                            rswattr= rswtype + " p_" + rtileid + swval;
                        }

                        // make the hub call now or delayed
                        // if delayed we store the handle in our rules array so that
                        // should the same rule come along again we cancel this one first
                        // this way delay light on and off will stay on if trigger keeps happening
                        if ( DEBUG11 ) {
                            console.log("final rule step: id=",  rswid, "type=", rswtype, "value=", rvalue, "attr=", rswattr, "subid=", rsubid, " hubid: ", hub.id, " deviceid: ", deviceid);
                        }

                        if ( delay && delay > 0 ) {
                            setTimeout( function() {
                                try {
                                    callHub(userid, hub.id, rswid, 0, rswtype, rvalue, rswattr, rsubid, rhint, true);
                                } catch (e) {
                                    console.log( (ddbg()), "error calling hub from rule for userid: ", userid, " hub.id, rswid,rswtype,rvalue,rsattr,rsubid,rhint: ", hub.id, rswid, rswtype, rvalue, rswattr, rsubid, rhint, " error: ", e);
                                }
                            }, delay);
                        } else {
                            try {
                                callHub(userid, hub.id, rswid, 0, rswtype, rvalue, rswattr, rsubid, rhint, true);
                            } catch (e) {
                                console.log( (ddbg()), "error calling hub from rule for userid: ", userid, " hub.id, rswid,rswtype,rvalue,rsattr,rsubid,rhint: ", hub.id, rswid, rswtype, rvalue, rswattr, rsubid, rhint, " error: ", e);
                            }
                        }
                    }
                }


            }
        }

    }

function pushClient(userid, swid, swtype, subid, body) {
    // send the new results to all clients
    var entry = {};
    entry["id"] = swid || "";
    entry["type"] = swtype;
    entry["trigger"] = subid;
    var pvalue;

    if ( !body || typeof body !== "object" ) {
        pvalue = {};
    } else {
        pvalue = body;
    }

    // create blank object if nothing given
    // if ( !pvalue ) {
    //     pvalue = {};
    // }
        
    // save the result to push to all clients
    entry["value"] = pvalue;

    if ( DEBUG17 ) {
        console.log( (ddbg()), "pushClient: ", jsonshow(entry), "\n userid: ", userid," clients: <<", clients[userid], ">>" );
    }

    // do a push to each client for this user if ready
    if ( clients[userid] ) {
        for (var i=0; i < clients[userid].length; i++) {
            clients[userid][i].sendUTF(JSON.stringify(entry));
        }
    }

}

function queryNewST(hub, deviceid, swtype) {

    var hubEndpt = hub.hubendpt;
    var stheader = {"Authorization": "Bearer " + hub.hubaccess};
    var pvalue = {};

    return _curl(hubEndpt + "/devices/" + deviceid+"/status", stheader, null, "GET")
    .then( body => {

        if ( !body ) { return null; }
        try {
            var jsonStatus = JSON.parse(body);
        } catch (e) {
            console.log( (ddbg()), "error translating device status", e, " body: ", body);
            return e;
        }

        // get all the components - this will typically only have "main"
        var subid;
        if ( jsonStatus && jsonStatus.components && is_object(jsonStatus.components) ) {
            for ( var complabel in jsonStatus.components ) {
                // go through the capabilities
                var capabilities = jsonStatus.components[complabel];

                for ( var cap in capabilities ) {
                    
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
                                    }
                                }
                            }
                        }
                    }
                }

                // add color attribute if hsl is there
                if ( array_key_exists("hue", pvalue) && array_key_exists("saturation",pvalue) && array_key_exists("level",pvalue) ) {
                    var h = Math.round( (pvalue.hue * 360) / 100 );
                    pvalue.hue = Math.round(pvalue.hue);
                    pvalue.saturation = Math.round(pvalue.saturation);
                    pvalue["color"] = hsv2rgb(h, pvalue.saturation, pvalue.level);
                }
            }
        }

        if ( DEBUG20 ) {
            console.log( (ddbg()), "New SmartThings device type: ", swtype, " pvalue: ", pvalue);
        }
        return pvalue;
    });  // end of this device node detail curl callback

}

function callHub(userid, hubindex, swid, thingid, swtype, swval, swattr, subid, hint, inrule) {

    // used to grab responses for ISY hubs
    var isyresp = {};

    // first get the hub from the DB
    return mydb.getRow("hubs","*","userid = "+userid+" AND id = " + hubindex)
    .then(hub => {

        if ( !hub ) { return null; }

        var access_token = hub.hubaccess;
        var endpt = hub.hubendpt;
        var result = "success";
        // var hubid = hub.hubid;

        var valint = parseInt(swval);
        if ( isNaN(valint) ) {
            valint = 50;
        }
        if ( DEBUG8 ) {
            console.log( (ddbg()), "callHub: access: ", access_token, " endpt: ", endpt, " swval: ", swval, " subid: ", subid, " swtype: ", swtype, " attr: ", swattr, " hub: ", hub);
        }

        // reset count if clicked on regardless of hub type
        if ( subid==="count" || subid==="duration" || subid==="deltaT" ) {
            var newval = "0";
            if ( subid==="deltaT" ) {
                var d = new Date();
                newval = d.getTime();                            
            }

            // get counter from DB and update if it is there
            mydb.getRow("devices", "*", "userid = " + userid + " AND hubid = "+hubindex+" AND deviceid = '"+swid+"'")
            .then(subdevice => {
                var pvalue = decodeURI2(subdevice.pvalue);
                pvalue[subid] = newval;
                subdevice.pvalue = encodeURI2(pvalue);
                mydb.updateRow("devices", subdevice, "userid = " + userid + " AND id = "+subdevice.id)
                .then( () => {
                    var body = {};
                    body[subid] = newval;
                    getHubResponse(body);
                })
                .catch(reason => {
                    console.log( (ddbg()), "***warning***", reason );
                });
            })
            .catch(reason => {
                console.log( (ddbg()), "***warning***", reason );
            });
            return "success - " + subid + " reset to " + newval;
        }

        // this function calls the Groovy hub api
        if ( hub.hubtype==="Hubitat" ) {
            var host = endpt + "/doaction";
            var header = {"Authorization": "Bearer " + access_token};
            var nvpreq = {"swid": swid,  
                        "swattr": swattr,
                        "swvalue": swval, 
                        "swtype": swtype};
            if ( subid && subid!=="none" ) { nvpreq["subid"] = subid; }
            curl_call(host, header, nvpreq, false, "POST", function(err, res, body) {
                if ( DEBUG7 ) {
                    console.log( (ddbg()), "curl response: body: ", body, " params: ", nvpreq );
                }
                if ( !err || err===200 ) {
                    if ( !body ) {
                        body = {};
                        body[subid] = swval;
                    }

                    // send info back to hub for quick feedback
                    getHubResponse(body);
                }
            });

        // make the call to the new ST API to control the device clicked on
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
            if ( DEBUG19 ) {
                console.log( (ddbg()), " Calling  new ST API doaction in callHub. subid: ", subid, " swid: ", swid, " swval: ", swval, " swtype: ", swtype, " cap: ", cap );
            }

            // first handle requests to call any function
            var nvpreq;
            var result = mydb.getRow("devices","*","userid = "+userid+" AND deviceid = '"+swid+"'")
            .then(row => {
                
                if ( !row ) {
                    console.log( (ddbg()),"error - DB read error in callHub for NewSmartThings hub action, user: ", userid," deviceid: ", swid);
                    return "error - DB read errror";
                }
                
                // retrieve the current pvalue of the item clicked on
                var devicepval = row["pvalue"];
                presult = decodeURI2(devicepval);
                if ( presult ) {
                    var curval = presult[subid];
                } else {
                    curval = "off";
                }
        
                // handle commands for switches and doors
                // the majority of all calls will be of this type
                if ((subid==="switch" && (swval==="on" || swval==="off")) || 
                    (subid==="door" && (swval==="open" || swval==="close")) ||
                    (subid==="lock" && (swval==="unlock" || swval==="lock")) ) {
                    nvpreq = {"commands": [ { component:"main", capability: cap, command: swval, arguments: [] } ] };
                    var astat = swval;
                    if ( astat==="close" ) { astat = "closed"; }
                    else if ( astat==="lock" ) { astat = "locked"; }
                    else if ( astat==="unlock" ) { astat = "unlocked"; }
                    presult[subid] = astat;
                               
                } else if ( swtype==="location" && subid.substr(0,1)==="_" ) {

                    var modename = subid.substr(1);
                    var modeId = presult[modename];
                    var host = endpt + "/v1/locations/" + swid + "/modes/current";
                    var modeval = {"modeId": modeId};
                    _curl(host, header, modeval, "PUT")
                    .then( () => {
                        // set the mode and handle resposne
                        presult.themode = modename;
                        getHubResponse(presult);
                    });
                    return "success";

                // support toggle commands
                } else if ( subid==="switch" && swval==="toggle" ) {

                    swval = curval==="off" ? "on" : "off";
                    nvpreq = {"commands": [ { component:"main", capability: "switch", command: swval, arguments: [] } ] };
                    presult[subid] = swval;
            
                // handle slider light levels
                } else if ( subid==="level" ) {
                    swval = valint;
                    nvpreq = {"commands": [ { component:"main", capability: "switchLevel", command: "setLevel", arguments: [swval] } ] };
                    presult[subid] = swval;
                
                // handle slider volume levels
                } else if ( subid==="volume" ) {
                    swval = valint;
                    nvpreq = {"commands": [ { component:"main", capability: "audioVolume", command: "setVolume", arguments: [swval] } ] };
                    presult[subid] = swval;

                } else if ( subid==="colorTemperature" ) {
                    swval = valint;
                    nvpreq = {"commands": [ { component:"main", capability: "colorTemperature", command: "setColorTemperature", arguments: [swval] } ] };
                    presult[subid] = swval;
            
                // handle midway setting for shades - also will work for dimmer light levels
                } else if ( subid==="_presetPosition" ) {
                    nvpreq = {"commands": [ { component:"main", capability: "windowShade", command: "presetPosition", arguments: [] } ] };
            
                // process color swaps
                // the color UI send hue in the proper 0 - 360 range unlike the hub which stores in 0 - 100 range
                } else if ( subid==="color" && swval.startsWith("hsl(") && swval.length==16 ) {
                    var hue = swval.substring(4,7);
                    hue= parseInt(hue);
                    var saturation = swval.substring(8,11);
                    saturation = parseInt(saturation);
                    var v = swval.substring(12,15);
                    v = parseInt(v);
                    // var cargs = {hex: swattr, switch: "on"};
                    var cargs = {hue: hue, saturation: saturation, level: v, switch: "on"};
                    nvpreq = {"commands": [ { component:"main", capability: "colorControl", command: "setColor", arguments: [cargs] } ] };
                    var hex = hsv2rgb(hue, saturation, v);
                    presult.color = hex; // swattr;
                    presult.hue = Math.round((hue * 100) / 360);
                    presult.saturation = saturation;
                    presult.level = v;

                // process the thermostat commands
                } else if ( subid==="coolingSetpoint-up" ) {
                    nvpreq = getUpDownInfo("thermostatCoolingSetpoint", "setCoolingSetpoint", 1);
                    presult.coolingSetpoint = swval;

                } else if ( subid==="heatingSetpoint-up" ) {
                    nvpreq = getUpDownInfo("thermostatHeatingSetpoint", "setHeatingSetpoint", 1);
                    presult.heatingSetpoint = swval;

                } else if ( subid==="coolingSetpoint-dn" ) {
                    nvpreq = getUpDownInfo("thermostatCoolingSetpoint", "setCoolingSetpoint", -1);
                    presult.coolingSetpoint = swval;

                } else if ( subid==="heatingSetpoint-dn" ) {
                    nvpreq = getUpDownInfo("thermostatHeatingSetpoint", "setHeatingSetpoint", -1);
                    presult.heatingSetpoint = swval;

                } else if ( subid==="_volumeUp" || subid==="_groupVolumeUp" ) {
                    nvpreq = getUpDownInfo("audioVolume", "setVolume", 5);
                    presult.volume = swval;

                } else if ( subid==="_volumeDown" || subid==="_groupVolumeDown" ) {
                    nvpreq = getUpDownInfo("audioVolume", "setVolume", -5);
                    presult.volume = swval;

                } else if ( subid==="hue-up" ) {
                    nvpreq = getUpDownInfo("hue", "setHue", 5);
                    presult.hue = swval;

                } else if ( subid==="hue-dn" ) {
                    nvpreq = getUpDownInfo("hue", "setHue", -5);
                    presult.hue = swval;

                } else if ( subid==="saturation-up" ) {
                    nvpreq = getUpDownInfo("saturation", "setSaturation", 5);
                    presult.saturation = swval;

                } else if ( subid==="saturation-dn" ) {
                    nvpreq = getUpDownInfo("saturation", "setSaturation", -5);
                    presult.saturation = swval;

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
                    presult.coolingSetpoint = swval;

                } else if ( (swval==="heat" || swval==="heatingSetpoint") && !isNAN(parseInt(swattr)) ) {
                    swval = parseInt(swattr);
                    nvpreq = {"commands": [ { component:"main", capability: "heatingSetpoint", command: "setHeatingSetpoint", arguments: [swval] } ] };
                    presult.heatingSetpoint = swval;

                // parse the music commands
                // reverse of translateAudio
                // audiomap = {"title": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                // "albumArtUrl": "trackImage", "mediaSource": "mediaSource"};
                } else if ( subid==="trackDescription" || subid==="currentArtis" || subid==="currentAlbum" ||
                            subid==="trackImage" || subid==="mediaSource" ) {
                    return queryNewST(hub, swid, swtype).then(presult => {
                        if ( presult && typeof presult === "object" ) {
                            getHubResponse(presult);
                        }
                        return presult;
                    });

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

                // handle refresh command that updates the tile
                } else if ( subid === "_refresh" ) {
                    return queryNewST(hub, swid, swtype).then(pquery => {
                        if ( pquery && typeof pquery === "object" ) {
                            getHubResponse(pquery);
                        }
                        if ( DEBUG20 ) {
                            console.log((ddbg()), "Refresh tile: ", swid," of type: " , swtype, " result: ", pquery);
                        }
                        return pquery;
                    });

                // commands based on "supported" subid settings
                // works for WindowShade for example
                } else if ( subid.startsWith("supported") && (subid.indexOf("Commands")!== -1) ) {
                   if ( cap === subid ) {
                        ipos = subid.indexOf("Commands");
                        cap = subid.substr(9,1).toLowerCase() + subid.substring(10,ipos);
                    }
                    nvpreq = {"commands": [ { component:"main", capability: cap, command: swval, arguments: [] } ] };

                // direct commands processed here - setting presult to false skips the results push below
                } else if ( subid.startsWith("_") ) {
                    var thecmd = subid.substr(1);
                    if ( swtype === "audio" ) { cap = "mediaPlayback"; }
                    presult = false;
                    nvpreq = {"commands": [ { component:"main", capability: cap, command: thecmd, arguments: [] } ] };

                // we have an bad command so record in log
                } else {
                    nvpreq = null;
                }


                if ( nvpreq ) {
                    var host = endpt + "/devices/" + swid + "/commands";
                    if ( DEBUG20 ) {
                        console.log( (ddbg()), "Calling New ST callHub with: ", jsonshow(nvpreq) );
                    }

                    _curl(host, header, nvpreq, "POST", function(err, body) {
                        if ( DEBUG20 ) {
                            console.log( (ddbg()), "New ST callHub result: ", err, body);
                        }

                        // if we get an unauthorized message error, refresh the token and try again later
                        if ( err === 401 && inrule!=="refresh" ) {
                            console.log((ddbg()), "Obtaining refresh token for user: ", userid);
                            refreshSTToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, false, function () {
                                callHub(userid, hubindex, swid, thingid, swtype, swval, swattr, subid, hint, "refresh");
                            });
                            return;
                        }

                        // push results immediately to give user a responsive feel
                        if ( presult && typeof presult === "object" ) {
                            presult[subid] = swval;
                            getHubResponse(presult);
                        }
                    });
                    result = "success";
                } else {
                    presult[subid] = swval;
                    getHubResponse(presult);
                    result = "success";
                    console.log( (ddbg()),"Unrecognized command for user: ", userid, " hub: ", hubindex, " deviceid: ", swid, " subid: ", subid, " type: ", swtype, " value: ", swval, " attr: ", swattr, " inrule: ", inrule);
                }
                return result;
            })
            .catch( reason => {
                console.log( (ddbg()), reason );
            });

        } else if ( hub.hubtype==="Sonos" ) {
            var header = {
                "Authorization": "Bearer " + access_token,
                "Content-Type": "application/json"
            };

            switch(subid) {
                case "_pause":
                case "_play":
                case "_stop":
                    var cmd = subid.substr(1);
                    cmd = cmd === "stop" ? "pause" : cmd;
                    var host = endpt + "/v1/groups/" + hint + "/playback/" + cmd;
                    _curl(host, header, "", "POST")
                    .then( () => {
                        var stat = cmd==="play" ? "playing" : "paused";
                        var pvalue = {playbackStatus: stat};
                        getHubResponse(pvalue);
                    });
                break;

                case "_previousTrack":
                    var host = endpt + "/v1/groups/" + hint + "/playback/skipToPreviousTrack";
                    _curl(host, header, "", "POST")
                    .then( () => {
                        updateSonosMeta(endpt, header, hint);
                    });
                break;

                case "_nextTrack":
                    var host = endpt + "/v1/groups/" + hint + "/playback/skipToNextTrack";
                    _curl(host, header, "", "POST")
                    .then( () => {
                        updateSonosMeta(endpt, header, hint);
                    });
                break;

                case "_volumeUp":
                    var param = {volumeDelta: 5};
                    var host = endpt + "/v1/players/" + swid + "/playerVolume/relative";
                    _curl(host, header, param, "POST");
                break;

                case "_volumeDown":
                    var param = {volumeDelta: -5};
                    var host = endpt + "/v1/players/" + swid + "/playerVolume/relative";
                    _curl(host, header, param, "POST");
                break;

                case "groupVolume":
                    var valint = parseInt(swval);
                    if ( isNaN(valint) ) {
                        valint = 50;
                    }
                    var param = {volume: valint};
                    var host = endpt + "/v1/groups/" + hint + "/groupVolume";
                    _curl(host, header, param, "POST");
                break;

                case "volume":
                    var valint = parseInt(swval);
                    if ( isNaN(valint) ) {
                        valint = 50;
                    }
                    var param = {volume: valint};
                    var host = endpt + "/v1/players/" + swid + "/playerVolume";
                    _curl(host, header, param, "POST");
                break;
                    
                case "_mute":
                case "_unmute":
                    var mybool = (subid === "_mute");
                    var param = {muted: mybool};
                    var host = endpt + "/v1/players/" + swid + "/playerVolume";
                    _curl(host, header, param, "POST");
                break;

                case "currentAlbum":
                case "currentArtist":
                case "trackImage":
                case "mediaSource":
                case "trackDescription":
                    updateSonosMeta(endpt, header, hint);
                break;
            }

        // implement the functions supported as described in the postman collection
        // but only the things that start with an underscore invoke the api call
        } else if ( hub.hubtype==="Ford" || hub.hubtype==="Lincoln" ) {

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
                    pushClient(userid, swid, swtype, subid, {commandStatus: ""});
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
                    pushClient(userid, swid, swtype, subid, {commandStatus: "RUNNING"});

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

            var buff = Buffer.from(access_token);
            var base64 = buff.toString('base64');
            var isyheader = {"Authorization": "Basic " + base64};
            var cmd;
    
            // fix up isy devices
            if ( swval==="on" ) { swval = "DON"; }
            else if ( swval==="off" ) { swval = "DOF"; }
    
            // set default subid so api calls will work
            if ( !subid ) {
                subid = "switch";
            }

            // get counter from DB and update if it is there
            mydb.getRow("devices", "*", "userid = " + userid + " AND hubid = "+hubindex+" AND deviceid = '"+swid+"'")
            .then(subdevice => {
                var pvalue = decodeURI2(subdevice.pvalue);
                // pvalue[subid] = newval;
                // subdevice.pvalue = encodeURI2(pvalue);
    
                switch(subid) {
    
                    case "level":
                        // for now semd both level commands since either could be expected
                        // one is for Insteon other is for Polyglot nodes
                        // later we will flag this in the item
                        var cmd1 = "/nodes/" + swid + "/cmd/SETLVL/" + swval;
                        isyresp["level"] = swval;
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
                        var cmd3 = "/nodes/" + swid + "/set/OL/" + irange;
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
                                var currentval = pvalue[subid];
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
                        if ( hint==="ISY_variable" && subid.startsWith("Int_") ) {
                            // get the real subid that the arrows are pointing toward
                            var intvar = parseInt(swval);
                            if ( !isNaN(intvar) ) {
                                if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
                                    var varnum = subid.substr(4, subid.length-7);
                                    var realsubid = subid.substr(0, subid.length-3);
                                    intvar = subid.endsWith("-up") ? intvar + 1 : intvar - 1;
                                } else {
                                    varnum = subid.substr(4);
                                    realsubid = subid;
                                    // intvar++;
                                }
                                cmd = "/vars/set/1/" + varnum + "/" + intvar.toString();
                                isyresp[realsubid] = intvar.toString();
                                curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                            } else {
                                result = "error - Int variable setting invalid: " + swval;
                            }
        
                        } else if ( hint==="ISY_variable" && subid.startsWith("State_") ) {
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
                                    // intvar++;
                                    prec = parseInt(pvalue["prec_State_"+varnum]);
                                    if ( ! isNaN(prec) && prec > 0 ) {
                                        var pow10 = Math.pow(10,prec);
                                        intvar = Math.round(intvar*pow10) / pow10;
                                    }
                                }
                                cmd = "/vars/set/2/" + varnum + "/" + intvar.toString();
                                isyresp[realsubid] = intvar.toString();
                                curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                            } else {
                                result = "error - State variable setting invalid: " + swval;
                            }
        
                        // run commands
                        } else if ( hint==="ISY_program" ) {
                            const progarr = ["run","runThen","runElse","stop","enable","disable"];
                            if ( progarr.includes(subid) ) {
                                var progid = subdevice.deviceid;
                                progid = progid.substring(5);
                                cmd = "/programs/" + progid + "/" + subid;
                                curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                            } else {
                                result = "error - program: " + subid + " not supported for ISY programs";
                            } 
                        } else {
                            // try setting a property
                            try {
                                cmd = "/nodes/" + swid + "/set/" + subid + "/" + swval;
                                // isyresp[subid] = swval;
                                curl_call(endpt + cmd, isyheader, false, false, "GET", getNodeResponse);
                            } catch (e) {
                                console.log( (ddbg()), result, " value: ", swval, " msg: ", e);
                                result = "error - property: " + subid + " not supported for ISY hubs";
                            }
                        }
                    // end of switch
                }
    
            })
            .catch(reason => {
                console.log( (ddbg()), "callHub ISY - failed to get device: ", reason, "\n swid: ", swid, " subid: ", subid);
                result = null;
            });
        };
        return result;
    })
    .catch(reason => {
        console.log( (ddbg()), "callHub ISY - failed to get hubs: ", reason);
        return null;
    });

    // --------------------- end of callHub commands ------------------------------
    // supporting sub-functions are below
    // ----------------------------------------------------------------------------

    function updateSonosMeta(endpt, header, hint) {
        var namehost = endpt + "/v1/groups/" + hint + "/playbackMetadata";
        var pvalue = {};
        _curl(namehost, header, "", "GET")
        .then(metabody => {
            try {
                var metadata = JSON.parse(metabody);
            } catch (e) {
                metadata = null;
            }
            var serviceUrl = "";
            var albumUrl = "";
            pvalue.audioTrackData = {
                title: "", artist: "", album: "", service: "",
                albumArtUrl: GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png"
            };
            if ( metadata ) {
                if ( metadata.container ) {
                    serviceUrl = metadata.container.imageUrl || "";
                    pvalue.audioTrackData.mediaSource = metadata.container.service || "";
                }

                if ( metadata.currentItem && metadata.currentItem.track ) {
                    pvalue.audioTrackData.title = metadata.currentItem.track.name || "";
                    if ( metadata.currentItem.track.artist ) {
                        pvalue.audioTrackData.artist = metadata.currentItem.track.artist.name || "";
                    }
                    if ( metadata.currentItem.track.album ) {
                        pvalue.audioTrackData.album = metadata.currentItem.track.album.name || "";
                    }
                    if ( metadata.currentItem.track.service && metadata.currentItem.track.service.name ) {
                        pvalue.audioTrackData.mediaSource = metadata.currentItem.track.service.name;
                    }
                    albumUrl = metadata.currentItem.track.imageUrl || "";

                    // use the service URL if it is secure and the album art is not
                    if ( albumUrl.startsWith("https://") ) {
                        pvalue.audioTrackData.albumArtUrl = albumUrl;
                    } else if ( serviceUrl.startsWith("https://") ) {
                        pvalue.audioTrackData.albumArtUrl = serviceUrl;
                    } else {
                        pvalue.audioTrackData.albumArtUrl = GLB.returnURL + "/media/Electronics/electronics13-icn@2x.png";
                    }
                }
            }
            getHubResponse(pvalue);
        })
        .catch(err => {
            // the curl failed so try refreshing token and repeating
            if ( err && inrule!=="refresh" ) {
                console.log((ddbg()), "Obtaining Sonos refresh token for user: ", userid, " err: ", err);
                refreshSonosToken(userid, hub, hub.hubrefresh, hub.clientid, hub.clientsecret, false);
                return;
            }


        });

    }

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

        fs.writeFileSync("thumbraw.png", body);
        var buff = Buffer.from(body);
        var base64 = buff.toString('base64');
        fs.writeFileSync("thumbnail.png", base64);
    }

    function getHubResponse(body) {
        // update all clients - this is actually not needed if your server is accessible to websocket updates
        // It is left here because my dev machine sometimes doesn't get websocket pushes
        // you can comment this if your server gets pushes reliably
        // leaving it here causes no harm other than processing the visual update twice
        var pvalue;
        try {
            if ( typeof body==="object" ) {
                pvalue = body;
            } else if ( typeof body==="string" ) {
                pvalue = JSON.parse(body);
            } else {
                throw "Invalid object in getHubResponse.";
            }
        } catch (e) {
            console.error( (ddbg()), "failed converting hub call return to JSON object. body: ", body, " error: ", e);
            return;
        }
        if ( !pvalue ) { return; }

        // pluck out just vehicle data and good status for info call
        if ( swtype==="ford" && subid==="_info" && pvalue.vehicle && pvalue.status && pvalue.status==="SUCCESS" ) {
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
                refreshFordToken(userid, hub, false);
            }
        }

        if ( swtype==="audio" || swtype==="sonos" || pvalue.audioTrackData  ) {
            pvalue = translateAudio(pvalue);
        } else if ( swtype==="music" || pvalue.trackData ) {
            pvalue = translateMusic(pvalue);
        } else if ( swtype==="weather" && is_object(pvalue.forecast) ) {
            var thisorigname = pvalue.name || "Weather";
            pvalue = translateWeather(thisorigname, pvalue);
        } else {
            pvalue = translateObjects(pvalue);
        }

        // for save to DB - we must read all the devices and merge the pvalue with existing
        // we only do this for Sonos and Ford since they don't generate subscription events
        // if ( swtype==="ford" || swtype==="sonos" || swtype==="isy" || subid==="count") {
        if ( swtype==="ford" || swtype==="sonos" || swtype==="isy" ) {
            mydb.getRows("devices","*", "userid = " + userid + " AND hubid = "+hubindex + " AND deviceid = '" + swid +"'")
            .then(devices => {
        
                if ( !devices ) { return; }
                var ndev = 0;
                devices.forEach(function(device) {
        
                    if ( device.pvalue && typeof device.pvalue === "string" && device.pvalue!=="undefined" ) {
                        var newpvalue = decodeURI2(device.pvalue);
                        if ( !newpvalue ) {
                            newpvalue = {};
                        }
                        // if ( typeof newpvalue.count === "undefined" ) {
                        //     newpvalue.count = "0";
                        // }
                    }
                    for (var skey in pvalue) {
                        newpvalue[skey] = pvalue[skey];
                    }
                    // pvalue = clone(newpvalue);
                    pushClient(userid, swid, swtype, subid, newpvalue);
                    if ( !inrule && ndev===0 ) {
                        newpvalue.subid = subid;
                        processRules(userid, device.id, swid, swtype, subid, newpvalue, "callHub");
                        delete newpvalue.subid;
                    }
                    ndev++;
    
                    var pvalstr = encodeURI2(newpvalue);
                    mydb.updateRow("devices", {pvalue: pvalstr}, "userid = "+userid+" AND id = "+device.id)
                    .then( res => {
                        if ( DEBUG18 ) {
                            console.log( (ddbg()), res);
                        }
                    })
                    .catch( reason => {
                        console.log( (ddbg()), reason);
                    });        
                });
            }).catch(reason => { console.log( (ddbg()), reason ); } );
        } else {

            // push new values to all clients and execute rules
            pushClient(userid, swid, swtype, subid, pvalue);
            // if ( !inrule ) {
            //     pvalue.subid = subid;
            //     processRules(userid, device.id, swid, swtype, subid, pvalue, "callHub");
            //     delete pvalue.subid;
            // }
        }
     
    }

    // I don't think I need to use this because the ISY pushes a webSocket that I use
    // to do the same thing in the processIsyMessage function
    function getNodeResponse(err, res, body) {
        if ( err ) {
            console.log( (ddbg()), "error calling ISY node: ", err);
        } else {

            xml2js(body, function(xmlerr, result) {
                var rres = result.RestResponse.status[0];
                rres = rres ? rres.toString() : "";
                if ( DEBUGisy ) {
                    console.log( (ddbg()), "rres: ", rres, " swid: ", swid, " swtype: ", swtype, " subid: ", subid, " isyrep: ", isyresp, " call returned: ", UTIL.inspect(result, false, null, false));
                }

                if ( rres === '200' ) {
                    getHubResponse(isyresp);
                }
            });
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

        if ( hub.hubtype==="Hubitat" ) {
            var host = endpt + "/doquery";
            var header = {"Authorization": "Bearer " + access_token};
            var nvpreq = {"swid": swid, "swtype": swtype};
            curl_call(host, header, nvpreq, false, "POST", getQueryResponse);

        // } else if ( hub.hubtype==="ISY" ) {
        //     var buff = Buffer.from(access_token);
        //     var base64 = buff.toString('base64');
        //     var header = {"Authorization": "Basic " + base64};
        //     var cmd = "/nodes/" + swid;
        //     curl_call(endpt + cmd, header, false, false, "GET", getNodeQueryResponse);

        }

    }).catch(reason => {console.log( (ddbg()), "queryHub - ", reason);});
    
    function getQueryResponse(err, res, pvalue) {
        if ( err ) {
            console.log( (ddbg()), "error requesting hub node query: ", err);
        } else {
            if ( DEBUG5 ) {
                console.log( (ddbg()), "doQuery: ", swid, " type: ", swtype, " value: ", pvalue);
            }
            if ( pvalue ) {
                // deal with presence tiles
                if ( pvalue["presence"]==="not present" ) {
                    pvalue["presence"] = "absent";
                }

                // store results back in DB
                var pvaluestr = encodeURI2(pvalue);
                mydb.updateRow("devices", {pvalue: pvaluestr}, "userid = " + userid + " AND id = " + thingid)
                .then( () => {
                })
                .catch( reason => {
                    console.log( (ddbg()), reason);
                });

                // deal with audio tiles
                if ( swtype==="audio" || swtype==="sonos" || pvalue.audioTrackData ) {
                    pvalue = translateAudio(pvalue);
                } else if ( swtype==="music" || pvalue.trackData ) {
                    pvalue = translateMusic(pvalue);
                } else if ( swtype==="weather" ) {
                    var thisorigname = pvalue.name || "Weather";
                    pvalue = translateWeather(thisorigname, pvalue);
                } else {
                    pvalue = translateObjects(pvalue);
                }

                // push results to all clients
                pushClient(userid, swid, swtype, "none", pvalue);
            }
        }
    }

//     function getNodeQueryResponse(err, res, body) {
//         if ( err ) {
//             console.log( (ddbg()), "error requesting ISY node query: ", err);
//         } else {
//             xml2js(body, function(xmlerr, result) {
//                 try {
//                     if ( result ) {
//                         var nodeid = result.nodeInfo.node[0]["address"];
//                         nodeid = fixISYid(nodeid);
//                         if ( nodeid ) {

//                             var props = result.nodeInfo.properties[0].property;

//                             // first read the existing field data to update the json string
//                             // pass to our field updater which does the screen update
//                             mydb.getRow("devices","*","userid = " + userid + " AND deviceid = '"+nodeid+"'")
//                             .then(device => {
//                                 if (device) {
//                                     setIsyFields(userid, nodeid, device, props, true);
//                                 }
//                             }).catch(reason => {console.log("dberror 16 - getNodeQueryResponse - ", reason);});

//                         } else {
//                             throw "Something went wrong reading node from ISY in getNodeQueryResponse";
//                         }
//                     }
//                 } catch(e) { 
//                     console.log( (ddbg()), "error in getNodeQueryResponse: ", e);
//                 }
//             });
//         }

//     }
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

function translateObjects(pvalue) {
    var nvalue = {};
    for  (var tkey in pvalue) {
        var tval = pvalue[tkey];
        if ( typeof tval==="object" ) {
            for (var jtkey in tval ) {
                var jtval = tval[jtkey];
                // expand arrays and objects onto the base
                var newkey = tkey + "_" + jtkey.toString();

                // skip adding an object element if it duplicates an existing one
                if ( typeof jtval!=="object" ) {
                    nvalue[newkey] = jtval;
                }
            }
        } else {
            nvalue[tkey] = tval;
        }
    }
    return nvalue;
}

// function testclick(clktype, clkid) {
//     const infoclicks = [
//         "temperature", "name", "contact", "presence", "motion", "battery",
//         "date","time", "weekday", "tzone", "heatingSetpoint", "coolingSetpoint",
//         "camera", "statusMessage", "numberOfButtons", 
//         "time", "weekday", "date"
//     ];
//     var test = false;
//     if ( clkid.startsWith("_") || clkid.endsWith("-up") || clkid.endsWith("-dn") ) {
//         test = false;
//     } else if ( clktype==="weather" || clkid.startsWith("Int_") || clkid.startsWith("State_") || clkid.startsWith("event_") || in_array(clkid, infoclicks) ) {
//         test = true;
//     }
//     return test;
// }

function doAction(userid, hubid, hubindex, thingid, swid, swtype, swval, swattr, subid, hint, command, linkval) {

    var msg = "success";
    if ( DEBUG7 ) {
        console.log( (ddbg()), "doaction: thingid: ", thingid, " swid: ", swid, " swtype:", swtype, " swval: ", swval, " hubindex: ", hubindex,
                                " hubid: ", hubid, " swattr: ", swattr, " subid: ", subid, " command: ", command);
    }

    // first check for a command
    if ( linkval && command) {

        if ( command==="POST" || command==="PUT" ) {
            // var posturl = linkval;
            var hosturl = url.parse(linkval);
            var posturl = hosturl.origin + hosturl.pathname;
            var parmstr = hosturl.search;
            var parmobj = hosturl.searchParams;
            curl_call(posturl, null, parmobj, false, command, urlCallback);
            msg = "success - command: " + command + " call: " + posturl + " parmstr: " + parmstr + " parmobj: " + parmobj;

        } else if ( command==="GET" ) {
            hosturl = url.parse(linkval);
            posturl = hosturl.href;
            var parmobj = hosturl.searchParams;
            curl_call(posturl, null, parmobj, false, command, urlCallback);
            msg = "success - command: " + command + " call: " + posturl;

        } else if ( command==="TEXT" ) {
            msg = mydb.getRow("devices", "*", "userid = "+userid + " AND deviceid = '"+swid+"' AND hubid = "+hubindex)
            .then(device => {
                if ( device ) {
                    var pvalue =decodeURI2(device.pvalue);
                    if ( pvalue ) {
                        pushClient(userid, swid, swtype, subid, pvalue);
                        pvalue.subid = subid;
                        processRules(userid, device.id, swid, swtype, subid, pvalue, "callHub");
                        delete pvalue.subid;
                        msg = pvalue;
                    } else {
                        msg = "error - null object returned when decoding TEXT command";
                    }
                } else {
                    msg = "error - invalid object value in TEXT command";
                }
                return msg;
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
                return "error - something went wrong with TEXT command";
            });

        } else if ( command==="LINK" ) {
            // processLink(linkval);
            callHub(userid, hubindex, swid, thingid, swtype, swval, swattr, subid, hint, null, false);
            msg = "success - link action executed on device id: " + swid + " device type: " + swtype;
        
        } else if ( command==="RULE" ) {
            if ( !ENABLERULES ) {
                msg = "error - rules are disabled.";
            } else {
                var configkey = "user_" + swid;
                linkval = linkval.toString();
                msg = "success - manually running RULE " + configkey + " " + linkval;
                
                Promise.all( [
                    mydb.getRows("devices", "*", "userid = "+userid),  
                    mydb.getRows("hubs", "*", "userid = "+userid),
                    mydb.getRow("configs","*","userid = "+userid+" AND configkey='"+configkey+"'")
                ] )
                .then(results => {
                    var pvalue;
                    var devices = {};
                    var hubs = {};
                    var dbdevices = results[0];
                    var dbhubs = results[1];
                    var configrow = results[2];

                    for ( var adev in dbdevices ) {
                        var id = dbdevices[adev].id;
                        devices[id] = dbdevices[adev]
                        if ( dbdevices[adev].deviceid === swid ) {
                            pvalue = decodeURI2(dbdevices[adev].pvalue);
                            if ( !pvalue ) { pvalue = {}; }
                        }
                    }
                    for ( var ahub in dbhubs ) {
                        var id = dbhubs[ahub].id;
                        hubs[id] = dbhubs[ahub];
                    }

                    if ( configrow && pvalue ) {
                        var lines = JSON.parse(configrow.configval);
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
                            resolve("success - rule manually executed: " + configrow.configval);
                        } else {
                            reject("error - rule not found for id = " + swid)
                        }
                    } else {
                        reject("error - rule not found for id = " + swid)
                    }
                }).catch(reason => { console.log( (ddbg()), reason ); } );
            }
        }

    } else {
        if ( DEBUG1 ) {
            console.log( (ddbg()), "callHub: ", userid, hubindex, swid, thingid, swtype, swval, swattr, subid, hint);
        }
        callHub(userid, hubindex, swid, thingid, swtype, swval, swattr, subid, hint, null, false);
        msg = "success - hub action executed on device id: " + swid + " device type: " + swtype;
    }
    return msg;

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
        }
        if ( DEBUG13 ) {
            console.log( (ddbg()), "URL callback returned: ", jsonshow(body) );
        }
    }

}

function doQuery(userid, thingid, protocol) {
    var result;

    if ( thingid==="all" || thingid==="fast" || thingid==="slow" ) {

        var rtype = thingid;
        var conditions = "userid = " + userid + " AND refresh = " + rtype;
        result = mydb.getRows("devices","*", conditions)
        .then(devices => {

            // fix up music and weather and add file info
            for ( var i=0; i < devices.length; i++ ) {
                var swid = devices[i]["deviceid"];
                var swtype = devices[i]["devicetype"];
                var devicename = devices[i]["name"];
                var pvalue = decodeURI2(devices[i]["pvalue"]);
    
                // deal with audio tiles
                if ( pvalue ) {
                    if ( swtype==="audio" || swtype==="sonos" || pvalue.audioTrackData ) {
                        pvalue = translateAudio(pvalue);
                    } else if ( swtype==="music" || pvalue.trackData ) {
                        pvalue = translateMusic(pvalue);
                    } else if ( swtype==="weather" ) {
                        var thisorigname = devicename || "Weather";
                        pvalue = translateWeather(thisorigname, pvalue);
                    } else {
                        pvalue = translateObjects(pvalue);
                    }
                    var firstsubid = Object.keys(pvalue)[0];

                    // add in customizations here
                    // if ( configoptions && is_object(configoptions) ) {
                    //     thesensor.value = getCustomTile(userid, configoptions, thesensor.value, bid);
                    //     thesensor.value = returnFile(userid, pname, thesensor.value, thingtype, configoptions);
                    // }
                    pvalue = setValOrder(pvalue);

                    // push result to the clients
                    pushClient(userid, swid, swtype, firstsubid, pvalue);
                }
            }
            return devices;
        }).catch(reason => {
            console.log( (ddbg()), "doQuery - ", reason);
            return null;
        });

    // a specific device is being requested
    // lets get the device info and call its hub function
    } else {

        var conditions = "id = "+thingid + " AND userid = " + userid;
        result = mydb.getRow("devices","*", conditions)
        .then(device => {

            if ( !device ) {
                return "error - invalid device: " + thingid;
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
        }).catch(reason => {
            console.log( (ddbg()), "doQuery - ", reason);
            return null;
        });

    }
    return result;
}

function setOrder(userid, swtype, swval) {
    var result;
    var num = 0;

    if ( swtype==="rooms" ) {

        for ( var k in swval ) {
            var roomid = swval[k].id;
            var updval = { rorder: swval[k]["rorder"], rname: swval[k]["rname"] };
            mydb.updateRow("rooms", updval, "userid = " + userid + " AND id = "+roomid)
            .then(results => {
                if ( results ) {
                    if ( DEBUG6 ) {
                        console.log( (ddbg()),"move room results: ", results.getAffectedItemsCount() );
                    }
                    num++;
                }
            })
            .catch(reason => {
                console.log( (ddbg()), "setOrder - ", reason);
            });
        }
        result = "success - updated order of " + num + " rooms for user = " + userid;

    } else if ( swtype==="things" ) {

        for ( var kk in swval ) {
            var thingid = swval[kk].id;
            // var updval = swval[kk].updval;
            var updval = {tileid: swval[kk].tileid, torder: swval[kk].torder};
            if ( updval ) {
                if ( DEBUG6 ) {
                    console.log((ddbg()),"move tile results: thingid: ", thingid, " updval: ", updval);
                }
                mydb.updateRow("things", updval, "userid = " + userid + " AND id = "+thingid)
                .then(results => {
                    if ( results && swval[kk].position==="relative" ) {
                        num++;
                    }
                })
                .catch( reason => {
                    console.log( (ddbg()), reason);
                });
            }
        }
        result = "success - updated order of things for user = " + userid;

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
            mydb.updateRow("things", thing, "userid = " + userid + " AND id = " + id)
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
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
                return "error - something went wrong";
            });
        } else {
            console.log( (ddbg()), "error - could not find tile: ", tileid, " to move to position: ", top, left, zindex);
            return "error - could not find tile: " + tileid;
        }
    }).catch(reason => {
        console.log( (ddbg()), "setPosition - ", reason);
        return "error - something went wrong";
    });

    return pr;
}

// userid, swid, swtype, rname, hubid, hubindex, roomid, startpos
function addThing(userid, pname, bid, thingtype, panel, hubid, hubindex, roomid, pos) {

    // first get the max order number of the tiles in this room
    // var querystr = "SELECT Max(torder) FROM things WHERE roomid = " + roomid;
    // var promiseResult = mydb.query(querystr)

    var promiseResult = mydb.getRows("configs", "*", "userid = "+userid)
    .then(configoptions => {

        return mydb.getRows("things","torder","roomid = "+roomid)
        .then(result => {
            var maxtorder = 0;
            result.forEach(row => {
                if ( row.torder > maxtorder ) { maxtorder = row.torder; }
            });
            maxtorder++;
            return [configoptions, maxtorder]
        })
        .catch(reason => {
            console.log( (ddbg()), reason );
            return [configoptions, 1];
        });
    })
    .then(arr => {

        var configoptions = arr[0];
        var maxtorder = arr[1];
        // let's retrieve the thing from the database
        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        var fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
        "hubs.id as hubs_id, hubs.hubid as hubs_hubid";
        return mydb.getRow("devices", fields, "devices.userid = "+userid+" AND hubs.hubid='"+hubid+"' AND devices.deviceid='"+bid+"' AND devices.devicetype='"+thingtype+"'", joinstr)
        .then(row => {
            if ( row && is_object(row) ) {

                var device = row;
                var tileid = device["devices_id"];
                var hint = device["devices_hint"];
                var refresh = device["devices_refresh"];
                var pvalue = decodeURI2(device["devices_pvalue"]);
                hubindex = device["hubs_id"];
                var result;
                if ( pvalue ) {                
                    // construct the thing to add to the things list
                    var athing = {userid: userid, roomid: roomid, tileid: tileid, posx: 0, posy: 0, zindex: 1, torder: maxtorder, customname: ""};
                    result = mydb.addRow("things", athing)
                    .then(row => {
                        if ( row ) {

                            // obtain the new id of the added thing
                            var thingid = row.getAutoIncrementValue();

                            // now make the visual tile and return it as a promised value
                            // construct the old things element equivalent but add the unique thingid and roomid fields
                            var thesensor = {id: bid, thingid: thingid, roomid: roomid, type: thingtype, hubnum: hubid, hubindex: hubindex,
                                            hint: hint, refresh: refresh, value: pvalue};
                            var thing = makeThing(userid, pname, configoptions, thingid, tileid, thesensor, panel, 0, 0, 1, "", false, null);
                            if ( DEBUG6 ) {
                                console.log( (ddbg()), "added tile #",tileid," (thingid = ",thingid,") of type: ",thingtype," to page: ",panel,
                                                    " deviceid: ", bid, " hubid: ", hubid, " hubindex: ", hubindex);
                            }
                            return thing;
                        } else {
                            var errmsg = "error - could not create a new device of type " + thingtype + " on page " + panel;
                            console.log( (ddbg()), "addThing - ", errmsg);
                            return errmsg;
                        }
                    })
                    .catch(reason => {
                        console.log( (ddbg()), "addThing - ", reason);
                        return "error - something went wrong";
                    });
        
                } else {
                    result = "error - nothing returned for device in parse for type + " + thingtype + " on page " + panel;
                }
                return result;
            } else {
                return "error - could not find device of type " + thingtype + " in your list of authenticated devices";
            }
        }).catch(reason => {
            console.log( (ddbg()), "addThing - ", reason);
            return "error - something went wrong";
        });

    });
   
    return promiseResult;
}

// this only needs thingid to remove but other parameters are logged
function delThing(userid, bid, thingtype, panel, tileid, thingid) {
    
    return mydb.deleteRow("things","userid = "+userid+" AND id="+thingid)
    .then(result => {
        var msg;
        if ( result ) {
            msg = "removed tile #" + tileid + " deviceid: " + bid + " of type: " + thingtype + " from page: " + panel;
            if ( DEBUG6 ) {
                console.log( (ddbg()), msg);
            }
        } else {
            msg = "error - could not remove tile #" + tileid + " deviceid: " + bid + " of type: " + thingtype + " from page: " + panel;
            console.log( (ddbg()), msg);
        }
        return msg;
    })
    .catch(reason => {
        console.log( (ddbg()), "delThing - ", reason);
        return reason;
    });
}

function delPage(userid, roomid, panel) {

    return mydb.deleteRow("rooms","userid = "+userid+" AND id="+roomid)
    .then(result => {
        var msg;
        if ( result ) {
            msg = "removed room #" + roomid + " of name: " + panel;
        } else {
            msg = "error - could not remove room #" + roomid + " of name: " + panel;
            console.log( (ddbg()), "delPage - ", msg);
        }
        return msg;
    })
    .catch(reason => {
        console.log( (ddbg()), "delPage - ", reason);
        return reason;
    });
}

function addPage(userid, panelid ) {
    var newroom;

    return mydb.getRows("rooms","*", "userid = "+userid+" AND panelid="+panelid)
    .then(rooms => {

        var bigorder = 0;
        if ( rooms ) {
            // go through the existing rooms and get the largest order and check for dup names
            rooms.forEach(function(room) {
                bigorder = room.rorder > bigorder ? room.rorder : bigorder;
            });
            bigorder++;
        } else {
            bigorder = 1;
        }
        var roomname = "Room" + bigorder.toString();
        newroom = {
            userid: userid,
            panelid: panelid,
            rname: roomname,
            rorder: bigorder
        }

        // add room and get default clock in same promise so we have both results
        return Promise.all( [
            mydb.addRow("rooms", newroom),
            mydb.getRow("devices", "*", "userid = "+userid+" AND deviceid = 'clockdigital'")
        ] );
    })
    .then(results => {

        var roomadd = results[0];
        var defclock = results[1];
      
        var roomid = roomadd.getAutoIncrementValue();
        newroom.id = roomid;
        var clock = {
            userid: userid,
            roomid: roomid,
            tileid: defclock.id,
            posy: 0, posx: 0, zindex: 1, torder: 1,
            customname: ""
        };
    
        return mydb.addRow("things", clock)
        .then( () => {
            if ( DEBUG6 ) {
                console.log( (ddbg()), "New room created: ", newroom, " and digital clock added: ", clock);
            }
            return newroom;
        })
        .catch( () => {
            console.log( (ddbg()), "New room created: ", newroom, " but no clock was added");
            return newroom;
        });
    }).catch(reason => {
        console.log( (ddbg()), "addPage - ", reason);
        return "error - " + reason;
    });

}

function getInfoPage(user, configoptions, hubs, req) {
 
    // get the port number
    var currentport = getCookie(req, "pname") || "1:default";
    if ( currentport.substring(1,2)!==":" ) {
        currentport = "Unknown";
    } else {
        currentport = GLB.webSocketServerPort + parseInt(currentport.substring(0,1));
        currentport = currentport.toString();
    }

    var pathname = req.path;
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var usertype = parseInt(user["users_usertype"]);
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
    var fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
    "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
    "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
    "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
    "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
    "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
    var visual = mydb.getRows("devices", fields, "devices.userid = " + userid, joinstr, "hubs.id, devices.name")
    .then(result => {
        // var configoptions = result.configs;
        // var hubs = result.hubs;
        var devices = result;
        return getinfocontents(userid, pname, currentport, configoptions, hubs, devices);
    }).catch(reason => {
        console.log( (ddbg()), "getInfoPage - ", reason);
        return "something went wrong";
    });

    return visual;

    function getinfocontents(userid, pname, currentport, configoptions, hubs, sensors) {
        
        var $tc = "";
        $tc += getHeader(userid, null, skin, true);
        $tc += "<h3>" + GLB.APPNAME + " Information Display</h3>";

        if ( usertype > 1 ) {
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
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("pathname", pathname);
        $tc += hidden("pagename", "info");
        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        $tc += hidden("configsid", JSON.stringify(configs), "configsid");
        $tc += "</form>";
        $tc += "<div class=\"infopage\">";
        $tc += "<div class='bold'>Site url = " + GLB.returnURL + "</div>";
        $tc += "<div class='bold'>Current user = " + uname + " (ID: #" + userid + ")</div>";
        $tc += "<div class='bold'>Displaying panel = " + pname + "</div>";
        $tc += "<div class='bold'>Client on port = " + currentport + "</div>";
        $tc += "<div class='bold'>User email = " + useremail + "</div>";
        // $tc += "<div class='bold'>Skin folder = " + skin + "</div>";
        $tc += "<div class='bold'>" + numhubs + " Hubs defined</div>";
        $tc += "<hr />";
        
        var num = 0;
        hubs.forEach (function(hub) {
            // putStats(hub);
            if ( hub.hubid !== "-1" ) {
                num++;
                $tc += "<div class='bold'>Hub ID #" + num + "</div>";
                var skip = false;
                for ( var hubattr in hub ) {

                    // if ( (hub.hubtype==="NewSmartThings" || hub.hubtype==="Sonos") && 
                    //      (hubattr==="clientid" || hubattr==="clientsecret" || 
                    //       hubattr==="hubendpt" || hubattr==="useraccess" || hubattr==="userendpt") )
                    // {
                    //     skip = true;
                    // } else {
                        $tc += "<div class='wrap'>" + hubattr + " = " + hub[hubattr] + "</div>";
                    // }
                }
                $tc += "<hr />";
            }
        });

        $tc += "</div>";

        if ( clients[userid] && clients[userid].length > 0 ) {
            var str = "<p>Currently connected to " + clients[userid].length + " clients.</p>";
            str = str + "<br><hr><br>";
            for (var i=0; i < clients[userid].length; i++) {
                var port = clients[userid][i].socket.server["_connectionKey"];
                var lenport = port.length;
                port = port.substring(lenport-4);
                if ( port === currentport ) {
                    str = str + "<strong>Client #" + i + " host= " + clients[userid][i].socket.remoteAddress + ":" + port + "</strong><br>";
                } else {
                    str = str + "Client #" + i + " host= " + clients[userid][i].socket.remoteAddress + ":" + port + "<br>";
                }
            }
            str = str + "<br><hr><br>";
            $tc +=  str;
        }

        $tc += "<button id=\"listhistory\" class=\"showhistory\">Show Dev Log</button>";
        $tc += "<div id=\"showhistory\" class=\"infopage hidden\">";
        $tc += "<pre>" + GLB.devhistory + "</pre>";
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
            var pvalue = decodeURI2(thing["devices_pvalue"]);
            var value = "";
            var thingname = "";
            if ( is_object(pvalue) ) {
                for (var key in pvalue ) {
                    var val = pvalue[key];
                    value += " ";
                    if ( key==="name" ) {
                        thingname = val;
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
                if ( value === null ) { value = ""; }
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
                "</td><td class=\"thingname\">" + thingname +
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
                    lines = decodeURI2(val);
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

        $tc += getFooter();
        return $tc;
    }
}

function hubFilters(userid, hubpick, hubs, useroptions, pagename, ncols, isform) {
    // var options = GLB.options;
    // var useroptions = options["useroptions"];
    // var configoptions = options["config"];
    // var $hubs = configoptions["hubs"];

    var thingtypes = getTypes();
    var $tc = "";
    if ( isform ) {
        $tc += "<form id=\"filteroptions\" class=\"options\" name=\"filteroptions\" action=\"#\">";
        $tc += hidden("userid", userid);
        $tc += hidden("pagename", pagename);
        $tc += hidden("returnURL", GLB.returnURL);
    }

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
    var numtypes = objCount(thingtypes);
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

    if ( isform ) {
        $tc+= "</form>";
    }

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
    $tc += hubFilters(userid, hubpick, hubs, useroptions, "main", 3, true);

    $tc += "<div class='scrollvtable fshort'><table class=\"catalog\">";

    // put sensors in an array so we can sort them
    // we dont' need to do this here since we sorted by hubid and name earlier
    sensors = Object.values(sensors);
    sensors = sortedSensors(sensors, "hubs_hubid", "devices_name");

    for ( var i in sensors ) {

        var thing = sensors[i];
        var bid = thing["devices_deviceid"];
        var thingtype = thing["devices_devicetype"];
        var thingname = thing["devices_name"] || "";
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

// remove port since that is now dynamic
function getSocketUrl(hostname) {
    var webSocketUrl = "";
    if ( GLB.returnURL.startsWith("https://") ) {
        var ws = "wss://";
    } else {
        ws = "ws://";
    }
    var icolon = hostname.indexOf(":");
    if ( icolon >= 0 ) {
        webSocketUrl = ws + hostname.substr(0, icolon);
    } else {
        webSocketUrl = ws + hostname;
    }
    return webSocketUrl;
}

function getOptionsPage(user, configoptions, hubs, req) {

    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var mobile = user["users_mobile"];
    var pname = user["panels_pname"];
    var usertype = parseInt(user["users_usertype"]);
    var panelid = user["panels_id"];
    var skin = user["panels_skin"];
    var panelid = user["panels_id"];

    var hostname = req.headers.host;
    var pathname = req.path;

    // get all the things in the various rooms as we do on the main page
    var pr = mydb.getRows("rooms","*", "userid = "+userid+" AND panelid = "+panelid)
    .then(rooms => {
        return rooms;
    })
    .then(rooms => {
        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        var fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
        "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
        "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
        var pr = mydb.getRows("devices",fields,"devices.userid = "+userid, joinstr,"hubs.id")
        .then(devices => {
            return [rooms, devices];
        });
        return pr;
    })
    .then(resarray => {
        var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
        var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
        var fields = "things.id as things_id, things.userid as things_userid, things.roomid as things_roomid, " +
        "things.tileid as things_tileid, things.customname as things_customname, devices.name as devices_name, " +
        "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";        
        var pr = mydb.getRows("things", fields, 
            "things.userid = "+userid+" AND rooms.panelid = " + panelid, [joinstr1, joinstr2], "devices.name")
        .then(things => {
            resarray.push(things);
            return resarray;
        });
        return pr;
    })
    .then(resarray => {
        var pr = mydb.getRows("panels","*", "userid = "+userid)
        .then(panels => {
            resarray.push(panels);
            return resarray;
        });
        return pr;
    })
    .then(resarray => {
        var rooms = resarray[0];
        var devices = resarray[1];
        var things = resarray[2];
        var panels = resarray[3];
        if ( rooms && devices && things ) {
            return renderOptionsPage(rooms, devices, things, panels);
        } else {
            return "error - problem with reading your existing tiles";
        }
    })
    .catch(reason => {
        console.log( (ddbg()), "getOptionsPage - ", reason);
        return "something went wrong";
    });

    return pr;

    function renderOptionsPage(rooms, devices, sensors, panels) {

        // var $fast_timer = getConfigItem(configoptions, "fast_timer") || "0";
        // var $slow_timer = getConfigItem(configoptions, "slow_timer") || "0";
        var $kioskoptions = getConfigItem(configoptions, "kiosk") || "false";
        var $blackout = getConfigItem(configoptions, "blackout") || "false";
        var $ruleoptions = getConfigItem(configoptions, "rules") || "true";
        var timezone = getConfigItem(configoptions, "timezone") || "America/Detroit";
        var phototimer = parseInt(getConfigItem(configoptions, "phototimer"));
        if ( isNaN(phototimer) ) { phototimer = 0; }
        var fcastcity = getConfigItem(configoptions, "fcastcity") || "ann-arbor";
        var fcastregion = getConfigItem(configoptions, "fcastregion") || "Ann Arbor";
        var fcastcode = getConfigItem(configoptions, "fcastcode") || "42d28n83d74";   //  ann-arbor code is 42d28n83d74
        var accucity = getConfigItem(configoptions, "accucity") || "ann-arbor-mi";
        var accuregion = getConfigItem(configoptions, "accuregion") || "us";
        var accucode = getConfigItem(configoptions, "accucode") || "329380";      // ann-arbor-mi code is 329380
        var hubpick = getConfigItem(configoptions, "hubpick") || "all";
        var webSocketUrl = getSocketUrl(hostname);
        var useroptions = getConfigItem(configoptions, "useroptions");
        var specialtiles = getConfigItem(configoptions, "specialtiles");
        var skins = ["housepanel", "modern", "legacyblue"];
        var $tc = "";
        $tc += getHeader(userid, null, null, true);

        // this is the start of the options page that gets sent to processOptions
        $tc += "<button class=\"infobutton fixbottom\">Cancel and Return to HousePanel</button>";
        $tc += "<form id=\"optionspage\" class=\"options\" name=\"options\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

        $tc += hidden("pagename", "options");
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("pathname", pathname);
        $tc += hidden("webSocketUrl", webSocketUrl);
        $tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        $tc += hidden("userid", userid,"userid");
        $tc += hidden("uname", uname,"unameid");
        $tc += hidden("emailid", useremail, "emailid");
        $tc += hidden("panelid", panelid, "panelid");
        $tc += hidden("pname", pname, "pname");

        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        $tc += hidden("configsid", JSON.stringify(configs), "configsid");

        $tc += "<h3>" + GLB.APPNAME + " Options</h3>";
        $tc += "<h3>for user: " + uname + " | " + useremail + "</h3>";
        // $tc += "<h3>on panel: " + pname + "</h3>";
        
        // manage panels here - select existing, remove, or add
        // $tc += "<div class='greeting'>Users can have up to 9 panels, where each panel can be displayed" +
        //        " on any device to give a different look and feel. This is where you add or remove panels." +
        //        " This is also where you can completely remove your account from HousePanel by deleting this user." +
        //        " Note that this action is irreversible and all deleted accounts will result in removing all devices" +
        //        " from the HousePanel system. All active users must have at least one panel, so if you only have one" +
        //        " you will not be able to remove it." +
        //        "</div>";
        $tc += "<div class='greeting'>Select various options for your specific installation." +
               "</div>";

        $tc += "<div class=\"filteroption\">";

        // // users can update their username here
        $tc += "<div><label class=\"optioninp\">Username: </label>";
        $tc += "<input id=\"newUsername\" class=\"optioninp\" name=\"newUsername\" size=\"20\" type=\"text\" value=\"" + uname + "\"/></div>"; 

        // available panels to pick from
        $tc += "<label class =\"optioninp\">Select from list or enter name below:</label>";
            $tc += "<select class=\"optioninp\" id='userpanel' name='userpanel'>"; 
            panels.forEach(panel => {
                const selected = (panel.pname === pname) ? " selected" : "";
                $tc += "<option value='" + panel.id + "'" + selected + ">" + panel.pname  + "</option>";
            });
        $tc += "</select><br/>";
        $tc += "<div><label class=\"optioninp\">Panel Name: </label>";
        $tc += "<input id=\"panelname\" class=\"optioninp\" name=\"panelname\" size=\"20\" type=\"text\" value=\"" + pname + "\"/></div>";
        $tc += "</div>";

        // skins to pick from
        $tc += "<div class=\"filteroption\">";
        $tc += "<label class =\"optioninp\">Select Skin to Use on This Panel:</label>";
        $tc += "<select class=\"optioninp\" id='userskin' name='userskin'>"; 
        skins.forEach(askin => {
            var skinval = "skin-"+askin;
            const selected = (skinval === skin) ? " selected" : "";
            $tc += "<option value='" + skinval + "'" + selected + ">" + askin  + "</option>";
        });
        $tc += "</select></div>";

        // panel passwords
        $tc += "<div class=\"filteroption\">";
        $tc += "<div><label class=\"optioninp\">Panel Password: </label>";
        $tc += "<input id=\"panelPw1\" class=\"optioninp\" name=\"panelPw1\" size=\"20\" type=\"password\" value=\"\"/></div>"; 
        $tc += "<div><label class=\"optioninp\">Confirm Password: </label>";
        $tc += "<input id=\"panelPw2\" class=\"optioninp\" name=\"panelPw2\" size=\"20\" type=\"password\" value=\"\"/></div>"; 
        $tc += "</div>";

        // $tc += "<div class=\"buttongrp\">";
        //     $tc+= "<div id=\"usePanel\" class=\"smallbutton\">Select Panel</div>";
        //     $tc+= "<div id=\"delPanel\" class=\"smallbutton\">Delete Panel</div>";
        //     $tc+= "<div id=\"delUser\" class=\"smallbutton\">Delete User</div>";
        // $tc += "</div>";

        $tc += "<div class=\"filteroption\">";
        $tc += "<label class =\"optioninp\">Options:</label>";
        $tc += "<div><label for=\"kioskid\" class=\"optioninp\">Kiosk Mode: </label>";    
        var $kstr = ($kioskoptions===true || $kioskoptions==="true") ? " checked" : "";
        $tc+= "<input class=\"optionchk\" id=\"kioskid\" type=\"checkbox\" name=\"kiosk\"  value=\"" + $kioskoptions + "\"" + $kstr + "/></div>";
        $tc += "<div><label for=\"ruleid\" class=\"optioninp\">Enable Rules? </label>";
        $kstr = ($ruleoptions===true || $ruleoptions==="true") ? " checked" : "";
        $tc += "<input class=\"optionchk\" id=\"ruleid\" type=\"checkbox\" name=\"rules\"  value=\"" + $ruleoptions + "\"" + $kstr + "/></div>";
        $tc += "<div><label for=\"clrblackid\" class=\"optioninp\">Blackout on Night Mode: </label>";    
        $kstr = ($blackout===true || $blackout==="true") ? " checked" : "";
        $tc+= "<input class=\"optionchk\" id=\"clrblackid\" type=\"checkbox\" name=\"blackout\"  value=\"" + $blackout + "\"" + $kstr + "/></div>";
        $tc+= "<div><label for=\"photoid\" class=\"optioninp\">Photo timer (sec): </label>";
        $tc+= "<input class=\"optioninp\" id=\"photoid\" name=\"phototimer\" type=\"number\"  min='0' max='300' step='5' value=\"" + phototimer + "\" /></div>";
        $tc += "<div><label class=\"optioninp\">Timezone: </label>";
        $tc += "<input id=\"newtimezone\" class=\"optioninp\" name=\"timezone\" size=\"20\" type=\"text\" value=\"" + timezone + "\"/></div>"; 
        // $tc += "<div><label class=\"optioninp\">Fast Timer: </label>";
        // $tc += "<input id=\"newfast_timer\" class=\"optioninp\" name=\"fast_timer\" size=\"20\" type=\"text\" value=\"" + $fast_timer + "\"/></div>"; 
        // $tc += "<div><label class=\"optioninp\">Slow Timer: </label>";
        // $tc += "<input id=\"newslow_timer\" class=\"optioninp\" name=\"slow_timer\" size=\"20\" type=\"text\" value=\"" + $slow_timer + "\"/></div>"; 
        $tc += "</div>";

        $tc += "<div class=\"filteroption\">";
        $tc += "Weather City Selection:<br/>";
        $tc += "<table>";
        $tc += "<tr>";
        $tc += "<td style=\"width:15%; text-align:right\"><label for=\"fcastcityid\" class=\"kioskoption\">Forecast City: </label>";
        $tc += "<br><span class='typeopt'>(for Frame1 tiles)</span></td>";
        $tc += "<td style=\"width:20%\"><input id=\"fcastcityid\" size=\"30\" type=\"text\" name=\"fcastcity\"  value=\"" + fcastcity + "\" /></td>";
        $tc += "<td style=\"width:20%; text-align:right\"><label for=\"fcastregionid\" class=\"kioskoption\">Forcast Region: </label></td>";
        $tc += "<td style=\"width:15%\"><input id=\"fcastregionid\" size=\"20\" type=\"text\" name=\"fcastregion\"  value=\"" + fcastregion + "\"/></td>";
        $tc += "<td style=\"width:15%; text-align:right\"><label for=\"fcastcodeid\" class=\"kioskoption\">Forecast Code: </label></td>";
        $tc += "<td style=\"width:15%\"><input id=\"fcastcodeid\" size=\"20\" type=\"text\" name=\"fcastcode\"  value=\"" + fcastcode + "\"/></td>";
        // $tc += "<br><span class='typeopt'>(for Frame1 tiles)</span></td>";
        $tc += "</tr>";

        $tc += "<tr>";
        $tc += "<td style=\"width:15%; text-align:right\"><label for=\"accucityid\" class=\"kioskoption\">Accuweather City: </label>";
        $tc += "<br><span class='typeopt'>(for Frame2 tiles)</span></td>";
        $tc += "<td style=\"width:20%\"><input id=\"accucityid\" size=\"30\" type=\"text\" name=\"accucity\"  value=\"" + accucity + "\" /></td>";
        $tc += "<td style=\"width:20%; text-align:right\"><label for=\"accuregionid\" class=\"kioskoption\">Accuweather Region: </label></td>";
        $tc += "<td style=\"width:15%\"><input id=\"accuregionid\" size=\"20\" type=\"text\" name=\"accuregion\"  value=\"" + accuregion + "\"/></td>";
        $tc += "<td style=\"width:15%; text-align:right\"><label for=\"accucodeid\" class=\"kioskoption\">AccuWeather Code: </label></td>";
        $tc += "<td style=\"width:15%\"><input id=\"accucodeid\" size=\"20\" type=\"text\" name=\"accucode\"  value=\"" + accucode + "\"/></td>";
        // $tc += "<br><span class='typeopt'>(for Frame2 tiles)</span></td>";
        $tc += "</tr></table></div>";

        $tc += "<div class='greeting'>You can select how many special tiles of each type to include here." +
               " These tiles are used to show special content on your dashboard." +
               "</div>";
        $tc += "<div class=\"filteroption\">";
        $tc += "Specify number of special tiles:<br/>";
        for (var $stype in specialtiles) {
            var $customcnt = parseInt(specialtiles[$stype]);
            if ( isNaN($customcnt) ) { $customcnt = 0; }
            var $stypeid = "cnt_" + $stype;
            $tc+= "<div><label for=\"$stypeid\" class=\"optioninp\"> " + $stype +  " tiles: </label>";
            $tc+= "<input class=\"optionnuminp\" id=\"" + $stypeid + "\" name=\"" + $stypeid + "\" size=\"10\" type=\"number\"  min='0' max='99' step='1' value=\"" + $customcnt + "\" /></div>";
        }
        $tc+= "</div><br/><br/>";


        $tc += "<div class='greeting'>Select which hubs and types of things to show in the table below." +
               " This might be useful if you have a large number of things and/or multiple hubs so you can select ." +
               " just the things here that you care about. Note that all things remain active even if they are not shown." +
               " Note also for ISY hubs, all things are of type \"isy\" so you will not be able to select by type for that hub." +
               "</div>";
        $tc += hubFilters(userid, hubpick, hubs, useroptions, "options", 8, false);

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
        $tc+= "<div class=\"buttonopts\">";
        $tc +='<div id="optSave" class="formbutton">Save</div>';
        $tc +='<div id="optReset" class="formbutton">Reset</div>';
        $tc +='<div id="optCancel" class="formbutton">Cancel</div><br>';
        $tc+= "</div>";
        $tc+= "</form>";
        $tc += getFooter();

        return $tc;
    }

}

function getErrorPage(reason) {
    var tc = "";
    tc += getHeader(0, null, null, true);
    tc += "<h2>HousePanel Error</h2>"
    tc += "<div class=\"error\">You are seeing this because HousePanel experienced an error.";
    tc += "<br><br>Stated reason: " + reason;
    tc += "</div>";
    tc += getFooter();
    return tc;

}

// renders the main page
function getMainPage(user, configoptions, hubs, req, res) {

    var hostname = req.headers.host;
    var pathname = req.path;
    var kioskstr = getConfigItem(configoptions, "kiosk");
    var kioskmode = (kioskstr=="true" || kioskstr==true) ? true : false;
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var defhub = user["users_defhub"];
    var usertype = user["users_usertype"];
    var panelid = user["panels_id"];
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    var alldevices = {};

    console.log(  "\n**********************************************************************************************",
                  "\n", (ddbg()), "Serving pages from: ", GLB.returnURL,
                  "\n**********************************************************************************************");

    // first get the room list and make the header
    var devices_joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
    var devices_fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
        "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
        "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";

    var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
    var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
    var joinstr3 = mydb.getJoinStr("devices","hubid","hubs","id");
    var conditions = "things.userid = "+userid+" AND rooms.panelid = "+panelid;
    var things_fields = "things.id as things_id, things.userid as things_userid, things.roomid as things_roomid, " +
    "things.tileid as things_tileid, things.posy as things_posy, things.posx as things_posx, " +
    "things.zindex as things_zindex, things.torder as things_torder, things.customname as things_customname, " +
    "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
    "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
    "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
    "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
    "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
    "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer, " +
    "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";
    
    Promise.all( [
        mydb.getRows("rooms", "*", "userid = "+userid+" AND panelid = "+panelid, "", "rooms.rorder"),
        mydb.getRows("devices", devices_fields, "devices.userid = " + userid, devices_joinstr, "hubs.hubid, devices.name"),
        mydb.getRows("things",  things_fields, conditions, [joinstr1, joinstr2, joinstr3], "rooms.rorder, things.torder, things.id")
    ])
    .then( results => {
        var rooms = results[0];
        var devices = results[1];
        var things = results[2];
        if ( DEBUG1 ) {
            console.log( (ddbg()), "\n rooms: ", rooms, "\n devices: ", devices, "\n things: ", things);
        }

        // convert array of devices to an array of objects that looks like our old all things array
        // only need it in this form primarily for handling links and rules
        devices.forEach(function(dev) {
            var devid = dev["devices_id"];
            alldevices[devid] = dev;
        });

        var tc = renderMain(configoptions, user, hubs, rooms, alldevices, things);
        res.send(tc);
        res.end();
    })
    .catch(reason => {
        console.log( (ddbg()), reason);
        var tc = getErrorPage();
        res.send(tc);
        res.end();
    });

    // this is the routine that actually draws the page the user sees
    function renderMain(configoptions, user, hubs, rooms, alldevices, things) {
        var tc = "";
        tc += getHeader(userid, pname, skin, false);

        // if new user flag it and udpate to no longer be new
        if ( usertype === 0 ) {
            tc += "<div class=\"greeting\"><strong>Welcome New User!</strong><br/ >";
            tc += "You will need to validate your account via email or txt before proceeding. if you have done this, try refreshing your browser page.";
            tc += "After you validate your eamil you will be able to link your smart home hub using the Hub Auth button below. ";
            tc += "You can also experiment with the default tiles placed in each room that are not tied to a hub. ";
            tc += "When you are done, they can be removed in Edit mode or from the Options page. Click on the ? mark in the upper right corner. ";
            tc += "to access the online manual. Have fun!</div>";
        }
    
        if ( DEBUG1 ) {
            console.log( (ddbg()), "renderMain: ", userid, uname, panelid, pname, usertype, skin, hostname, pathname);
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
            var pagecontent = getNewPage(userid, pname, skin, configoptions, cnt, roomid, roomname, rorder, thingsarray, alldevices);
            cnt += thingsarray.length;
            tc = tc + pagecontent;
        };
 
        // include doc button and panel name
        var displayname = uname ? uname : useremail;
        tc += '<div id="showversion" class="showversion">';
        tc += '<span id="emailname">' + displayname + '</span> | <span id="infoname">' + pname + '</span><span> | V' + GLB.HPVERSION + '</span> | <span id="infoport"></span>';
        tc += '</div>';
        tc += '<div id="showopts"><a href="' +  GLB.returnURL + '/showoptions"><img width="24" height=24 src="media/editgear.png"/></a></div>';
        tc += '<div id="showdocs"><a href="https://www.housepanel.net" target="_blank">?</a></div>';
        // tc += "</div>";

        // end of the tabs
        tc += "</div>";

        // set the websock servername as same as hosted page but different port
        var webSocketUrl = getSocketUrl(hostname);
        
        // include form with useful data for js operation
        tc += "<form id='kioskform'>";
        var erstr =  ENABLERULES ? "true" : "false"
        tc += hidden("enablerules", erstr);

        // save the socket address for use on js side
        // save Node.js address for use on the js side
        tc += hidden("pagename", "main");
        tc += hidden("returnURL", GLB.returnURL);
        tc += hidden("pathname", pathname);
        tc += hidden("webSocketUrl", webSocketUrl);
        tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        tc += hidden("userid", userid, "userid");
        tc += hidden("panelid", panelid, "panelid");
        tc += hidden("skinid", skin, "skinid");
        tc += hidden("emailid", useremail, "emailid");

        // write the configurations without the rules
        var configs = {};

        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        tc += hidden("configsid", JSON.stringify(configs), "configsid");

        // show user buttons if we are not in kiosk mode
        if ( !kioskmode ) {
            tc += "<div id=\"controlpanel\">";
            if ( usertype > 0 ) {
                tc +='<div id="showoptions" class="formbutton">Options</div>';
                tc +='<div id="refreshpage" class="formbutton">Refresh</div>';
                tc +='<div id="userauth" class="formbutton confirm">Hub Auth</div>';
                tc +='<div id="showid" class="formbutton">Show Info</div>';
                tc +='<div id="toggletabs" class="formbutton">Hide Tabs</div>';
                tc +='<div id="blackout" class="formbutton">Blackout</div>';
            }

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

        tc += getFooter();
        return tc;
    }

}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function saveFilters(userid, useroptions, huboptpick) {
    // body = {useroptions: [], huboptpick: "string"}
    if ( DEBUG4 ) {
        console.log( (ddbg()), "filters save request for user: ", userid, useroptions, huboptpick);
    }
    
    if ( is_array(useroptions) ) {
        var filterobj = useroptions;
    } else {
        filterobj = [];
    }

    var updval = {configkey: 'useroptions', configval: JSON.stringify(filterobj)};
    return mydb.updateRow("configs", updval, "userid = " + userid + " AND configkey = 'useroptions'")
    .then( () => {
        if ( huboptpick && typeof huboptpick === "string" ) {
            var updhub = {configkey: 'hubpick', configval: huboptpick};
            mydb.updateRow("configs", updhub, "userid = " + userid + " AND configkey = 'hubpick'")
            .then( () => {
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
            });
        }
        return filterobj;
    })
    .catch( reason => {
        console.log( (ddbg()), reason);
    });
}

// process user options page
function processOptions(userid, panelid, optarray, res) {

    // first get the configurations and things and then call routine to update them
    userid = parseInt(userid);
    panelid = parseInt(panelid);
    if ( DEBUG4 ) {
        console.log( (ddbg()), "userid: ", userid, " panelid: ", panelid);
    }

    // get the hub filters and process them first
    // filteroptions
    var joinstr = mydb.getJoinStr("things","roomid","rooms","id");
    var fields = "things.id as things_id, things.userid as things_userid, things.roomid as things_roomid, " +
        "things.tileid as things_tileid, things.posy as things_posy, things.posx as things_posx, " +
        "things.zindex as things_zindex, things.torder as things_torder, things.customname as things_customname, " +
        "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";

    return Promise.all([
        mydb.getRow("hubs","*","hubid = '-1'"),
        mydb.getRow("users","*","id = "+userid),
        mydb.getRow("panels","*","id = "+panelid),
        mydb.getRows("rooms","*","userid = "+userid+" AND panelid="+panelid),
        mydb.getRows("configs","*","userid = "+userid+" AND configkey NOT LIKE 'user_%'"),
        mydb.getRows("devices","*","userid = "+userid+" AND hint='special'"),
        mydb.getRows("things", fields, "things.userid = "+userid+" AND rooms.panelid = "+panelid, joinstr)
    ])
    .then(results => {
        var hubzero = results[0];
        var user = results[1];
        var panel = results[2];
        var rooms = results[3];
        var configs = results[4];
        var specials = results[5];
        var things = results[6];
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
        return doProcessOptions(optarray, configoptions, hubzero, user, panel, things, rooms, specials);
    })
    .catch(reason => {
        console.log( (ddbg()), "processOptions failed. ", reason);
        return reason;
    });

    function doProcessOptions(optarray, configoptions, hubzero, user, panel, things, rooms, specials) {
        if (DEBUG4) {
            console.log( (ddbg()), "Process Options - Before Processing, panelid: ", panelid);
            console.log( (ddbg()), jsonshow(configoptions) );
            console.log( (ddbg()), jsonshow(hubzero) );
            console.log( (ddbg()), jsonshow(things) );
            console.log( (ddbg()), jsonshow(rooms) );
            console.log( (ddbg()), jsonshow(specials) );
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

        // get old panel info to check for changes
        var oldPanel = panel.pname;
        var oldSkin = panel.skin;

        // force all three to be given for change to happen
        var accucity = "";
        var accuregion = "";
        var accucode = "";
        var fcastcity = "";
        var fcastregion = "";
        var fcastcode = "";
        var newPassword = "";
        var newName = "";
        var newSkin = oldSkin;
        var newPanel = oldPanel;
        var useroptions = [];
        var huboptpick = "-1";

        for (var key in optarray) {
            var val = optarray[key];
            if ( typeof val === "string" ) val = val.trim();

            //skip the returns from the submit button and the flag
            if (key==="options" || key==="api" || key==="useajax"  || key==="userid" || key==="panelid" || key==="webSocketUrl" || key==="returnURL" ||
                key==="pagename" || key==="pathname" || key==="userpanel" || key==="pname" || key==="uname" || key==="panelPw2" ) {
                continue;

            } else if ( key==="newUsername" ) {
                // the \D ensures we start with a non-numerica character
                // and the \S ensures we have at least 2 non-white space characters following
                if ( val && val.match(/^\D\S{2,}$/) ) {
                    newName = val;
                    mydb.updateRow("users",{uname: newName},"id = " + userid);
                }
            } else if ( key==="panelname" ) {
                if ( val && val.match(/^\D\S{2,}$/) ) {
                    newPanel = val;
                }
            } else if ( key==="panelPw1") {
                var pw1 = val;
                var pw2 = optarray["panelPw2"].trim();
                if ( pw1 === pw2 && pw1.match(/^\D\S{5,}$/) ) {
                    newPassword = pw_hash(pw1);
                }
            } else if ( key==="userskin" ) {
                newSkin = val;
            } else if ( key==="useroptions" ) {
                useroptions = val;
            } else if ( key==="huboptpick" ) {
                huboptpick = val;
            } else if ( key==="kiosk") {
                configoptions["kiosk"] = "true";
            } else if ( key==="rules") {
                configoptions["rules"] = "true";
            } else if ( key==="blackout") {
                configoptions["blackout"] = "true";
            } else if ( key==="phototimer" ) {
                configoptions["phototimer"] = val;
            } else if ( key==="timezone") {
                configoptions["timezone"] = val;
            } else if ( key==="fast_timer") {
                configoptions["fast_timer"] = val;
            } else if ( key==="slow_timer") {
                configoptions["slow_timer"] = val;
            } else if ( key==="fcastcity" ) {
                fcastcity = val;
                configoptions["fcastcity"] = val;
            } else if ( key==="fcastregion" ) {
                fcastregion = val;
                configoptions["fcastregion"] = val;
            } else if ( key==="fcastcode" ) {
                fcastcode = val;
                configoptions["fcastcode"] = val;
            } else if ( key==="accucity" ) {
                accucity = val;
                configoptions["accucity"] = val;
            } else if ( key==="accuregion" ) {
                accuregion = val;
                configoptions["accuregion"] = val;
            } else if ( key==="accucode" ) {
                accucode = val;
                configoptions["accucode"] = val;
            
            // handle user selected special tile count
            } else if ( key.substring(0,4)==="cnt_" ) {
                var stype = key.substring(4);
                if ( array_key_exists(stype, specialtiles) ) {
                    var oldcount = specialtiles[stype];
                    var newcount = parseInt(val);
                    if ( isNaN(newcount) ) { newcount = oldcount; }
                    specialtiles[stype] = newcount;
                    configoptions["specialtiles"] = specialtiles;
                    updSpecials(userid, hubzero["id"], stype, newcount, specials);
                }
            
            // made this more robust by checking room name being valid
            } else if ( array_key_exists(key, roomnames) && is_array(val) ) {
                
                // first delete any tile that isn't checked
                var roomid = parseInt(roomnames[key]);
                var maxtorder = 0;
                things.forEach(function(item) {
                    var tnum = item["things_tileid"];
                    if ( item["things_roomid"]===roomid ) {
                        var torder = parseInt(item["things_torder"]);
                        if ( !isNaN(torder) && torder > maxtorder ) { maxtorder = torder; } 
                        if ( ! in_array(tnum, val) ) {
                            mydb.deleteRow("things","id = "+ item["things_id"]);
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
                    }
                });

            }
        }
        
        console.log( (ddbg()), "updated panelid: ", panelid, " userid: ", userid,  " newName: ", newName, " newPassword: ", newPassword, 
                               " newPanel: ", newPanel, " skin: ", newSkin, " useroptions: ", useroptions, " huboptpick: ", huboptpick);
        
        // save the hub filter options
        saveFilters(userid, useroptions, huboptpick);

        // handle the weather codes - write into this users folder
        writeForecastWidget(userid, fcastcity, fcastregion, fcastcode);
        writeAccuWeather(userid, accucity, accuregion, accucode);
        
        var d = new Date();
        var timesig = GLB.HPVERSION + " @ " + d.getTime();
        configoptions["time"] = timesig;
        
        // save the configuration parameters in the main options array
        for ( var key in configoptions ) {  
            if ( typeof configoptions[key] === "object" ) {
                var configstr = JSON.stringify(configoptions[key]);
            } else {
                configstr = configoptions[key];
            }
            var config = {userid: userid, configkey: key, configval: configstr};
            mydb.updateRow("configs", config,"userid = "+userid+" AND configkey = '"+key+"'")
            .then( () => {
            })
            .catch( reason => {
                console.log( (ddbg()), reason);
            });
        }

        // we return the object that was updated plus a flag to logout or reload the page
        return mydb.getRow("panels","*", "userid = " + userid + " AND pname = '" + newPanel + "'")
        .then(row => {
            var obj = {userid: userid, pname: newPanel, skin: newSkin};
            if ( row ) {
                panelid = row.id;
                if ( newPassword || (newPanel!==oldPanel)) {
                    obj["password"] = newPassword;
                }
                return mydb.updateRow("panels", obj, "id = " + panelid)
                .then(results => {
                    obj["result"] = (newPassword || (newPanel!==oldPanel)) ? "logout" : "reload";
                    obj.id = panelid;
                    obj.useremail = user.email;
                    obj.mobile = user.mobile;
                    if ( DEBUG4 ) {
                        console.log( (ddbg()), "obj: ", obj, " update results: ", results);
                    }
                    return obj;
                })
                .catch(reason => {
                    console.log( (ddbg()), reason);
                });
            } else {
                obj["password"] = newPassword;
                return mydb.addRow("panels", obj)
                .then(results => {
                    panelid = mydb.getId();
                    obj["result"] = "logout";
                    obj.id = panelid;
                    obj.useremail = user.email;
                    obj.mobile = user.mobile;
                    if ( DEBUG4 ) {
                        console.log( (ddbg()), "obj: ", obj, "add results: ", results);
                    }
                    return obj;
                })
                .catch(reason => {
                    console.log( (ddbg()), reason);
                });    
            }
        })
        .catch(reason => {
            console.log( (ddbg()), reason);
        })
    }
    
}

// this routine updates the null hub with the special tile count requested
async function updSpecials(userid, hubindex, stype, newcount, specials) {

    const defwidth = {"video": 375, "frame": 375, "image": 375, "blank": 180, "custom": 180};
    const defheight = {"video": 211, "frame": 211, "image": 211, "blank": 211, "custom": 211};

    // add special tiles based on type and user provided count
    // this replaces the old code that handled only video and frame tiles
    // this also creates image and blank tiles here that used to be made in groovy
    // putting this here allows them to be handled just like other modifiable tiles
    // note that frame1 and frame2 are reserved for weather and accuweather tiles
    var dtype = stype==="custom" ? stype+"_" : stype;

    // get the number of specials of this type already here
    var numnow = 0;
    if ( specials ) {
        specials.forEach(dev => {
            if ( dev.devicetype === stype ) numnow++;
        });
    }

    // add new specials if we don't have enough
    if ( newcount > numnow ) {
        // for (var i= numnow; i < newcount; i++) {
        var i = numnow;
        while ( i < newcount ) {
            var k = i+1;
            var devname = getCustomName(stype, k);
            var devid = dtype + k.toString();
            var pvalue = {"name": devname, "width": defwidth[stype], "height": defheight[stype]};
            var device = {userid: userid, hubid: hubindex, deviceid: devid, name: devname,
                          devicetype: stype, hint: "special", refresh: "never", pvalue: encodeURI2(pvalue)};
            await mydb.addRow("devices", device)
            .then( () => {
                i++;
             })
            .catch(reason => {
                i = newcount;
                console.log( (ddbg()), reason );
            });
        }
    
    // remove the extra ones if we have too many
    } else if ( newcount < numnow ) {
        // for (var i= newcount; i < numnow; i++) {
        var i = newcount;
        while ( i < numnow ) {
            var k = i+1;
            var devid = dtype + k.toString();
            await mydb.deleteRow("devices", "userid = "+ userid + " AND deviceid = '" + devid + "' AND devicetype = '"+stype+"'")
            .then( () => {
                i++;
            })
            .catch(reason => {
                i = numnow;
                console.log( (ddbg()), reason );
            });
        }
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
        .catch( reason => {
            console.log( (ddbg()), reason);
        });

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
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
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
        activedir = path.join(skin, icondir);
    } else if ( category.startsWith("Modern_") ) {
        activedir = path.join("skin-modern", icondir);
    } else if ( category.startsWith("User_") ) {
        activedir = path.join(userdir, pname, icondir);
    } else {
        activedir = path.join("media", icondir);
    }

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
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
            return null;
        });

    } else {
        return mydb.deleteRow("configs", "userid = "+userid+" AND configkey='"+configkey+"'")
        .then(result => {
            return null;
        })
        .catch( reason => {
            console.log( (ddbg()), reason);
            return null;
        });
    }
}

function findHub(hubid, hubs) {
    var thehub = null;
    hubs.forEach( function(hub) {
        if ( hub.hubid === hubid ) {
            thehub = hub;
        }
    });
    return thehub;
}

function getHubObj(userid, hub) {
    var promise = new Promise(function(resolve, reject) {

        if ( !hub || typeof hub!=="object" ) {
            reject("Something went wrong with authorizing a hub");
            return;
        }

        var returnloc = GLB.returnURL + "/oauth";
        var hubName = hub["hubname"];
        var hubType = hub["hubtype"];
        var clientId = hub.clientid;
        var clientSecret = hub.clientsecret;
        var host = hub["hubhost"];
        var thestate = hub.hubid;

        // first handle user provided auth which only works for ISY and Hubitat
        if ( hub.useraccess && hub.userendpt ) {
            // get all new devices and update the options index array
            // this forces page reload with all the new stuff
            // notice the reference to /reauth in the call to get Devices
            // this makes the final read redirect back to reauth page

            // for ISY and legacy ST/HE we can go right to getting hub details and devices
            // this meets up with the js later by pushing hub info back to reauth page
            // determine what to retun to browser to hold callback info for hub auth flow
            if ( hubType==="ISY" || hubType==="Hubitat" ) {
                result = {action: "things", hubType: hubType, hubName: hubName, numdevices: 0};

                // now read the hub and fill in the right info
                getHubInfo(hub)
                .then(mydevices => {
                    var ndev = Object.keys(mydevices).length;
                    result.numdevices = ndev;
                    if ( DEBUG2 ) {
                        console.log( (ddbg()), result );
                    }
                    resolve(result);
                    // msg = "Hub " + hubName +" returned " + ndev + " devices";
                    // pushClient(userid, "pagemsg", "auth", "#newthingcount", msg );
                    // pushClient(userid, "reload", "auth", "/userauth");
                })
                .catch(reason => {
                    reject(reason);
                    // pushClient(userid, "pagemsg", "auth", "#newthingcount", msg );
                });
            } else {
                var msg = "user access and user endpoint can only be used with ISY and Hubitat hubs.";
                result = {action: "error", reason: msg};
                resolve(result);
            }
        } else {

            // oauth flow for Ford and Lincoln vehicles
            // we complete the flow later when redirection happens back to /oauth GET call
            // user must provide the application ID in the hubid field for this to work
            var result;
            if ( hubType==="Ford" || hubType==="Lincoln" ) {
                var model = hubType.substr(0,1);
                var hosturl = host + "/common/login";
                result = {action: "oauth", userid: userid, host: hosturl, model: model, hubName: hubName, appId: hubid, 
                            state: thestate, clientId: clientId, clientSecret: clientSecret, hubType: hubType,
                            scope: "access", url: returnloc};
                resolve(result);


            // oauth flow for Hubitat hubs
            // we complete the flow later when redirection happens back to /oauth GET call
            } else if ( hubType==="Hubitat" ) {
                var hosturl = host + "/oauth/authorize";
                result = {action: "oauth", userid: userid, host: hosturl, hubName: hubName, 
                            clientId: clientId, clientSecret: clientSecret, hubType: hubType,
                            scope: "app", url: returnloc};
                resolve(result);

            // handle new OAUTH flow for SmartThings
            } else if ( hubType==="NewSmartThings" ) {
                var hosturl = host + "/oauth/authorize";
                result = {action: "oauth", userid: userid, host: hosturl, hubName: hubName, 
                            clientId: clientId, clientSecret: clientSecret, hubType: hubType,
                            scope: "r:devices:* x:devices:* r:scenes:* x:scenes:* r:locations:* x:locations:*", 
                            client_type: "USER_LEVEL", url: returnloc};
                resolve(result);

            // handle new OAUTH flow for SmartThings
            } else if ( hubType==="Sonos" ) {
                var hosturl = host + "/login/v3/oauth";
                result = {action: "oauth", userid: userid, host: hosturl, hubName: hubName, 
                        clientId: clientId, clientSecret: clientSecret, hubType: hubType,
                        scope: "playback-control-all", 
                        state: thestate,
                        url: returnloc};
                resolve(result);

            // otherwise return an error string message
            } else {
                reject("invalid hub type requesting an OAUTH flow. hubType: " + hubType);
            }
        }

    });
    return promise;
}

function apiCall(user, body, protocol, req, res) { 

    if ( DEBUG8 ) {
        console.log( (ddbg()), protocol + " api call, body: ", jsonshow(body) );
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
    var hint = body.hint || "";
    var userid = null;

    // for POST we get vital info from GUI
    // if user is making an API call these must be provided
    if ( protocol==="POST" && typeof body === "object" ) {
        userid = body.userid;
        var usertype = body.usertype || userid;
        var panelid = body.panelid;
        if ( !panelid ) panelid = 1;
        var pname = body.pname;
        var useremail = body.email;
        var uname = body.uname;
        var skin = body.skin;
        try {
            if ( body.rule ) {
                var rules = JSON.parse(decodeURI(body.rules));
            } else {
                rules = null;
            }
        } catch(e) {
            rules = null;
        }
    }
    
    if ( user && typeof user === "object" ) {
        userid = user["users_id"];
        usertype = user["users_usertype"];
        panelid = user["panels_id"];
        pname = user["panels_pname"];
        useremail = user["users_email"];
        uname = user["users_uname"];
        skin = user["panels_skin"];
    }

    // console.log((ddbg()),"apiCall - userid: ", userid, " api: ", api);
    if ( !userid && api!=="forgotpw" && api!=="createuser") {
        console.log( (ddbg()), "*** error *** user not authorized for API call. api: ", api, " body: ", body);
        return "error - HousePanel is not authorized for this user to make an API call";
    }
    
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
                        doAction(userid, "auto", hubindex, athing, "", "", swval, swattr, subid, hint, command, linkval);
                    });
                    result = "called doAction " + tilearray.length + " times in a multihub action";
                } else {
                    if ( DEBUG8 ) {
                        console.log( (ddbg()), "doaction: hubid: ", hubid, " swid: ", swid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid, " thingid: ", thingid, " hint: ", hint);
                    }
                    result = doAction(userid, hubid, hubindex, thingid, swid, swtype, swval, swattr, subid, hint, command, linkval);
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
                result = {version: GLB.HPVERSION, userid: userid, usertype: usertype, email: useremail, uname: uname, panel: pname, skin: skin};
                break;

            // changed to only handle page fake tile requests
            // we get the real tile from the GUI all the time now
            case "pagetile":
                if ( protocol==="POST" ) {
                    // make the fake tile for the room for editing purposes
                    var faketile = {"panel": "panel", "name": swval, "tab": "Tab Inactive", "tabon": "Tab Selected"};
                    var thesensor = { "id": "r_" + swid, "name": swval, thingid: 0, roomid: roomid, 
                                      "hubnum": "-1", "hubindex": 0, "type": "page", "value": faketile};
                    result = makeThing(userid, pname, null, 0, tileid, thesensor, "wysiwyg", 0, 0, 500, "", "te_wysiwyg", null);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "wysiwyg":
                if ( protocol==="POST" ) {
                    var result = mydb.getRows("configs", "*", "userid = "+userid)
                    .then(configoptions => {
                        var device = JSON.parse(decodeURI(body.value));
                        var thesensor = {id: swid, name: device.name, thingid: thingid, roomid: 0, type: device.devicetype, hubnum: "-1", hubindex: 0, hubtype: "None", 
                                        hint: device.hint, refresh: device.refresh, value: device.pvalue};
                        var customname = swattr;
                        return makeThing(userid, pname, configoptions, 0, tileid, thesensor, "wysiwyg", 0, 0, 999, customname, "te_wysiwyg", null);
                    }).catch(reason => {
                        console.log( (ddbg()), reason);
                        return null;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "setorder":
                if ( protocol==="POST" ) {
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
                    var numdevices = 0;
                    result = mydb.getRows("hubs","*","userid = "+userid+ " AND hubid != '-1' AND hubid != 'new'")
                    .then(hubs => {
                        var numhubs = hubs ? Object.keys(hubs).length : 0;
                        if ( numhubs === 0 ) {
                            return "nothing to refresh";
                        } else {
                            var promise = new Promise(function(resolve, reject) {
                                var n = 0;
                                hubs.forEach(hub => {
                                    getDevices(hub)
                                    .then(mydevices => {
                                        n++;
                                        var num = Object.keys(mydevices).length;
                                        numdevices+= num;
                                        if ( n >= numhubs ) {
                                            resolve("refreshed " + numdevices + " devices from " + numhubs + " hubs ");
                                        }
                                    })
                                    .catch(reason => {
                                        n++;
                                        console.log( (ddbg()), reason);
                                        reject(reason);
                                    });
                                });
                            });
                            return promise;
                        }
                    })
                    .catch(reason => {
                        console.log( (ddbg()), reason);
                        return reason;
                    });
                    
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
                }).catch(reason => {
                    console.log( (ddbg()), "apiCall - getoptiopns: ", reason);
                    return null;
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
                }).catch(reason => {
                    console.log( (ddbg()), "apiCall - getrules: ", reason);
                    return null;
                });
                break;
            
            // this returns just the rules list for a specific user and device swid
            case "gethubs":
                result = mydb.getRows("hubs","*","userid = "+userid)
                .then(row => {
                    if ( DEBUG2 ) {
                        console.log( (ddbg()),"hubs returned for user: ", userid, " hub: ", row );
                    }
                    return row;
                })
                .catch(reason => {
                    return "error - no hubs found for user " + userid;
                })
                break;

            // read and return devices tied to this user
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
                                var pvalue = decodeURI2(row.pvalue);

                                // handle special audio updates
                                if ( !pvalue ) {
                                    pvalue = {};
                                } else if ( swtype==="audio" || swtype==="sonos" || pvalue.audioTrackData ) {
                                    pvalue = translateAudio(pvalue);
                                } else if ( swtype==="music" || pvalue.trackData ) {
                                    pvalue = translateMusic(pvalue);
                                } else if ( swtype==="weather" ) {
                                    var thisorigname = pvalue.name || "Weather";
                                    pvalue = translateWeather(thisorigname, pvalue);
                                } else {
                                    pvalue = translateObjects(pvalue);
                                }
                                row.pvalue = pvalue;
                                devices[row.id] = row;
                            });
                        }
                        return devices;
                    })
                    .catch(reason => {
                        console.log( (ddbg()), "apiCall - getdevices: ", reason);
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            // read things tied to this user and panel
            case "getallthings":
            case "getthings":
                if ( protocol==="POST" ) {
                    var joinstr = mydb.getJoinStr("things","roomid","rooms","id");
                    var conditions = "things.userid = "+userid+" AND rooms.panelid = "+panelid;
                    var fields = "things.id as things_id, things.userid as things_userid, things.roomid as things_roomid, " +
                    "things.tileid as things_tileid, things.posy as things_posy, things.posx as things_posx, " +
                    "things.zindex as things_zindex, things.torder as things_torder, things.customname as things_customname, " +
                    "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";
                    result = mydb.getRows("things", fields, conditions, joinstr)
                    .then(things => {
                        return things;
                    }).catch(reason => {
                        console.log( (ddbg()), "apiCall - getthings: ", reason);
                        return null;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
                    
            case "filteroptions":
                if ( protocol==="POST" ) {
                    result = saveFilters(userid, body["useroptions"], body["huboptpick"]);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
            break;

            case "saveoptions":
                if ( protocol==="POST" ) {
                    result = processOptions(userid, panelid, body, res);
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
            
            case "dologin":
                if ( protocol==="POST" ) {
                    result = processLogin(body, res);
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

            case "validateuser":
                if ( protocol==="POST" ) {
                    result = validateUser(body);
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

            case "forgotpw":
                if ( protocol==="POST" ) {
                    // console.log(">>>> email: ", body.email, " mobile: ", body.mobile);
                    result = forgotPassword(body.email, body.mobile);
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

            case "getwsport":
                var wsmax = 8181;
                var usedports = [];
                if ( clients[userid] ) {
                    clients[userid].forEach(function(client) {
                        var wsport = client.socket.server["_connectionKey"];
                        var ipos = wsport.lastIndexOf(":");
                        wsport = parseInt(wsport.substr(ipos+1));
                        usedports.push(wsport);
                    });
                }

                if ( usedports.length ) {
                    for (var iport=8181; iport < 8190; iport++) {
                        if ( !usedports.includes(iport) ) {
                            wsmax = iport;
                            break;
                        }
                    }
                } else {
                    wsmax = 8181;
                }
                result = {port: wsmax, used: usedports};
                break;

            // this api call starts the hub authorization process
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
                    hub["clientid"] = body.clientid;
                    hub["clientsecret"] = body.clientsecret;
                    hub["hubaccess"] = body.hubaccess;
                    hub["hubendpt"] = body.hubendpt;
                    hub["hubrefresh"] = "";
                    hub["useraccess"] = body.useraccess || "";
                    hub["userendpt"] = body.userendpt || "";
                    hub["hubtimer"] = body.hubtimer || 0;
                    // hub["sinkFilterId"] = "";

                    // for now set the hubid to value user gave
                    // if this hub exists it will be overwritten
                    // if not it will be generated later or default given
                    var hubid = hub.hubid.toString();

                    // if hubid not given assign it a random number tied to hub type
                    // for ST and HE hubs this is a placeholder that will be over written
                    // for Ford the user must provide a valid Application ID as the hub ID
                    // for other hubs it will be permanent since it isn't used
                    if ( !hubid || hubid==="new" ) {
                        var rstr = getRandomInt(1001, 9999);
                        hubid = hub.hubtype + rstr.toString();
                        hub["hubid"] = hubid;
                    }

                    // fix up host if http wasn't given
                    if ( hub.hubhost && !hub["hubhost"].toLowerCase().startsWith("http") ) {
                        hub.hubhost = "http://" + hub["hubhost"];
                    }

                    // fix up ending slashes
                    if ( hub.userendpt.substr(-1) === "/" ) {
                        hub.userendpt = hub.userendpt.substr(0, hub.userendpt.length -1);
                    }

                    // if no name given, give it one but know that it will be overwritten if OAUTH flow occurs
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

                    if ( DEBUG2 ) {
                        console.log((ddbg()), "hub in hubauth: ", hub);
                    }

                    // point to the hub being authorized
                    result = mydb.updateRow("users",{defhub: hubid},"id = " + userid)
                    .then( () => {
                        return mydb.updateRow("hubs", hub, "userid = " + userid + " AND hubid = '"+hubid+"'");
                    })
                    // add the hub to the database or update it
                    .then(result => {
                        hub.id = mydb.getId();
                        var autoid = result.getAutoIncrementValue();
                        if ( DEBUG2 ) {
                            console.log( (ddbg()), "oauth hub: ", hub, " id: ", hub.id, autoid );
                        }
                        return getHubObj(userid, hub);
                    })
                    .then(obj => {
                        if ( DEBUG2 ) {
                            console.log( (ddbg()), "hub auth - getHubObj: ", obj);
                        }
                        res.send(obj);
                        res.end();
                    })
                    .catch(reason => {
                        console.log( (ddbg()), reason);
                        res.send("error - something went wrong");
                        res.end();
                    });
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
                            mydb.updateRow("users",{defhub: ""}, "id = " + userid)
                            .then( res4 => {
                                var msg = "removed a hub with ID = " + hubid;
                                pushClient(userid, "pagemsg", "auth", "#newthingcount", msg );
                            })
                            .catch( reason => {
                                console.log( (ddbg()), reason);
                                msg = "error - could not remove hub with ID = " + hubid;
                                pushClient(userid, "pagemsg", "auth", "#newthingcount", msg );
                            });
                        } else {
                            msg = "error - could not remove hub with ID = " + hubid;
                            pushClient(userid, "pagemsg", "auth", "#newthingcount", msg );
                        }
                    })
                    .catch(reason => {
                        console.log( (ddbg()), "error - ", reason);
                    });
                    result = "Removing hub #" + swattr + " hubid = " + hubid;
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "getclock":
                result = getClock(swid);
                var clock = encodeURI2(result);
                var device = {pvalue: clock};
                mydb.updateRow("devices", device, "userid = " + userid + " AND deviceid = '"+swid+"'");
                
                // handle rules based on time and including user fields status
                var userresult = getCustomTile(userid, swattr, result, swid);
                processRules(userid, thingid, swid, "clock", "time", userresult, "callHub" );

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
        return result;
}

// setup socket between server and all user browsers
function setupBrowserSocket() {
    // var wsServer;

    // create the HTTP server for handling sockets
    // support insecure and secure sockets to deal with ISY which is insecure
    if ( fs.existsSync("housepanel_server.key") && fs.existsSync("housepanel_server.crt") && fs.existsSync("housepanel_server.ca") ) {
        var key = fs.readFileSync("housepanel_server.key");
        var crt = fs.readFileSync("housepanel_server.crt");
        var cabundle = fs.readFileSync("housepanel_server.ca");
        var credentials = {key: key, cert: crt, ca: cabundle};
        for ( var isrv=1; isrv<10; isrv++) {
            var server = https.createServer(credentials, function() {});
            var wsServer = new webSocketServer({httpServer: server});
            var wsport = GLB.webSocketServerPort + isrv;
            console.log( (ddbg()), "Secure webSocket Server is listening on port: ", wsport);
            wsServers.push( wsServer );
            server.listen(wsport, function() {} );
        }
    } else {
        for ( var isrv=1; isrv<10; isrv++) {
            var server = http.createServer(function() {});
            var wsServer = new webSocketServer({httpServer: server});
            var wsport = GLB.webSocketServerPort + isrv;
            console.log( (ddbg()), "Insecure webSocket Server is listening on port: ", wsport);
            wsServers.push( wsServer );
            server.listen(wsport, function() {} );
        }
    }

    // This function handles new connections, messages from connections, and closed connections
    // changed this logic to use multiple servers with only one client per server for any given user
    for ( var i=0; i < wsServers.length; i++ ) {

        var wsServer = wsServers[i];

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
            console.log( (ddbg()), 'Connecting websocket. Address: ', connection.socket.remoteAddress );   // connection.remoteAddresses,
            // console.log( (ddbg()), 'Connection details: ', connection );   // connection.remoteAddresses,

            // shut down any existing connections to same remote host
            var browserurl = connection.socket.remoteAddress;
            var wsport = connection.socket.server["_connectionKey"];
            var userport = 0;

            // wait for message from browser telling us what user id this is
            connection.on("message", function(msg) {
                if ( msg.type==="utf8" ) {
                    var userandport = msg.utf8Data.split("|");
                    var userid = parseInt(userandport[0]);
                    userport = parseInt(userandport[1]);

                    // create this user's list of pages if not there
                    if ( !clients[userid] ) {
                        clients[userid] = [];
                    }

                    // save the userid in the connection object
                    connection.userid = userid;

                    // now that we know the userid and the URL of the browser, remove old ones and register this client
                    var i = 0;
                    while ( i < clients[userid].length ) {
                        var oldhost = clients[userid][i].socket.remoteAddress;
                        var oldport = clients[userid][i].socket.server["_connectionKey"];
                        if ( oldhost===browserurl && oldport===wsport ) {
                            clients[userid].splice(i, 1);
                        } else {
                            i++;
                        }
                    }

                    // add the new client
                    var index = clients[userid].push(connection) - 1;
                    clients[userid].forEach(function(client, i) {
                        var clientUrl = client.socket.remoteAddress;
                        var clientPort = client.socket.server["_connectionKey"];
                        var str = "User #"+userid;
                        if ( i===index ) {
                            str += " New Connection #"+i;
                        } else {
                            str += " Old Connection #"+i;
                        }
                        console.log( (ddbg()), str, "from host:", clientUrl, "port:", clientPort);
                    });
                }
            });
        
            // user disconnected - remove just one client that match this socket
            connection.on('close', function(reason, description) {
                var host = connection.socket.remoteAddress;
                var port = connection.socket.server["_connectionKey"];
                var userid = connection.userid;

                console.log( (ddbg()), "Peer: ", host, " disconnected. for: ", reason, description, " user: ", userid, " connection: ", connection.socket.server["_connectionKey"]);

                // remove clients that match this host
                var i = 0;
                if ( clients && userid && clients[userid] ) {
                    while ( i < clients[userid].length ) {
                        var oldhost = clients[userid][i].socket.remoteAddress;
                        var oldport = clients[userid][i].socket.server["_connectionKey"];
                        if ( oldhost===host && oldport===port ) {
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

function setupISYSocket() {
    
    // make websocket connection to any ISY hub
    // unlike ST and HE below, communication from ISY happens over a real webSocket
    var wshost;

    // close any prior sockets
    if ( isyServers.length ) {
        isyServers.forEach(server => {
            try {
                server.drop(1001,"HousePanel page refreshing");
            } catch(e) {}
        })
    }
    isyServers = [];

    // get all the ISY hubs for every user - this assumes no two users use the same ISY hub
    mydb.getRows("hubs","*","hubtype = 'ISY'")
    .then(hubs => {
        hubs.forEach(hub => {

            // if ( DEBUGisy ) {
            //     console.log( (ddbg()), "Setting up callback socket for hub: ", hub);
            // }
            var userid = hub.userid;
            wshost = false;
            if ( hub["hubtype"]==="ISY" && hub["hubendpt"] && hub["hubaccess"] ) { 

                var hubhost = hub["hubendpt"];
                if ( hubhost.startsWith("https://") ) {
                    wshost = "wss://" + hubhost.substr(8);
                } else if ( hubhost.startsWith("http://") ) {
                    wshost = "ws://" + hubhost.substr(7);
                }
            }

            if ( DEBUGisy ) {
                console.log( (ddbg()), "wshost: ", wshost);
            }

            // set up socket for ISY hub if one is there
            if ( wshost ) {
                var buff = Buffer.from(hub["hubaccess"]);
                var base64 = buff.toString('base64');
                var origin = "com.universal-devices.websockets.isy";
                var header = {"Authorization": "Basic " + base64, "Sec-WebSocket-Protocol": "ISYSUB",  
                                "Sec-WebSocket-Version": "13", "Origin": origin};
                wshost = wshost + "/subscribe";
                var opts = {rejectUnauthorized: false};
                var wsconfigs = {tlsOptions: opts, closeTimeout: 2000};
                var wsclient = new webSocketClient(wsconfigs);
                isyServers.push(wsclient);
                // wsclient["kw_signature"] = "test";

                wsclient.connect(wshost, "ISYSUB", origin, header, opts);
                wsclient.on("connectFailed", function(err) {
                    console.log( (ddbg()), "Connection failure to ISY socket: ", err.toString(), " wshost: ", wshost, " header: ", header);
                });
            
                wsclient.on("connect", function(connection) {
                    var that = this;
                    console.log( (ddbg()), "Success connecting to ISY socket. Listening for messages...");
            
                    // handle incoming state messages from ISY
                    connection.on("message", function(msg) {
                        if ( msg.type==="utf8" ) {
                            processIsyXMLMessage(userid, msg.utf8Data);
                        }
                    });
                
                    connection.on("error", function(err) {
                        console.log( (ddbg()), "Connection error to ISY socket: ", err);
                    });
                
                    connection.on("close", function(reasonCode, description) {
                        console.log( (ddbg()), "ISY socket closed. reason: ", reasonCode, " desc: ", description, );
                    });
                
                });
            }
        });
    }).catch(reason => {
        console.log( (ddbg()), "ISY socket setup failure: ", reason);
    });
}

function buildDatabaseTable(tableindex) {
    const tableData = [
          `CREATE TABLE configs (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            configkey TEXT NULL,
            configval TEXT NULL
          )`,
          
          `CREATE TABLE devices (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            hubid INTEGER NOT NULL,
            deviceid TEXT NULL,
            name TEXT '',
            devicetype TEXT '',
            hint TEXT '',
            refresh TEXT 'normal',
            pvalue TEXT NULL
          )`,
          
          `CREATE TABLE hubs (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            hubid TEXT NULL,
            hubhost TEXT NULL,
            hubtype TEXT NULL,
            hubname TEXT NULL,
            clientid TEXT NULL,
            clientsecret TEXT NULL,
            hubaccess TEXT NULL,
            hubendpt TEXT NULL,
            hubrefresh TEXT '',
            useraccess TEXT '',
            userendpt TEXT '',
            hubtimer TEXT '0'
          )`,
          
          `CREATE TABLE panels (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            pname TEXT NULL,
            password TEXT NULL,
            skin TEXT NULL
          )`,
          
          `CREATE TABLE rooms (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            panelid INTEGER NOT NULL,
            rname TEXT NULL,
            rorder INTEGER NOT NULL
          )`,
          
          `CREATE TABLE things (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            roomid INTEGER NOT NULL,
            tileid INTEGER NOT NULL,
            posy INTEGER DEFAULT 0,
            posx INTEGER DEFAULT 0,
            zindex INTEGER DEFAULT 1,
            torder INTEGER DEFAULT 1,
            customname TEXT NULL
          )`,
          
          `CREATE TABLE users (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            email TEXT NULL,
            uname TEXT NULL,
            mobile TEXT NULL,
            password TEXT NULL,
            usertype INTEGER NOT NULL,
            defhub TEXT NULL,
            hpcode TEXT NULL
          )`
    ];
    mydb.query(tableData[tableindex])
    .then(results => {
        console.log( (ddbg()), results );
    })
    .catch(reason => {
        console.log( (ddbg()), reason );
    })
}

// ***************************************************
// beginning of main routine
// ***************************************************

// read config file
try {
    GLB.dbinfo = JSON.parse(fs.readFileSync("housepanel.cfg","utf8"));
    var twilioSid =  GLB.dbinfo["twilio_sid"];
    var twilioToken =  GLB.dbinfo["twilio_token"];
    var twilioService = GLB.dbinfo["twilio_service"];
    if ( twilioSid && twilioToken && twilioService ) {
        var twilioClient = require('twilio')(twilioSid, twilioToken); 
    } else {
        twilioClient = null;
    }
} catch (e) {

    // default behavior is no new user validation
    GLB.dbinfo = {
        "dbhost": "localhost",
        "dbname": "housepanel",
        "dbuid": "housepanel",
        "dbpassword": "housepanel",
        "dbtype": "sqlite",
        "port": "8580",
        "websocketport": "8380",
        "allownewuser" : "true",
        "service": "none"
    };
    twilioClient = null;
    twilioService = null;
}

GLB.port = parseInt(GLB.dbinfo["port"]);
GLB.webSocketServerPort = parseInt(GLB.dbinfo["websocketport"]);

var port = GLB.port;
GLB.defhub = "new";
GLB.newcss = {};

var wsServers = [];
var clients = [];
var isyServers = [];

// start our main server
var httpServer;
var httpsServer;
var credentials;
try {
    // the Node.js app loop - can be invoked by client or back end
    var app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // app.use(bodyParser.json());
    // app.use(bodyParser.urlencoded({ extended: true }));
    var dir = path.join(__dirname, '');
    app.use(express.static(dir));
    app.use(cookieParser());

    if ( fs.existsSync("housepanel_server.key") && fs.existsSync("housepanel_server.crt") && fs.existsSync("housepanel_server.ca") ) {
        try {
            var key = fs.readFileSync("housepanel_server.key");
            var crt = fs.readFileSync("housepanel_server.crt");
            var cabundle = fs.readFileSync("housepanel_server.ca");
            httpServer = null;
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
        httpsServer = null;
        credentials = null;
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
// the dbtype parameter controls whether we use mySQL or SQLITE engines
// these are the only two choices - if something else given, sqlite is used
if ( app && applistening ) {

    var mydb = new sqlclass.sqlDatabase(GLB.dbinfo.dbhost, GLB.dbinfo.dbname, GLB.dbinfo.dbuid, GLB.dbinfo.dbpassword, GLB.dbinfo.dbtype);
    
    // build the tables if they are not there
    var tables = ["configs", "devices","hubs", "panels", "rooms", "things", "users"];
    Promise.allSettled([
       mydb.getRow(tables[0],"id"),
       mydb.getRow(tables[1],"id"),
       mydb.getRow(tables[2],"id"),
       mydb.getRow(tables[3],"id"),
       mydb.getRow(tables[4],"id"),
       mydb.getRow(tables[5],"id"),
       mydb.getRow(tables[6],"id")
    ])
    .then(results => {
        var i = 0;
        results.forEach(function (result) {
            if ( result.status === "rejected" ) {
                console.log(tables[i]," = ", result.reason);
                console.log("Table ", tables[i], " does not exist. Building it...");
                buildDatabaseTable(i);
            }
            i++;
        });
    })
    .catch(reason => {
        // pause here to give engine some time to do its thing
        setTimeout(function() {
            console.log( (ddbg()), "Fixing up the database, building all missing tables for HousePanel...");
        }, 3000);
    })

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

        // handle special cases of new user and forgot password
        if ( req.path === "/activateuser" || req.path === "/forgotpw"  ) {
            var queryobj = req.query || {};
            if ( queryobj.userid ) {
                var userid = queryobj.userid;
                var thecode = queryobj.hpcode ? queryobj.hpcode : "";
                mydb.getRow("users","*", "id = "+userid)
                .then(row => {
                    if ( row ) {
                        if ( req.path === "/activateuser" ) {
                            var result = validateUserPage(row, thecode);
                        } else {
                            delCookie(res, "uname");
                            delCookie(res, "pname");
                            result = validatePasswordPage(row, thecode);
                        }
                    } else {
                        result = getLoginPage(req, 0, "", "", "", hostname);
                    }
                    res.send(result);
                    res.end();
                }).catch(reason => {
                    console.log( (ddbg()), reason);
                    var result = getLoginPage(req, 0, "", "", "", hostname);
                    res.send(result);
                    res.end();
                });
            } else {
                var result = getLoginPage(req, 0, "", "", "", hostname);
                res.send(result);
                res.end();
            }
            return;
        }

        // everything starts with finding the username which drives which rows we read from the DB
        getUserName(req)
        .then(results => {

            if ( DEBUG22 ) {
                console.log( (ddbg()), "username results: ", results);
            }

            if ( !results || !results["users_id"] ) {
                if ( DEBUG3 ) {
                    console.log( (ddbg()), "login rejected for user: ", results);
                }
                var result = getLoginPage(req, 0, "", "", "", hostname);
                res.send(result);
                res.end();
        
            } else {

                var user = results;
                var userid = user["users_id"];
                var usertype = user["users_usertype"];
                
                // mydb.getRows("configs", "*", "userid = "+userid)
                Promise.all( [
                    mydb.getRows("configs", "*", "userid = "+userid),
                    mydb.getRows("hubs", "*", "userid = "+userid)
                ])
                .then(results => {

                    var configoptions = results[0];
                    var hubs = results[1];

                    // retrieve the configs
                    var specials = getConfigItem(configoptions, "specialtiles");
                    var hptime = getConfigItem(configoptions, "time");
                    if ( !specials || !hptime ) {
                        configoptions = makeNewConfig(userid);
                    }
                    if ( !hubs ) {
                        hubs = makeDefaultHub(userid)
                    }
                    return [configoptions, hubs];
                })
                .then(results => {
                    var configoptions = results[0];
                    var hubs = results[1];
                    if ( DEBUG1 ) {
                        console.log( (ddbg()), "configoptions: ", configoptions);
                        console.log( (ddbg()), "hubs: ", hubs);
                    }

                    // find any query params - if provided then user is doing an API call with HP
                    var queryobj = req.query || {};
                    var isquery = (objCount(queryobj) > 0);

                    // first check for displaying the main page
                    if ( typeof req.path==="undefined" || req.path==="/" ) {

                        // display the main page if user is in our database
                        // don't check password here because it is checked at login
                        // and the cookie is set which means all is okay
                        if ( DEBUG3 ) {
                            console.log( (ddbg()), "login accepted. user: ", user);
                        }

                        if ( isquery ) {
                            var result = apiCall(user, queryobj, "GET", req, res);
                            if ( typeof result === "object" && typeof result.then === "function" ) {
                                result.then(obj => {
                                    res.json(obj);
                                    res.end();
                                });
                            } else if ( typeof result === "string" ) {
                                res.send(result);
                                res.end;
                            } else if ( result && typeof result === "object") {
                                res.json(result);
                                res.end();
                            } else {
                                var reason = "Invalid GET request";
                                res.send(reason);
                                res.end();
                            };

                        // this is what makes the main page
                        } else {
                            setupISYSocket();
                            getMainPage(user, configoptions, hubs, req, res);
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
                        delCookie(res, "uname");
                        delCookie(res, "pname");

                        if ( req.query && req.query["pname"] ) {
                            var pname = req.query["pname"];
                        } else {
                            pname = "default";
                        }
                        var result = getLoginPage(req, userid, pname, "", "", hostname);
                        res.send(result);
                        res.end();

                    } else if ( req.path==="/reauth" ) {
                        getAuthPage(user, configoptions, req.headers.host, false)
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    } else if ( req.path==="/userauth") {
                        getAuthPage(user, configoptions, req.headers.host, false)
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    // this is where the oauth flow returns from the first auth step
                    } else if ( req.path==="/oauth") {
                        if ( req.query && req.query["code"] ) {
                            var hubid = user["users_defhub"];
                            var thecode = req.query["code"];
                            // var hub = findHub(hubid, hubs);
                            mydb.getRow("hubs","*", "userid = "+userid+" AND hubid = '" + hubid + "'")
                            .then(hub => {
                                if ( DEBUG2 ) {
                                    console.log( (ddbg()), "Getting access_token for hub: ", hub," hubid: ", hubid, " code: ", thecode);
                                }
                                return hub;
                            })
                            .then(hub => {
                                getAccessToken(userid, thecode, hub)
                                .then(mydevices => {
                                    var numdevices = Object.keys(mydevices).length;
                                    var msg = hub.hubtype + " hub named " + hub.hubname + " authorized with " + numdevices + " devices";
                                    if ( DEBUG2 ) {
                                        console.log( (ddbg()), msg);
                                    }
                                    getAuthPage(user, configoptions, req.headers.host, msg)
                                    .then(result => {
                                        res.send(result);
                                        res.end();
                                    });            
                                });
                            })
                            .catch(reason => {
                                console.log( (ddbg()), reason);
                                getAuthPage(user, configoptions, req.headers.host, reason)
                                .then(result => {
                                    res.send(result);
                                    res.end();
                                });
                            });
                             
                        } else {
                            getAuthPage(user, configoptions, req.headers.host, "Invalid hub authorization request")
                            .then(result => {
                                res.send(result);
                                res.end();
                            });
                        }

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

        }).catch(reason => {
            console.log( (ddbg()),"Startup error: ", reason);
            var result = getLoginPage(req, 0, "", "", "", hostname);
            res.send(result);
            res.end();
        });
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
    app.post("*", function (req, res) {

        // get user name
        var hubid;

        // handle initialize events from Hubitat here
        if ( req.path==="/" && req.body['msgtype'] === "initialize" ) {
            hubid = req.body['hubid'] || null;
            console.log( (ddbg()), "init request - req.body: ", req.body);

            if ( hubid ) {
                // if we find an existing hub then just update the devices
                // var returnmsg;
                mydb.getRow("hubs","*","hubid = '" + hubid + "'")
                .then(hub => {
                    var userid = hub.userid;
                    if ( DEBUG1 ) {
                        console.log( (ddbg()), "init request - hub: ", hub);
                    }
                    getDevices(hub)
                    .then(mydevices => {
                        var numdevices = Object.keys(mydevices).length;
                        var devices = Object.values(mydevices);
                        if ( DEBUG1 ) {
                            console.log( (ddbg()), "initialized ", numdevices," devices. devices: ", devices);
                        }
                        // res.send(devices);
                        pushClient(userid, "reload", "main", "/");
                    })
                            
                })
                .catch(reason => {
                    console.log( (ddbg()), "initialize hub error: ", reason);
                });

                // returnmsg = "initialize caused devices to be updated for hub with id = " + hubid;

                    // otherwise, we are initializing a new hub
                    // it is safe to ignore this init call because we haven't set the hubid yet
                    // which means we haven't done the first getDevices calle
                    // } else {
                    //     returnmsg = "initialize ignored for hub with id = " + hubid;
                    // res.send(returnmsg);
            //     res.send('error - hubid not provided in initialize call');
            }
            res.end();

        // handle msg events from Groovy legacy SmartThings and Hubitat here
        // these message can now only come from Hubitat since ST groovy is gone
        } else if ( req.path==="/" && req.body['msgtype'] === "update" ) {
            if ( DEBUG12 ) {
                console.log( (ddbg()), "Received update msg from hub: ", req.body["hubid"], " msg: ", req.body);
            }
            hubid = req.body['hubid'];
            if ( hubid && hubid!=="-1" ) {
                mydb.getRow("hubs","*","hubid = '" + hubid + "'")
                .then(hub => {
                    if ( hub ) {
                        processHubMessage(hub.userid, req.body, false);
                    }
                }).catch(reason => {
                    console.log( (ddbg()), "msgtype=update error: ", reason);
                });
            }
            res.send("Hub msg received and processed");
            res.end();

        // handle events from Sonos service
        // if you are running HP locally this will not work unless you are using https protocol
        } else if ( req.path === "/sonos" ) {

            var hubid = req.headers['x-sonos-household-id'];
            mydb.getRow("hubs","*","hubid = '"+hubid+"'")
            .then(hub => {
                if ( !hub ) throw "No Sonos hub available to update";
                var sigvals = [
                    req.headers['x-sonos-event-seq-id'],
                    req.headers['x-sonos-namespace'],
                    req.headers['x-sonos-type'],
                    req.headers['x-sonos-target-type'],
                    req.headers['x-sonos-target-value'],
                    hub.clientid,
                    hub.clientsecret               
                ];
    
                var buff = sigvals.join("");  //  Buffer.from(sigvals);
                var thehash = crypto.createHash("sha256");
                thehash.update(buff);
                var mysig = thehash.digest('base64');
                var sonossig = req.headers['x-sonos-event-signature'];

                // remove - + / = _ since they don't match for some reason
                mysig = mysig.replace(/[\-\.\+\/\=\_]/g,"");
                sonossig = sonossig.replace(/[\-\.\+\/\=\_]/g,"");
                
                if ( mysig === sonossig ) {
                    processSonosMessage(hub.userid, hub, req);
                    res.send("200 OK");
                    res.end();
                } else {
                    if ( DEBUGsonos ) {
                        console.log( (ddbg()),"Sonos event ignored, signatures do not match. signatures:\n ", sonossig, "\n ", mysig,"\n body: ", req.body);
                    }
                    res.send("200 OK");
                    res.end();
                }
            })
            .catch(reason => {
                if ( DEBUGsonos ) {
                    console.log( (ddbg()), reason);
                }
                res.send("200 OK");
                res.end();
            });
        
        // handle events from new SmartThings
        } else if ( (req.path==="/" || req.path==="/sinks") && 
                    (req.body["messageType"] && req.body["messageType"]==="EVENT" && req.body.eventData ) ) {

            // first lets get the name of the Sink and the hub to know which user to update
            var events = req.body.eventData.events;
            events.forEach(function(eventgrp) {
                var subscription = eventgrp.subscriptions[0];
                var event = eventgrp.event;

                if ( event.eventType==="DEVICE_EVENT" && event.deviceEvent && event.deviceEvent.stateChange ) {
                    var hubid = subscription.installedAppId;
                    var swid = event.deviceEvent.deviceId;
                    var attr = event.deviceEvent.attribute;
                    var valueType = event.deviceEvent.valueType;
                    var value = event.deviceEvent.value;

                    var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
                    var fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
                    "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
                    "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
                    "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
                    "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
                    "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
                    mydb.getRow("devices", fields, "hubs.hubid = '" + hubid + "' AND devices.deviceid = '" + swid + "'", joinstr)
                    .then(row => {
                        if ( !row ) { return; }
                        var userid = row["hubs_userid"];
                        var msg = {
                            msgtype: "update", 
                            hubid: hubid,
                            change_name: "",
                            change_device: swid,
                            change_attribute: attr,
                            change_type: valueType,
                            change_value: value
                        };
                        processHubMessage(userid, msg, true);
                        if ( DEBUG21 ) {
                            console.log( (ddbg()), "Event sink msg from new ST hub: ", hubid, " msg: ", msg );
                        }

                        // set color if any of the color attributes change
                        var pvalue = decodeURI2(row["devices_pvalue"]);
                        if ( DEBUG21 ) {
                            console.log( (ddbg()), "Event sink msg pvalue: ", pvalue );
                        }
                        if ( pvalue && (attr==="hue" || attr==="saturation" || attr==="level") && array_key_exists("color", pvalue) ) {
                            var h = attr==="hue" ? value : pvalue.hue;
                            var s = attr==="saturation" ? value : pvalue.saturation;
                            var v = attr==="level" ? value : pvalue.level;
                            h = Math.round((parseInt(h * 360) / 100));
                            s = Math.round(parseInt(s));
                            v = Math.round(parseInt(v));
                            var colorvalue = hsv2rgb(h, s, v);
                            var msg = {
                                msgtype: "update", 
                                hubid: hubid,
                                change_name: "",
                                change_device: swid,
                                change_attribute: "color",
                                change_type: "string",
                                change_value: colorvalue
                            };
                            if ( DEBUG21 ) {
                                console.log( (ddbg()), "Event sink msg changed color. h,s,l: ", h, s, v, " color: ", colorvalue );
                            }
                            setTimeout(function() {
                                processHubMessage(userid, msg, true);
                            }, 500);
                        }
                    }).catch(reason => {
                        console.log( (ddbg()), reason );
                    });
                } else if ( event.eventType === "MODE_EVENT" ) {
                    if ( event.modeEvent ) {
                        var locationId = event.modeEvent.locationId;
                        var modeId = event.modeEvent.modeId;

                        // get the location that matches this ID
                        // we do a join to the hub table so we can get the hubid in one query call
                        // however, this is actually not used so we could skip this
                        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
                        var fields = "devices.id as devices_id, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
                        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
                        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
                        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, " +
                        "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
                        "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
                        mydb.getRow("devices", fields, "devices.deviceid = '"+locationId+"'", joinstr)
                        .then(row => {
                            if ( row ) {
                                var userid = row["devices_userid"];
                                var locvalue = row["devices_pvalue"];
                                var hubid = row["hubs_hubid"];
                                var themode = null;
                                var pvalue = decodeURI2(locvalue);
                                // find the mode that matches the modeId

                                if ( pvalue ) {
                                    for (var key in pvalue) {
                                        if ( pvalue[key] === modeId ) {
                                            themode = key;
                                            break;
                                        }
                                    }
                                }

                                // process message for location and modes
                                if ( themode ) {
                                    var modemsg = {
                                        msgtype: "update", 
                                        hubid: hubid,
                                        change_name: "",
                                        change_device: locationId,
                                        change_attribute: "themode",
                                        change_type: "string",
                                        change_value: themode
                                    };
                                    processHubMessage(userid, modemsg, true);
                                }

                                if ( DEBUG21 ) {
                                    console.log( (ddbg()), "Location and Mode sink event from new ST hub: ", jsonshow(event) );
                                }
                            }
                        }).catch(reason => {
                            console.log( (ddbg()), reason );
                        });
                    }
                }
            
                res.json("200 OK");
            });
            res.end();
            
        // handle all api calls upon the server from js client and external api calls here
        // note - if user calls this externally then the userid and thingid values must be provided
        // most users won't know these values but they are shown on the showid page
        // GET calls from a browser are easier because the cookie will be set
        // this means that user GET API calls can only be made from a device that has HP running on it
        // POST calls can be made from any platform as long as the userid and thingid values are known
        } else if ( req.path==="/" &&  typeof req.body['useajax']!=="undefined" || typeof req.body["api"]!=="undefined" ) {
            var result = apiCall(null, req.body, "POST", req, res);

            // if api call returns a promise then handle it and return the promise result
            // otherwise we have a direct result that we can return to the browser
            if ( typeof result === "object" && typeof result.then === "function" ) {
                result.then(obj => {
                    if ( DEBUG1 ) {
                        console.log( (ddbg()), "apiCall promise returned: ", req.body["api"] || req.body["useajax"], " = ", obj );
                    }
                    res.json(obj);
                    res.end();
                });
            } else if ( typeof result === "string" ) {
                if ( DEBUG1 ) {
                    console.log( (ddbg()), "apiCall string returned: ", req.body["api"] || req.body["useajax"], " = ", result );
                }
                res.send(result);
                res.end;
            } else if ( result && typeof result === "object") {
                res.json(result);
                res.end();
            } else {
                var reason = "Invalid POST request";
                res.send(reason);
                res.end();
            };

        // handle unknown requests
        } else {
            console.log( (ddbg()), "HousePanel unknown POST to path: ", req.path, " body:", req.body);
            res.send("unknonwn message sent to HousePanel");
            res.end();
        }

    });

    // set up sockets
    setupBrowserSocket();
}
 