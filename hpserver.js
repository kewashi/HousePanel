#!/usr/bin/env node

"use strict";
process.title = 'hpserver';

// debug options
var EMULATEHUB = false;             // this emulates hub pushes and skips ISY sockets for local testing

const DEBUG1 = false;               // basic debug info - file loading, hub loading
const DEBUG2 = false;               // hub authorization
const DEBUG3 = false;               // passwords
const DEBUG4 = false;               // filters and options
const DEBUG5 = false;               // hub node detail
const DEBUG6 = false;               // tile adds and position moves
const DEBUG7 = false;               // hub responses
const DEBUG8 = false;               // API calls
const DEBUG9 =  false;              // ISY webSocket success
const DEBUG10 = false;              // customize post call debugs
const DEBUG11 = false;              // rules and lists
const DEBUG12 = false;              // hub push updates
const DEBUG13 = false;              // URL callbacks
const DEBUG14 = false;              // tile link details
const DEBUG15 = false;              // new user and forgot password
const DEBUG16 = false;              // writing, custom names, and image deletes
const DEBUG17 = false;              // websocket and push client
const DEBUG18 = false;              // detailed curl inspection
const DEBUG19 = false;              // ISY debug info
const DEBUG20 = false;              // login info
const DEBUGtmp = true;              // used to debug anything temporarily using ||

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
const cookieParser = require('cookie-parser');
const request = require('request');
const url = require('url');
const nodemailer = require('nodemailer');
const multer = require('multer');
const PUSHDELAY = 500;                               // delay to allow things to settle on startup
// const countrytime = require('countries-and-timezones');

// load supporting modules
var sqlclass = require("./mysqlclass");
var devhistory = require("./devhistory.js");
const { json } = require('stream/consumers');
const { config } = require('process');
const { type } = require('os');

// support for Ambient Weather API
const AmbientWeatherApi = require("ambient-weather-api");

// ISY websocket clients
var wsclient = {};

// global variables are all part of GLB object
var GLB = {};

GLB.devhistory = devhistory.DEV;
GLB.HPVERSION = GLB.devhistory.substring(1,9).trim();
GLB.APPNAME = 'HousePanel V' + GLB.HPVERSION;

// set a secret that changes every day - API calls must match this value
// it will fail if the call happens on exactly the border of a day but that should be extremely rare rare
var d = new Date().toString();
var k = d.indexOf(" ",14);
var dstr = d.substring(0, k);
GLB.apiSecret = getNewCode(dstr);
// GLB.warnonce = {};

GLB.defaultrooms = {
    "Kitchen": 1 ,
    "Family": 2,
    "Living": 3,
    "Office": 4,
    "Bedroom": 5,
    "Outside": 6,
    "Music": 7
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

GLB.ignoredISY = [
    "parent__", "deviceClass", "pnode", "startDelay", "endDelay"
];

    // this maps all supported types to their equivalents in ISY
    // if the type is not supported then nothing is translated
    // first element is a map of ISY id's to HousePanel id's
    // second element is a map of commands from HE to ISY with underscore items added to the device
    // ST maps are special, they include :on and :off variants for state handling or whatever states
    // third element is an array of hints that tell us the device type
    // final element is a map of ST states to ST names
    // switch inludes 4.16.x to support Zwave switches that show up with this hint
GLB.mainISYMap = {
    "isy":         [{"ST": "ST"},                                                      {"_query":"QUERY","_queryall":"QUERYALL","_discover":"DISCOVER"}, "0.0." ],

    "switch":      [{"GV0": "status_", "ST": "switch"},                                {"_query":"QUERY","_on":"DON","_off":"DOF","switch":"ST","ST:on":"DON","ST:off":"DOF"}, ["1.1.","4.16."] ],
    "switchlevel": [{"GV0": "status_", "ST": "switch", "OL": "level"},                 {"_query":"QUERY","_on":"DON","_off":"DOF","level":"SET_BRI","_dim":"DIM","_brighten":"BRIGHTEN",
                                                                                        "level-up":"BRIGHTEN","level-dn":"DIM","switch":"ST","ST:on":"DON","ST:off":"DOF"}, "1.2." ],
    "bulb":        [{"GV0": "status_", "ST": "switch", "OL": "level", "GV1":"color", 
                     "GV2":"colorname", "GV3": "hue", "GV4":"saturation"},             {"_query":"QUERY","_on":"DON","_off":"DOF","level":"SET_BRI","_dim":"DIM","_brighten":"BRIGHTEN",
                                                                                        "hue":"SET_HUE","saturation":"SET_SAT","hue-up":"HUE_UP","saturation-up":"SAT_UP","hue-dn":"HUE_DN","saturation-dn":"SAT_DN",
                                                                                        "switch":"ST","ST:on":"DON","ST:off":"DOF"}, "1.3." ],
    "button":      [{"GV0": "status_", "BATLVL": "battery", "ST": "numberOfButtons",
                     "GV1": "pushed", "GV2":"held", "GV3":"doubleTapped"},             {"_query":"QUERY","_push":"push","_hold":"hold","_doubleTap":"doubleTap","_release":"release"}, "1.4." ],
    "power":       [{"GV0": "status_", "ST": "switch", "CPW": "power", 
                     "TPW":"energy", "CV":"voltage", "CC":"current"},                  {"_query":"QUERY","_on":"DON", "_off":"DOF"}, "1.5" ],
    "water":       [{"GV0": "status_", "BATLVL": "battery", "ST": "water"},            {"_query":"QUERY","_wet":"WET", "_dry":"DRY"}, "1.6" ],

    "contact":     [{"GV0": "status_", "BATLVL": "battery", "ST": "contact"},          {"_query":"QUERY","_open":"OPEN","_close":"CLOSE"}, "7.1" ],
    "motion":      [{"GV0": "status_", "BATLVL": "battery", "ST": "motion"},           {"_query":"QUERY"}, "7.2.0" ],
    "aqaramotion": [{"GV0": "status_", "BATLVL": "battery", "ST": "motion",
                     "GV1": "presence", "GV2":"presence_type", 
                     "GV3":"roomState", "GV4":"roomActivity"},                         {"_query":"QUERY", "_setMotion":"setMotion", "_resetState":"resetState"}, "7.2.1" ],
    "presence":    [{"GV0": "status_", "BATLVL": "battery", "ST": "presence"},         {"_query":"QUERY","_arrived":"ARRIVE","_departed":"DEPART"}, "7.3" ],
    "cosensor":    [{"GV0": "status_", "BATLVL": "battery", "ST": "carbonMonoxide"},   {"_query":"QUERY","_clear":"CLEAR","_detected":"DETECTED","_test":"TEST"}, "7.4" ],
    "co2sensor":   [{"GV0": "status_", "BATLVL": "battery", "CO2LVL":"carbonDioxide"}, {"_query":"QUERY"}, "7.5" ],
    "smoke":       [{"GV0": "status_", "BATLVL": "battery", "ST": "smoke"},            {"_query":"QUERY","_clear":"CLEAR","_detected":"DETECTED","_test":"TEST"}, "7.6" ],
    "sleep":       [{"GV0": "status_", "BATLVL": "battery", "ST": "sleepSensor"},      {"_query":"QUERY","_arrived":"ARRIVE","_departed":"DEPART"}, "7.7" ],

    "door":        [{"GV0": "status_", "BATLVL": "battery", "ST": "door"},             {"_query":"QUERY","_open":"OPEN","_close":"CLOSE","door":"ST","ST:open":"OPEN","ST:close":"CLOSE"}, "2.1" ],
    "garage":      [{"GV0": "status_", "BATLVL": "battery", "ST": "door"},             {"_query":"QUERY","_open":"OPEN","_close":"CLOSE","door":"ST","ST:open":"OPEN","ST:close":"CLOSE"}, "2.2" ],
    "shade":       [{"GV0": "status_", "BATLVL": "battery", "ST": "windowShade", 
                     "OL": "position"},                                                {"_query":"QUERY","_open":"OPEN","_close":"CLOSE","_stop":"STOP","position":"SET_POS",
                                                                                        "_raise":"RAISE","_lower":"LOWER","windowShade":"ST","ST:open":"OPEN","ST:close":"CLOSE"}, "2.3" ],
    "valve":       [{"GV0": "status_", "BATLVL": "battery", "ST": "valve"},            {"valve":"ST","ST:open":"OPEN","ST:close":"CLOSE","_query":"QUERY","_open":"OPEN","_close":"CLOSE"}, "2.4" ],

    "lock":        [{"GV0": "status_", "BATLVL": "battery", "ST": "lock"},             {"_query":"QUERY","_unlock":"UNLOCK","_lock":"LOCK","lock":"ST","ST:lock":"UNLOCK","ST:unlock":"LOCK"}, "8.1" ],
    "mode":        [{"GV0": "status_", "MODE": "themode"},                             {"_query":"QUERY","_Day":"SET_DAY", "_Evening":"SET_EVENING", "_Night":"SET_NIGHT", "_Away":"SET_AWAY",
                                                                                        "themode":"MODE","MODE:Day":"SET_EVENING","MODE:Evening":"SET_NIGHT","MODE:Night":"SET_AWAY","MODE:Away":"SET_DAY"}, "8.2" ],
    "hsm":          [{"GV0": "status_", "ST": "status"},                               {"_query":"QUERY","_armaway":"armAway","_armHome":"armHome","_armNight":"armNight",
                                                                                        "_disarm":"disarm","_disarmAll":"disarmAll","_cancelAlerts":"cancelAlerts"}, "8.3" ],
    "thermostat":  [{"GV0": "status_", "BATLVL": "battery", "ST": "switch", 
                    "CLITEMP":"temperature", "CLIHUM": "humidity", 
                    "CLISPH": "heatingSetpoint", "CLISPC": "coolingSetpoint", 
                    "CLIMD": "thermostatMode", "CLIHCS": "thermostatOperatingState", 
                    "CLIFS": "thermostatFanMode", "CLIFRS": "thermostatFanSetting", 
                    "CLISMD": "thermostatHold"},                                       {"_query":"QUERY", "heatingSetpoint":"SET_HEAT", "heatingSetpoint-up":"HUP", "heatingSetpoint-dn":"HDN",
                                                                                        "coolingSetpoint":"SET_COOL", "coolingSetpoint-up":"CUP", "coolingSetpoint-dn":"CDN",
                                                                                        "_setThermostatMode":"SET_TMODE", "_setThermostatFanMode":"SET_FMODE"}, "5.1" ],
    "temperature": [{"GV0": "status_", "BATLVL": "battery", "TEMPOUT": "temperature",
                     "CLIHUM":"humidity"},                                             {"_query":"QUERY"}, "5.2" ], 
    "illuminance": [{"GV0": "status_", "BATLVL": "battery", "LUMIN": "illuminance"},   {"_query":"QUERY"}, "5.3" ],
    "other":       [{"GV0":"status_","BATLVL":"battery","ST":"switch","OL":"level"},   {"_query":"QUERY"}, "9.1" ],
    "actuator":    [{"GV0":"status_","BATLVL":"battery","ST":"switch","OL":"level"},   {"_query":"QUERY","_docmd":"DOCMD"}, "9.2" ],

    "music":       [ {"GV0": "status_", "ST": "status", "OL":"level", "SVOL":"mute"},  {"_previousTrack":"previousTrack","_pause":"pause","_play":"play","_stop":"stop","_nextTrack":"nextTrack",
                                                                                        "_volumeDown":"volumeDown","_volumeUp":"volumeUp","_mute":"mute","_unmute":"unmute","level":"SETVOL"}, "3.1" ]

};

// these are maps of index 25 integers to names
// they should match the en_us.txt file contents
GLB.indexMap = {
    "switch":       {"RR": {1:"9.0 min", 2:"8.0 min", 3:"7.0 min", 4:"6.0 min", 5:"5.0 min", 6:"4.5 min", 7:"4.0 min", 8:"3.5 min",
                            9:"3.0 min", 10:"2.5 min", 11:"2.0 min", 12:"1.5 min", 13:"1.0 min", 14:"47.0 sec", 15:"43.0 sec", 16:"38.5 sec",
                            17:"34.0 sec", 18:"32.0 sec", 19:"30.0 sec", 20:"28.0 sec", 21:"26.0 sec", 22:"23.5 sec", 23:"21.5 sec", 24:"19.0 sec",
                            25:"8.5 sec", 26:"6.5 sec", 27:"4.5 sec", 28:"2.0 sec", 29:"0.5 sec", 30:"0.3 sec", 31:"0.2 sec", 32:"0.1 sec"} },
    "switchlevel":  {"RR": {1:"9.0 min", 2:"8.0 min", 3:"7.0 min", 4:"6.0 min", 5:"5.0 min", 6:"4.5 min", 7:"4.0 min", 8:"3.5 min",
                            9:"3.0 min", 10:"2.5 min", 11:"2.0 min", 12:"1.5 min", 13:"1.0 min", 14:"47.0 sec", 15:"43.0 sec", 16:"38.5 sec",
                            17:"34.0 sec", 18:"32.0 sec", 19:"30.0 sec", 20:"28.0 sec", 21:"26.0 sec", 22:"23.5 sec", 23:"21.5 sec", 24:"19.0 sec",
                            25:"8.5 sec", 26:"6.5 sec", 27:"4.5 sec", 28:"2.0 sec", 29:"0.5 sec", 30:"0.3 sec", 31:"0.2 sec", 32:"0.1 sec"} },
    "bulb":         {"RR": {1:"9.0 min", 2:"8.0 min", 3:"7.0 min", 4:"6.0 min", 5:"5.0 min", 6:"4.5 min", 7:"4.0 min", 8:"3.5 min",
                            9:"3.0 min", 10:"2.5 min", 11:"2.0 min", 12:"1.5 min", 13:"1.0 min", 14:"47.0 sec", 15:"43.0 sec", 16:"38.5 sec",
                            17:"34.0 sec", 18:"32.0 sec", 19:"30.0 sec", 20:"28.0 sec", 21:"26.0 sec", 22:"23.5 sec", 23:"21.5 sec", 24:"19.0 sec",
                            25:"8.5 sec", 26:"6.5 sec", 27:"4.5 sec", 28:"2.0 sec", 29:"0.5 sec", 30:"0.3 sec", 31:"0.2 sec", 32:"0.1 sec"} },
    "water":        {"ST":  {1:"dry", 2: "wet", 3:"unknown"} },
    "motion":       {"ST":  {1:"inactive", 2:"active", 3:"unknown"} },
    "aqaramotion":  {"ST":  {1:"inactive", 2:"active", 3:"unknown"},
                     "GV1": {1:"present", 2:"absent", 3:"unknown"},
                     "GV2": {1:"enter", 2:"leave", 3:"approach", 4:"away", 5:"left_enter", 6:"left_leave", 7:"right_enter", 8:"right_leave", 9:"unknown"},
                     "GV3": {1:"occupied", 2:"unoccupied", 3:"unknown"},
                     "GV4": {1:"enter", 2:"leave", 3:"towards", 4:"away", 5:"enter (left)", 6:"leave (left)", 7:"enter (right)", 8:"leave (right)", 9:"unknown"} },
    "presence":     {"ST":  {1:"present", 2:"absent", 3:"unknown"} },
    "door":         {"ST":  {1:"open", 2:"closed", 3:"opening", 4:"closing", 5:"unknown"} },
    "garage":       {"ST":  {1:"open", 2:"closed", 3:"opening", 4:"closing", 5:"unknown"} },
    "shade":        {"ST":  {1:"open", 2:"closed", 3:"partially_open", 4:"unknown"} },
    "cosensor":     {"ST":  {1:"clear", 2:"tested", 3:"detected", 4:"unknown"} },
    "smoke":        {"ST":  {1:"clear", 2:"tested", 3:"detected", 4:"unknown"} },
    "hsm":          {"ST":  {1:"disarmed", 2:"armedAway", 3:"armedHome", 4:"armedNight", 5:"armingAway", 6:"armingHome", 7:"armingNight", 8:"allDisarmed", 9:"Not Installed", 10:"unknown"} },
    "music":        {"ST":  {1:"stopped", 2:"playing", 3:"paused", 4:"unknown"} },
    "mode":         {"MODE": {1:"Day", 2:"Evening", 3:"Night", 4:"Away", 3:"unknown"} }
};

GLB.ISYcolors = [
    'Black',  'White',  'Azure',    'Beige',  'Blue',   'Coral',
    'Crimson','Forest', 'Fuchsia',  'Golden', 'Gray',   'Green',
    'Pink',   'Indigo', 'Lavender', 'Lime',   'Maroon', 'Navy',
    'Olive',  'Red',    'Royal',    'Tan',    'Teal',   'Purple',
    'Yellow', 'Orange', 'Brown',    'Silver', 'Cyan',   'Custom'
];

// this map is for all supported uom values that use an array of settings
// all others just capture the numerica value into the field
// any uom = 25 must have the values specified in the above mapping object
// color is a special case
// refer to url: https://wiki.universal-devices.com/index.php?title=Polisy_Developers:ISY:API:Appendix:Units_of_Measure
GLB.uomMap = {
    2 :     {0:"false", 1:"true"},
    11 :    {0:"unlocked", 100: "locked", 101: "unknown", 102: "jammed"},
    66 :    {0:"idle", 1:"heating", 2:"cooling", 3:"fan_only", 4:"pending_heat",  5:"pending_cool",
             6:"vent", 7:"emergency", 8:"2nd_stage_heating", 9:"2nd_stage_cooling", 10:"2nd_stage_aux_heat", 11:"3rd_stage_aux_heat"},
    67 :    {0:"off", 1:"heat", 2:"cool", 3:"auto", 4:"emergency", 5:"resume", 6:"fan_only",
             7:"furnace", 8:"dry_air", 9:"moist_air", 10:"auto_changeover", 11:"energy_save_heat",
             12:"energy_save_cool", 13:"away", 14:"program_auto", 15:"program_heat", 16:"program_cool"},
    68 :    {0:"auto", 1:"on", 2:"auto_high", 3:"high", 4:"auto_medium", 5:"medium", 6:"circulation", 7:"humidity_circulation",
             8:"left_right_circulation", 9:"up_down_circulation", 10:"quiet"},
    75 :    {0:"Sunday", 1:"Monday", 2: "Tuesday", 3:"Wednesday", 4:"Thursday", 5:"Friday", 6:"Saturday"},
    78 :    {0:"off", 100: "on", 101:"unknown"},
    79 :    {0:"open", 100: "closed", 101:"unknown"},
    97 :    {0:"closed",100:"open",101:"unknown",102:"stopped",103:"closing",104:"opening"}
};

// this map contains the base capability for each type and all valid commands for that capability
// the keys here are unique to HousePanel and are used to define the type of thing on the panel
// the third entry is for mapping ISY hints to our types
// irrigation set same as switches and use pool hint for valves
GLB.capabilities = { 
    other: [ [], ["_on","_off"] ],
    actuator: [ [], ["_on","_off"] ],
    switch: [ ["switch"], ["_on","_off"] ],
    switchlevel: [ ["switch","switchLevel"], ["_on","_off"] ],
    bulb: [ ["colorControl","switch"],["_on","_off","color"] ], 
    button: [ ["button"],["_pushed","_held"] ],
    power: [ ["powerMeter","energyMeter"],null ],
    
    door: [ ["doorControl"],["_open","_close"] ], 
    garage: [ ["garageDoorControl"],["_open","_close"] ],
    shade: [ ["windowShade","switchLevel"],["_open","_close","_pause","_presetPosition"] ], 

    vacuum: [ ["robotCleanerCleaningMode"],["_auto","_part","_repeat","_manual","_stop"] ],
    washer: [ ["washerOperatingState","washerMode","switch"],["_on","_off","_pause","_run","_stop","_setWasherMode"] ],
    valve: [ ["valve"],["_open","_close"] ], 
    contact: [ ["contactSensor"],null ], 
    motion: [ ["motionSensor"],null ], 
    presence: [ ["presenceSensor"],null ], 
    acceleration: [ ["accelerationSensor"],null ], 
    voltage: [["voltageMeasurement"],null ],
    cosensor: [ ["carbonMonoxideMeasurement"],null ], 
    co2sensor: [ ["carbonDioxideMeasurement"],null ], 
    dust: [ ["dustSensor"],null ], 
    water: [ ["waterSensor"],null ],
    smoke: [ ["smokeDetector"],null ],
    alarm: [ ["alarm"],["_both","_off","_siren","_strobe"] ], 
    sound: [ ["soundSensor"],null ], 
    tamper: [ ["tamperAlert"],null ], 
    tone: [ ["tone"],["_beep"] ], 
    thermostat: [ ["temperatureMeasurement","thermostatMode","thermostatHeatingSetpoint","thermostatCoolingSetpoint","thermostatOperatingState"],null ],
    temperature: [ ["temperatureMeasurement"],null ], 
    illuminance: [ ["illuminanceMeasurement"],null ],
    fan: [ ["fanSpeed"],null ],
    weather: [ ["temperatureMeasurement","relativeHumidityMeasurement","illuminanceMeasurement"],["_refresh"] ],
    airquality: [ ["airQualitySensor"],null ], 
    uvindex: [["ultravioletIndex"],null ],
    lock: [ ["lock"],["_unlock","_lock"] ],
    music: [ ["mediaPlayback"], ["_previousTrack","_pause","_play","_stop","_nextTrack","_volumeDown","_volumeUp","_mute","_unmute","_refresh"] ],
    audio: [ ["mediaPlayback","audioVolume","audioMute"],["_previousTrack","_pause","_play","_stop","_nextTrack","_volumeDown","_volumeUp","_mute","_unmute","_refresh"] ],

    location: [ ["location"],["_refresh"],null ]
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
// the way the id is written on the Insteon device so I disabled doing anything here
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
    
    // load jQuery and themes
    $tc += '<link rel="stylesheet" type="text/css" href="jquery-ui.css">';
    // $tc += '<script src="jquery-1.12.4.min.js"></script>';
    $tc += '<script src="jquery-3.7.1.min.js"></script>';
    $tc += '<script src="jquery-ui.min.js"></script>';
    $tc += '<link rel="stylesheet" type="text/css" href="jquery-ui.theme.css">';
    // $tc += '<script src="jquery-migrate-3.4.0.js"></script>';

    // include hack from touchpunch.furf.com to enable touch punch through for tablets
    // $tc += '<script src="jquery.ui.touch-punch.min.js"></script>';
    $tc += '<script type="text/javascript" src="jquery.mobile-events.js"></script>';
    if ( !skip ) {
        // minicolors library
        $tc += '<script src="jquery.minicolors.min.js"></script>';
        $tc += '<link rel="stylesheet" href="jquery.minicolors.css">';

        // analog clock support
        $tc += '<!--[if IE]><script type="text/javascript" src="excanvas.js"></script><![endif]-->';
        $tc += '<script type="text/javascript" src="coolclock.js"></script>';
    }

    // chart capability loaded here
    $tc += '<script type="text/javascript" src="node_modules/chart.js/dist/chart.umd.js"></script>';
    // $tc += '<script type="text/javascript" src="node_modules/chart.js/dist/chart.js"></script>';
    
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
    if ( typeof obj === "object" ) {
        return UTIL.inspect(obj, false, null, false);
    } else {
        return obj;
    }
}

// trying to not use encoding - but we have to replace single quotes to avoid messing up the DB
function encodeURI2(obj) {
    var str = JSON.stringify(obj)
    str = str.replace(/'/g,"%27");
    // return encodeURI(str);
    return str;
}

function decodeURI2(str) {
    if ( typeof str === "object" ) {
        return str;
    } else if ( !str || typeof str !== "string" ) {
        return null;
    }
    
    var obj;
    var decodestr = str;
    decodestr = decodestr.replace(/%27/g,"'");
    
    // if ( str.startsWith("%7B") ) {
    //     decodestr = decodeURI(str);
    // }
    try {
        obj = JSON.parse(decodestr);
    } catch(e) {
        obj = decodestr;
    }
    return obj;
}

function hsv2rgb(h, s, v) {
    var r, g, b;

    function toHex(thenumber) {
        var hex = parseInt(thenumber.toString(),16);
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
    
    r = Math.round(r*255);
    g = Math.round(g*255);
    b = Math.round(b*255);
    
    var rhex = toHex(r);
    var ghex = toHex(g);
    var bhex = toHex(b);
    return "#"+rhex+ghex+bhex;
}

function rgb2hsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    var max = Math.max(r, Math.max(g, b));
    var min = Math.min(r, Math.min(g, b));
    var h = max;
    var v = max;
    var d = max - min;
    var s = max == 0 ? 0 : d / max;
    if (max === min) {
        h = 0
    } else {
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    var h100 = h*100;
    h100 = h100.toInteger();
    h = h*360;
    h = h.toInteger();
    // h = mapMinMax(h,0,1,0,360);
    s *= 100;
    s = s.toInteger();
    v *= 100;
    v = v.toInteger();
    return [h, s, v, h100]
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

// updated this function to work with array of configs or a single config
// if a single config is sent the tag should match the configkey of that object
function getConfigItem(configoptions, tag) {
    // skip everything if configs are not defined or bogus tag given
    if ( !configoptions || !tag ) {
        return null;
    }

    var result = null;
    if ( is_array(configoptions) ) {
        try {
            configoptions.forEach(function(opt) {
                if ( opt.configkey === tag ) {
                    result = opt.configval;
                }
            });
        } catch(e) {
            result = null;
        }
    } else {
        try {
            if ( tag === configoptions.configkey ) {
                result = configoptions.configval;
            }
        } catch(e) {
            result = null;
        }
    }

    // try converting to object
    if ( (result && typeof result === "string") && 
         (tag==="useroptions" || tag==="usroptions" || tag==="specialtiles" || tag.startsWith("user_") || tag==="clipboard" || result.startsWith("[") || result.startsWith("{")) ) {
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

    // this will honor the old style of storing the hash with a leading pnumber: but will also work with just the hash value
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
                var emailname = row["users_email"];

                // if username hash matches uname hash or email hash and if panel name hash match then proceed
                if ( ( pw_hash(emailname) === uhash || pw_hash(row["users_uname"]) === uhash ) && 
                        ( pw_hash(row["panels_pname"]) === phash ) ) {
                    therow = row;

                    // fix legacy logins that don't have a hpcode security check
                    if ( !therow["users_hpcode"] ) {
                        var permcode = getNewCode(emailname);
                        therow["users_hpcode"] = permcode;
                        mydb.updateRow("users",{hpcode: permcode},"id = "+ row["users_id"])
                        .then( () => {
                            console.log( (ddbg()), "Added missing API security code to login user:", emailname, 
                                                   "For security purposes, all API calls will use hpcode="+permcode);
                        })
                        .catch( reason => {
                            console.error( (ddbg()), "error updating user hpcode: ", reason);
                        });
                    }
                    break;
                }
            }
        }
        return therow;
    })
    .catch(reason => {
        console.error( (ddbg()), "user not found, returning null. reason: ", reason);
        return null;
    });
    return result;
}

// TODO - use DB query on devices table
function getTypes() {

    // all sessions have these types
    var hubtypes = Object.keys(GLB.mainISYMap);
    var blanktypes = ["blank", "custom", "frame", "image", "piston",
                      "video", "control", "variables", "clock"];
    var thingtypes = hubtypes.concat(blanktypes);

    // add hubitat specific types
    if ( array_key_exists("Hubitat", GLB.dbinfo.hubs) ) {
        var hetypes = ["hsm","piston","music","audio","weather","actuator","other"];
        hetypes.forEach( key => {
            if ( !thingtypes.includes(key) ) {
                thingtypes.push(key);
            }
        });
    }

    if ( array_key_exists("ISY", GLB.dbinfo.hubs) ) {
        if ( !thingtypes.includes("isy") ) {
            thingtypes.push("isy");
        }
    }

    thingtypes.sort();
    return thingtypes;
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
            console.error( (ddbg()), "error writing custom CSS file: ", e);
        }
    } else {
        console.error( (ddbg()), "custom CSS file not saved to file:", fname);
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

function sendEmail(emailname, msg, addinfo = "") {
    if ( emailname ) {
        var transporter = nodemailer.createTransport({
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
        var textmsg = "";
        var htmlmsg = "";
        if ( addinfo ) {
            textmsg+= "If you did not request " + addinfo + " for user [" + emailname + "] please ignore this email.\n\n";
            textmsg+= "If there is an active link below, click it to proceed, or paste it into a browser window.\n\n";
            htmlmsg = "<strong>If you did not request " + addinfo + " for user [" + emailname + "] please ignore this email.</strong><br><br>";
        }
        textmsg+= msg;
        htmlmsg+= msg;
        var message = {
            from: GLB.dbinfo.emailuser,
            to: emailname,
            subject: "HousePanel administration message",
            text: textmsg,
            html: htmlmsg
        };

        // send the email
        transporter.sendMail(message, function(err, info) {
            if ( err ) {
                console.warn( (ddbg()), "error sending email to: ", emailname, " error: ", err);
            } else {
                console.log( (ddbg()), "email successfully sent to: ", emailname, " response: ", info.response);
            }
        });
    }
}

// function json2query(params) {
//     var queryString = Object.keys(params).map(key => key + '=' + params[key]).join('&');
//     return queryString;   
// }

// this curl function uses promises so it can be chained with .then() like any other promise
function _curl(host, headers, nvpstr, calltype, callback) {
    var promise = new Promise(function(resolve, reject) {
        // var myURL = url.parse(host);
        if ( ! host.startsWith("http") ) {
            host = "http://" + host;
        }
        var myURL = new URL(host);
        var path = myURL.pathname;
        if ( DEBUG18 ) {
            console.log( (ddbg()),"myURL: ", myURL );
        }

        // add query string if given separately
        var formbuff;
        if ( nvpstr ) {
            if ( calltype!=="GET" ) {
                if ( typeof nvpstr === "object" ) {
                    formbuff = Buffer.from(JSON.stringify(nvpstr));
                } else {
                    formbuff = nvpstr.toString(); // Buffer.from(nvpstr);
                }
            } else { 
                if ( typeof nvpstr === "object" ) {
                    nvpstr = json2query(nvpstr);
                } else {
                    nvpstr = nvpstr.toString();
                }
                path = path + "?" + nvpstr; 
            }
        }

        if ( DEBUG18 ) {
            console.log((ddbg()), "_curl buffer: ", formbuff, " path: ", path);
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
        const opts = {
            hostname: myURL.hostname,
            port: myport,
            path: path,
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
        if ( DEBUG18 ) {
            console.log((ddbg()), "_curl opts: ", opts);
        }
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

        function curlResponse(res) {
            res.setEncoding('utf8');
            var statusCode = res.statusCode;
            var statusMsg = res.statusMessage;
            res.on("data", (body) => {
                totalbody+= body;
                if ( DEBUG18 ) {
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
                if ( DEBUG18 ) {
                    console.log((ddbg()), "end of _curl message. status: ", statusCode, statusMsg, " body: ", totalbody);
                }
            });
        }
    });
    return promise;
}

// Made this into a promise function
function curl_call(host, headertype, nvpstr, formdata, calltype, callback = null) {
    var promise = new Promise(function(resolve, reject) {
        var opts = {url: host, rejectUnauthorized: false};
        if ( calltype!=="GET" && calltype!=="POST" ) {
            reject("invalid calltype " + calltype);
            return;
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
        request(opts, curlCallback);

        function curlCallback(err, res, body) {
            if ( err ) {
                console.error( (ddbg()), "curl call error: ", err);
                reject(err);
            } else {
                if ( DEBUG18 ) {
                    console.log((ddbg()), "curl_call resolved, body: ", body, " \n res: ", res);
                }

                // process the callback if one provided
                // but typically this isn't done with promises
                if ( callback && typeof callback === "function"  ) {
                    callback(err, res, body);
                }

                // resolve(body);
                // // convert body to json or xml depending on what it looks like
                var jsonbody;
                if ( typeof body==="object" || !body ) {
                    resolve(body);
                } else if ( typeof body==="string" && (body.startsWith("{") || body.startsWith("[")) ) {
                    try {
                        jsonbody = JSON.parse(body);
                    } catch (e) {
                        jsonbody = body;
                    }
                    resolve(jsonbody);
                } else if ( typeof body==="string"  && body.startsWith("<") ) {
                    xml2js(body, function(xmlerr, result) {
                        if ( xmlerr ) {
                            reject(xmlerr);
                        } else {
                            resolve(result);
                        }
                    });
                } else {
                    try {
                        jsonbody = JSON.parse(body);
                    } catch (e) {
                        jsonbody = body;
                    }
                    resolve(jsonbody);
                }
            }
        }
    });

    return promise;
}

// rewrote this function to use promises and return actual results when it is done
// this way hub authorizations work and return number of devices properly
// now we use this to return all info about the hub including accessToken info
function getHubInfo(hub) {
    if ( DEBUG2 ) {
        console.log( (ddbg()), "hub: ", hub);
    }

    // use promises so we can return actual number of devices returned
    const errMsg = "error reading hub";
    var access_token = hub.hubaccess;
    var hubEndpt = hub.hubendpt;
    var userid = hub.userid;

    var promise = new Promise( function(resolve, reject) {
    
        // for Hubitat hubs we make a call to get hub name and other info
        // we always use the non-Bearer version now even though the old code is still there
        if ( hub.hubtype==="Hubitat" ) {
            var nvpreq = {"access_token": access_token};
            // var nvpreq = "access_token="+access_token;
            var header = {
                "Content-Type": "application/json"
            };
            curl_call(hubEndpt + "/gethubinfo", header, nvpreq, false, "POST")
            .then(body => {
                hubitatCallback(body);
            })
            .catch(reason => {
                reject(reason);
            })

        // this branch is for ISY and other hubs that don't need to get their name via a hub call
        } else {
            if ( hub.hubid=== hub.hubtype + "_new" ) {
                var rstr = getRandomInt(1001, 9999);
                hub.hubid = hub.hubtype + rstr.toString();
            }
            updateHub(hub);
        }

        // this saves hubid in the user table and updates or adds the hub to the hub table
        // and then calls routine to retreive devices from the hub and return them in an array
        function updateHub(hub) {

            Promise.all([
                mydb.updateRow("users",{defhub: hub.hubid}, "id = " + userid, true),
                mydb.updateRow("hubs", hub, "userid = " + userid+" AND id = " + hub.id, true),
                getDevices(hub)
            ])
            .then( res => {
                var devices = res[2];
                removeDeadThings(userid);
                resolve(devices);
            }).catch(reason => {
                console.error( (ddbg()), reason);
                reject(reason);
            });
        }

        // function hubitatCallback(err, res, body) {
        function hubitatCallback(body) {
            var hubName = hub.hubname;
            var hubId = hub.hubid;

            try {
                if ( body["sitename"] ) {
                    hubName = body["sitename"];
                } else {
                    console.warn( (ddbg()), "warning - Hub name is not defined so using the user provided name: ", hubName);
                }

                if ( body["hubId"] ) {
                    hubId = body["hubId"];
                } else {
                    console.error( (ddbg()), "error - hubId was not obtained from the hub.");
                    reject("hubId was not obtained from the hub");
                    return;
                }
            } catch(e) {
                console.error( (ddbg()), "error retrieving hub ID and name. ", e, "\n body: ", body);
                reject(e);
                return;
            }

            if ( DEBUG2 ) {
                console.log((ddbg()), "hub info returned: ", jsonbody);
            }
            
            // now update the placeholders with the real hub name and ID
            // we now get even more info back from the hub but we don't need it
            hub.hubname  = hubName;
            hub.hubid = hubId;
            updateHub(hub);
        }
    
    });
    return promise;
}

function removeHublessDevices(userid) {

    return mydb.getRows("hubs","id", "userid = "+userid)
    .then(rows => {
        var idarr = [];
        rows.forEach(row => {
            idarr.push(row.id);
        });
        var idstr = "(" + idarr.join(",") + ")";

        if ( DEBUG2 ) {
            mydb.getRows("devices","id,userid,hubid,deviceid,name,devicetype", "userid = "+userid+" AND hubid NOT IN " + idstr)
            .then(devices => {
                if ( devices && devices.length ) {
                    if ( DEBUG2 ) {
                        console.log( (ddbg()), "Removing " + devices.length + " dead devices");
                    }
                }
            })
            .catch(reason => {
                console.warn( (ddbg()), reason );
            });
        }

        return mydb.deleteRow("devices","userid = "+userid+" AND hubid NOT IN " + idstr)
        .then( devices => {
            var numdel = devices.getAffectedItemsCount();
            return numdel;
        })
        .catch(reason => {
            console.warn( (ddbg()), reason );
            return 0;
        });
    })
    .catch(reason => {
        console.warn( (ddbg()), reason );
        return 0;
    });
}

function removeDeadThings(userid) {

    return mydb.getRows("devices","id", "userid = "+userid)
    .then(rows => {
        var idarr = [];
        rows.forEach(row => {
            idarr.push(row.id);
        });
        var idstr = "(" + idarr.join(",") + ")";

        // use query to remove all tiles that do not have a corresponding device in the DB
        // this will remove it from all rooms and panels
        return mydb.deleteRow("things",`userid = ${userid} AND tileid NOT IN ${idstr}`)
        .then(res => {
            var numdeltiles = res.getAffectedItemsCount();
            if ( numdeltiles > 0 ) {
                if ( DEBUG2 ) {
                    console.log( (ddbg()), `removed ${numdeltiles} things that are no longer authorized`);
                }
            }
            return numdeltiles;
        })
        .catch(reason => {
            console.warn( (ddbg()), reason );
            return 0;
        });
    })
    .catch(reason => {
        console.warn( (ddbg()), reason );
        return 0;
    });
}

// rewrote this to use a promise to return the actual array of devices or a reject with a message
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
        var uidmax = 0;

        if ( !is_object(hub) ) {
            reject("error - hub object not provided to getDevices call");
            return;
        }

        if ( !hubid ) {
            console.log( (ddbg()), "error - hubid not found in DB. hub: ", hub);
            reject("error - hubid not proviced");

        } else if ( hubid === "-1" ) {
            getDefaultDevices();

        } else if ( !hubAccess || !hubEndpt ) {
            console.error( (ddbg()), "error - hub has not been authorized. hub: ", hub);
            reject("error - hub has not been authorized");

        // retrieve all things from Hubitat
        } else if ( hubType==="Hubitat" ) {
            getGroovyDevices()
            .then(body => {
                getAmbientDevices(body)
                .then(ambdevices => {
                    hubInfoCallback(ambdevices);
                });
            })
            .catch(reason => {
                console.error( (ddbg()), reason );
            });

        // retrieve all things from ISY
        } else if ( hubType==="ISY" ) {
            if ( EMULATEHUB===true ) {
                resolve("Emulating ISY hub for local testing");
            } else {
                getIsyDevices();
            }

        } else {
            console.error( (ddbg()), "error - attempt to read an unknown hub type= ", hubType);
            reject("error - attempt to read an unknown hub type= " + hubType);
        }

        // this retrieves the devices not tied to a hub
        // all of these are already in the database and don't need changing
        // clocks will be updated with current time and images will be updated
        function getDefaultDevices() {
            var dclock, aclock;
            var mydevices = {};
    
            var dclock = getClock("clockdigital");
            dclock = encodeURI2(dclock);
            var aclock = getClock("clockanalog");
            aclock = encodeURI2(aclock);
            var acontrol = getController();
            acontrol = encodeURI2(acontrol);

            return mydb.query("select max(uid) from devices where userid = " + userid)
            .then(res => {
                uidmax = Object.values(res)[0];
                if ( DEBUG1 ) {
                    console.log((ddbg()), "Default Devices - uidmax: ", uidmax);
                }
                return mydb.getRows("devices", "*", "userid = "+userid + " AND (devicetype = 'clock' OR devicetype = 'control' or hint = 'special')")
                // think this should use hubid = hubindex
            })
            .then( rows => {
                if ( rows ) {
                    var updrow;
                    var n = 0;
                    var rowcount = rows.length;
                    rows.forEach(device => {
                        updrow = false;
                        if ( device.deviceid === "clockdigital" ) {
                            device.pvalue = dclock;
                            updrow = true;
                        } else if ( device.deviceid === "clockanalog" ) {
                            device.pvalue = aclock;
                            updrow = true;
                        } else if ( device.deviceid === "control_1" ) {
                            device.pvalue = acontrol;
                            updrow = true;
                        }
                        if ( device.uid === 0 ) {
                            uidmax++;
                            device.uid = uidmax;
                            updrow = true;
                        }
                        mydevices[device.deviceid] = device;

                        // update the row and count down to being done
                        if ( updrow ) {
                            mydb.updateRow("devices", device, "userid = "+userid+" AND id = " + device.id, true)
                            .then(res => {
                                n++;
                                if ( n >= rowcount ) {
                                    resolve(mydevices);
                                }    
                            })
                            .catch( reason => {
                                console.error( (ddbg()), "error - something went wrong updating non-hub devices such as clock and control devices. ", reason);
                                reject(reason);
                            });
                        } else {
                            n++;
                            if ( n >= rowcount ) {
                                resolve(mydevices);
                            }
                        }
                    });
                } else {
                    reject("error - no default devices found in the database");
                }
                return mydevices;
            })
            .catch (reason => {
                console.error( (ddbg()), "error attempting to read default devices: ", reason);
                reject(reason);
            });
        }

        // Hubitat call to Groovy API
        function getGroovyDevices() {
            const errMsg = "error retrieving devices from this Hubitat hub";

            var params = {"access_token": hubAccess};
            // var params = "access_token="+hubAccess;
            var header = {
                "Content-Type": "application/json"
            };

            // first get the max ID number and the first free ID number
            // and make available to the callback from hubitat hub getallthings call
            // note that query returns an object with the result in the value of the single pair
            // the commented code will return next gap but I don't use this because it is too slow so I live with gaps and big ID's since uid will be small
            // also we would need to find the next gap for each device after the device updated which would be painfully slow
            // mydb.query(`select c.id + 1 from devices c left join devices cfree on cfree.id = c.id + 1 where (cfree.id is null or cfree.id = ${idp1}) and c.userid = 2 order by c.id limit 1;`)
            return mydb.query("select max(uid) from devices where userid = " + userid)
            .then(res => {
                uidmax = Object.values(res)[0];
                if ( DEBUG1 ) {
                    console.log((ddbg()), "Groovy Devices - uidmax: ", uidmax);
                }
                return curl_call(hubEndpt + "/getallthings", header, params, false, "POST");
            });
        }

        function getAmbientDevices(hubdevices) {

            // patch in Ambient Weather here if there is an App key and an API key
            if ( GLB.dbinfo.ambientappkey && GLB.dbinfo.ambientapi && GLB.dbinfo.ambientapi!=="notyet" ) {
                const AmbientWeatherApi = require("ambient-weather-api");
                const api = new AmbientWeatherApi({
                    apiKey: GLB.dbinfo.ambientapi,
                    applicationKey: GLB.dbinfo.ambientappkey
                });

                return new Promise( function(resolve, reject) {
                    api.userDevices()
                    .then( devices => {
                        // add a tile for each ambient weather device
                        let num = 0;
                        devices.forEach( device => {
                            let newdevice = {};
                            newdevice.type = "weather";
                            newdevice.id = device.macAddress.replace(/:/g, "").toLowerCase();
                            newdevice.name = device.info.name;
                            newdevice.hint = "AmbientWeather";
                            newdevice.value = {};
                            
                            api.deviceData(device.macAddress, {limit: 1})
                            .then( devicedata => {
                                // for now we capture all fields, later we may want to filter some out
                                for ( let key in devicedata[0] ) {
                                    let dataval = devicedata[0][key];
                                    if ( key === "dateutc" || key==="date" || key==="lastRain" ) {
                                        // convert this to a human readable date and time
                                        let d = new Date(dataval);
                                        dataval = d.toLocaleString();
                                    // change temp field name to temperature
                                    } else if ( key === "tempf" ) {
                                        key = "temperature";
                                    // change battery fields to display good or bad based on 1 or 0 value
                                    } else if ( key.startsWith("batt") ) {
                                        if ( dataval === 1 || dataval === "1" ) {
                                            dataval = "good";
                                        } else if ( dataval === 0 || dataval === "0" ) {
                                            dataval = "low";
                                        } else {
                                            dataval = "unknown";
                                        }
                                        key = "battery" + key.substring(5);
                                    }
                                    newdevice.value[key] = dataval;
                                }
                                hubdevices.push(newdevice);
                                num++;
                                if (num >= devices.length ) {
                                    if ( DEBUG7 ) {
                                        console.log( (ddbg()), "finished retrieving Ambient Weather devices. Total devices: ", num, " devices added to hubdevices array");
                                    }
                                    resolve(hubdevices);
                                }
                            })
                            .catch( reason => {
                                console.error( (ddbg()), "error retrieving ambient weather data for device: ", device.macAddress, " reason: ", reason);
                                reject(reason);
                            });
                        });
                    })
                    .catch( reason => {
                        console.error( (ddbg()), "error retrieving ambient weather devices. reason: ", reason);
                        reject(reason);
                    });
                });
            } else {
                return new Promise( (resolve, reject) => {
                    console.warn( (ddbg()), "Ambient Weather API keys not found. Ambient Weather devices will not be added.");
                    resolve(hubdevices);
                });
            }
        }
        

            // callback for loading Hubitat devices
            function hubInfoCallback(jsonbody) {
                var mydevices = {};

                // configure returned array with the "id"
                if (jsonbody && is_array(jsonbody) ) {
                    var devicecnt = 0;
                    var numdevices = jsonbody.length;
                    var currentDevices = [];

                    // now add them one at a time until we have them all
                    jsonbody.forEach(function(content) {
                        var thetype = content["type"];
                        var deviceid = content["id"];
                        var origname = content["name"] || "";
                        var pvalue = content["value"];
                        var hint = content["hint"] ? content["hint"] : hubType;
                        var refresh = "never";

                        if ( !pvalue ) {
                            console.warn((ddbg()),"Something went wrong loading Hubitat device: ", content);
                            pvalue = {};
                            // reject("error - no value returned for device named: " + origname);
                            // return;
                        }
                        
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
                        if ( pvalue["presence"]==="not present" || pvalue["presence"]==="not_present" ) {
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

                        // handle weather tiles and any that comes as an object
                        // we handle music tile translation now on the groovy side to support ISY node servers
                        if ( thetype==="weather" ) {
                            pvalue = translateWeather(pvalue);
                        } else {
                            pvalue = translateObjects(pvalue, 2);
                        }

                        // make the device to store or update
                        var pvalstr = encodeURI2(pvalue);
                        var device = {userid: userid, hubid: hubindex, deviceid: deviceid, name: origname, 
                                      devicetype: thetype, hint: hint, refresh: refresh, pvalue: pvalstr};

                        // check if this is a device update or adding a new device
                        // if device exists and uid is zero, update this record to include a new uid field
                        mydb.getRow("devices", "id,uid", `userid = ${userid} AND hubid = ${hubindex} AND devicetype = '${thetype}' AND deviceid = '${deviceid}'`)
                        .then(resp => {
                            if ( resp ) {
                                device.id = resp.id;
                                // get the visual id and update if old database version
                                if ( resp.uid === 0 ) {
                                    uidmax++;
                                    device.uid = uidmax;
                                } else {
                                    device.uid = resp.uid;
                                }
                                return mydb.updateRow("devices", device, `id = ${device.id} AND userid = ${userid}`, true);
                            } else {
                                uidmax++;
                                device.uid = uidmax;
                                return mydb.addRow("devices", device);
                            }
                        })
                        .then(res => {

                            mydevices[deviceid] = device;
                            const devstr = "'" + deviceid + "'";
                            if ( !currentDevices.includes(devstr) ) {
                                currentDevices.push(devstr);
                            }

                            devicecnt++;
                            // check if this is our last one and return array of devices
                            if ( devicecnt >= numdevices ) {
                                removeDeadNodes(userid, hubindex, currentDevices)
                                .then( () => {
                                    resolve(mydevices);
                                })
                                .catch(reason => {
                                    console.warn( (ddbg()), reason );
                                    resolve(mydevices);
                                });
                            }                    
                        })
                        .catch( reason => {
                            console.error( (ddbg()), reason );
                        });
                    });

                } else {
                    // an error occurred with this hub
                    reject(errMsg);
                }
            }  

        // rewrote this to first remove devices and then remove tiles that are stranded
        // this version uses db queries which is much faster than what was here before
        // switched from checking deviceid to the id to ensure we remove duplicates too
        function removeDeadNodes(userid, hubindex, currentDevices) {

            // remove all devices that are tied to the queried hub but not returned by the query
            var indev = "(" + currentDevices.join(",") + ")";

            if ( DEBUG2 ) {
                mydb.getRows("devices","id, hubid, deviceid, name, devicetype, hint", "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid NOT IN " + indev)
                .then(devices => {
                    if ( devices && devices.length && DEBUG2 ) {
                        console.log( (ddbg()), "Dead node and duplicate devices to delete: ", jsonshow(devices) );
                    }
                });
            }

            return mydb.deleteRow("devices","userid = "+userid+" AND hubid = "+hubindex+" AND deviceid NOT IN " + indev)
            .then( results => {
                var numdeldevices = results.getAffectedItemsCount();
                if ( numdeldevices === null ) {
                    numdeldevices = 0;
                }
                if ( DEBUG2 && numdeldevices ) {
                    console.log( (ddbg()), "Removed ", numdeldevices, " dead node and duplicate devices." );
                }
                return numdeldevices;
            })
            .catch(reason => {
                console.warn( (ddbg()), reason );
                return 0;
            });
        }

        // function for loading ISY hub devices
        function getIsyDevices() {

            var hubindex = hub.id;
            var userid = hub.userid;
            var hubEndpt = hub.hubendpt;
            var access_token  = hub.hubaccess;
        
            const errMsg = "error retrieving devices from ISY hub with accessToken = " + access_token;
            var buff = Buffer.from(access_token);
            var base64 = buff.toString('base64');
            var stheader = {"Authorization": "Basic " + base64};
            // var vardefs = {};
    
            // use this object to keep track of which things are done
            var done = {"variables" : false, "programs" : false, "nodes" : false, "groups": false, "states": false };
    
            // now read in any int and state variables and their definitions
            var mydevices = {};
            var variables = {name: "ISY Variables", "status_": "ACTIVE"};

            if ( DEBUG19 ) {
                console.log((ddbg()), "ISY hub call: ", access_token, hubEndpt, stheader);
            }

            var currentDevices = [];
            mydb.query("select max(uid) from devices where userid = " + userid)
            .then(res => {
                uidmax = Object.values(res)[0];
                if ( DEBUG1 ) {
                    console.log((ddbg()), "results (max): ", res);
                }
                return Promise.all([
                    curl_call(hubEndpt + "/vars/definitions/1", stheader, false, false, "GET"),
                    curl_call(hubEndpt + "/vars/definitions/2", stheader, false, false, "GET"),
                    curl_call(hubEndpt + "/vars/get/1", stheader, false, false, "GET"),
                    curl_call(hubEndpt + "/vars/get/2", stheader, false, false, "GET")
                ]);
            })
            .then(results => {
                getISY_Defs(results[0], "Int");
                getISY_Defs(results[1], "State");
                getISY_Vars(results[2], "Int");
                getISY_Vars(results[3], "State");
                saveVariables();
                return curl_call(hubEndpt + "/programs?subfolders=true", stheader, false, false, "GET");
            })
            .then(results => {
                getAllProgs(results);
                return curl_call(hubEndpt + "/nodes", stheader, false, false, "GET");
            })
            .then(results => {
                getAllNodes(results);
                return curl_call(hubEndpt + "/status", stheader, false, false, "GET");
            })
            .then(results => {
                getStatusInfo(results);
                // resolve (mydevices);
            })
            .catch(reason => {
                console.error( (ddbg()), reason );
            });

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

            function saveVariables() {
                variables = sortVariables(variables);
                var pvalstr = encodeURI2(variables);
                var devid = "isy_variables";

                // grab the list of device id's to process duplicate removal later
                var sqldevid = "'" + devid + "'";
                if ( !currentDevices.includes(sqldevid) ) {
                    currentDevices.push(sqldevid);
                }
                var device = {userid: userid, hubid: hubindex, deviceid: devid, name: variables.name, 
                              devicetype: "variables", hint: "ISY_variable", refresh: "never", pvalue: pvalstr};

                mydb.getRow("devices", "id,uid", `userid = ${userid} AND hubid = ${hubindex} AND devicetype = 'variables' AND deviceid = '${devid}'`)
                .then(resp => {
                    if ( resp ) {
                        device.id = resp.id;
                        // get the visual id and update if old database version
                        if ( resp.uid === 0 ) {
                            uidmax++;
                            device.uid = uidmax;
                        } else {
                            device.uid = resp.uid;
                        }
                        mydb.updateRow("devices", device, `id = ${device.id} AND hubid = ${hubindex} AND userid = ${userid}`, true);
                    } else {
                        uidmax++;
                        device.uid = uidmax;
                        mydb.addRow("devices", device);
                    }
                    checkDone("variables");
                })
                .catch( reason => {
                    console.error( (ddbg()), reason );
                });
            }
                
            function checkDone( stage, flag = "" ) {
                if ( stage ) {
                    done[ stage ] = true;
                }
                if ( DEBUG19 ) {
                    console.log( (ddbg()), "stage: ", stage, " flag: ", flag, " done: ", done);
                }

                if ( done["variables"] && done["programs"] && done["nodes"] && done["groups"] && done["states"] ) {
                    // resolve(mydevices);
                    removeDeadNodes(userid, hubindex, currentDevices)
                    .then( () => {
                        resolve(mydevices);
                    })
                    .catch(reason => {
                        console.warn( (ddbg()), reason );
                        resolve(mydevices);
                    });
                }
                return done;
            }

            function getISY_Defs( result, vartype ) {
                if (DEBUG19 && result) {
                    console.log( (ddbg()), vartype + " variables defs: ", UTIL.inspect(result, false, null, false) );
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
                    } catch (e) {
                        varid = 0;
                        varname = "";
                    }
                    if ( varid > 0 ) {
                        variables["def_"+defname+varid] = varname;
                    }
                });
            }
               
            function getISY_Vars(result, vartype) {
                if (DEBUG19 && result) {
                    console.log( (ddbg()), vartype + "variables: ", UTIL.inspect(result, false, null, false) );
                }
                const vartypes = ["", "Int", "State"];    
                try {
                    var varobj = result.vars.var;
                } catch (e) {
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
                    try {
                        var varid = obj["$"]["id"];
                        var vartypeid = parseInt(obj["$"]["type"]);
                        if ( vartypeid > 2 ) { vartypeid = 0; }
                    } catch (e) {
                        varid = 0;
                        vartypeid = 0;
                    }

                    // moved the precision handling to translate function
                    if ( varid > 0 && vartype === vartypes[vartypeid] ) {
                        // var prec = parseInt(obj.prec[0]);
                        // var val10 = obj.val[0];
                        // if ( !isNaN(prec) && prec !== 0 ) {
                        //     val10 = parseFloat(val10) / Math.pow(10, prec);
                        // }
                        // variables[vartype+"_"+varid] = val10.toString();
                        var val = obj["val"][0];
                        var prec = obj["prec"][0];
                        var subid = vartype + "_" + varid;
                        variables["status_"] = "ACTIVE";
                        variables = translateIsy("variables", variables, subid, val, "", 0, prec, subid, false);
                    }
                });
            }
    
            // get programs and setup program tiles much like how Piston tiles are done in HE
            function getAllProgs(result) {
                if ( DEBUG19 && result ) {
                    console.log( (ddbg()), "programs: ", UTIL.inspect(result, false, null, false) );
                }
                var thetype = "isy";
                try {
                    var programlist = result.programs.program;
                } catch(e) {                        
                    checkDone("programs","programs list error");
                    return;
                }
                if ( !is_object(programlist) ) {
                    checkDone("programs","programs list error");
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
                var nprogs = programlist.length;
                var n = 0;

                if ( nprogs === 0 ) {
                    checkDone("programs","no programs");
                    return;
                }

                programlist.forEach(function(prog) {
                    var proginfo = prog["$"];
                    var isfolder = proginfo.folder;
                    // if we have a folder don't add it
                    if ( isfolder==="true" ) {
                        if ( DEBUG19 ) {
                            console.log( (ddbg()), "Program ", prog.name, " is a folder. id: ", proginfo.id, " Status: ", proginfo.status);
                        }
                        // n++;
                        // if ( n >= nprogs ) {
                        //     checkDone("programs","folder");
                        // }
                    // create tile for programs that are not folders
                    } else {
                        if ( DEBUG19 ) {
                            console.log( (ddbg()), "Program ", prog.name, " id: ", proginfo.id, " Status: ", proginfo.status, " Last run: ", prog.lastRunTime );
                        }
                        const progid = "prog_" + proginfo.id;

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

                        // grab the list of device id's to process duplicate removal later
                        var sqldevid = "'" + progid + "'";
                        if ( !currentDevices.includes(sqldevid) ) {
                            currentDevices.push(sqldevid);
                        }
                        var device = {userid: userid, hubid: hubindex, deviceid: progid, name: progname, 
                                        devicetype: thetype, hint: "ISY_program", refresh: "never", pvalue: pvalstr};
                        mydevices[progid] = device;
                        mydb.getRow("devices", "id,uid,deviceid", `userid = ${userid} AND hubid = ${hubindex} AND devicetype = '${thetype}' AND deviceid = '${progid}'`)
                        .then(resp => {
                            if ( resp ) {
                                const uprogid = resp.deviceid;
                                mydevices[uprogid].id = resp.id;
                                if ( resp.uid === 0 ) {
                                    uidmax++;
                                    mydevices[uprogid].uid = uidmax;
                                } else {
                                    mydevices[uprogid].uid = resp.uid;
                                }
                                mydb.updateRow("devices", mydevices[uprogid], `id = ${resp.id} AND hubid = ${hubindex} AND userid = ${userid}`, true);
                            } else {
                                uidmax++;
                                mydevices[progid].uid = uidmax;
                                mydb.addRow("devices", mydevices[progid]);
                            }
                        })
                        .catch(reason => {
                            console.error( (ddbg()), reason);
                            // checkDone("programs","error");
                        });
                    }
                });
                checkDone("programs");
            }
    
            function getAllNodes(result) {
                if ( !result ) {
                    checkDone("nodes", "error");
                    checkDone("groups", "error");
                } else {
                    var thenodes = result.nodes["node"];
                    var thegroups = result.nodes["group"];
                    getISYNodes(thenodes);
                    getISYGroups(thegroups);
                }
            }

            function getISYNodes(thenodes) {
                if ( !is_object(thenodes) ) {
                    checkDone("nodes", "error");
                } else {
                    var numnodes = thenodes.length;
                    var n = 0;
                    for ( var obj in thenodes ) {
                        var node = thenodes[obj];
                        const devid = fixISYid(node["address"][0].toString());
                        var hint = node["type"][0].toString();
                        if ( !hint ) {
                            hint = "0.0.0.0";
                        }
    
                        // use hints to inform what type to set - if no match then use isy type
                        var thetype = null;
                        var thecommands = null;

                        for (var key in GLB.mainISYMap) {
                            var caphintarray = GLB.mainISYMap[key][2];
                            if ( !is_array(caphintarray) ) {
                                caphintarray = [caphintarray];
                            }
                            caphintarray.forEach( function(caphint) {
                                if ( caphint && hint.startsWith(caphint) ) {
                                    thetype = key;
                                    if ( is_object(GLB.mainISYMap[key][1]) ) {
                                        thecommands = Object.keys(GLB.mainISYMap[key][1]);
                                    } else {
                                        thecommands = null;
                                    }
                                }
                            })
                        }

                        // if no match found then use generic type
                        if ( !thetype ) {
                            thetype = "isy";
                        }

                        // now fix up the hint so we can style using it - no longer need to do this because we now use hints to create real types
                        // in fact, the real hint is also now captured as an element of pvalue so we don't even display this
                        // hint = hint.replace( /\./g, "_" );
    
                        var name = node["name"][0] || "Unnamed Node";
                        var pvalue = {"name": name};

                        // grab the list of device id's to process duplicate removal later
                        // var sqldevid = "'" + devid + "'";
                        // if ( !currentDevices.includes(sqldevid) ) {
                        //     currentDevices.push(sqldevid);
                        // }

                        const ignoreNodes = ["$","address","name","family","type","deviceClass","sgid","rpnode","custom","devtype","enabled",
                                            "dcPeriod","startDelay","endDelay","parent__"];
                        for (var nodeitem in node) {
                            if ( !ignoreNodes.includes(nodeitem) ) {
                                pvalue[nodeitem] = node[nodeitem][0];
                            }
                        }

                        // use the enabled field to set status unless it is already there
                        if  ( !array_key_exists("status_", pvalue ) ) {
                            if ( node["enabled"] && node["enabled"][0]=="true" ) {
                                pvalue["status_"] = "ACTIVE";
                            } else {
                                pvalue["status_"] = "INACTIVE";
                            }
                        }

                        // add commands that start with underscore if they are present
                        if ( is_array(thecommands) ) {
                            thecommands.forEach( function(acommand) {
                                if ( acommand.startsWith("_") ) {
                                    pvalue[acommand] = acommand.substring(1);
                                }
                            });
                        }

                        // this is where we change the device items
                        pvalue = translateObjects(pvalue, 1);
                        var pvalstr = encodeURI2(pvalue);
    
                        // set bare minimum info
                        // this is updated below in the callback after getting node details
                        var sqldevid = "'" + devid + "'";
                        if ( !currentDevices.includes(sqldevid) ) {
                            currentDevices.push(sqldevid);
                        }
                        var device = {userid: userid, hubid: hubindex, deviceid: devid, name: name, 
                                        devicetype: thetype, hint: `ISY_${hint}`, refresh: "never", pvalue: pvalstr};
                        mydevices[devid] = device;
                        mydb.getRow("devices", "id,uid,deviceid", `userid = ${userid} AND hubid = ${hubindex} AND devicetype = '${thetype}' AND deviceid = '${devid}'`)
                        .then(resp => {
                            if ( resp ) {
                                const udevid = resp.deviceid;
                                mydevices[udevid].id = resp.id;
                                if ( resp.uid === 0 ) {
                                    uidmax++;
                                    mydevices[udevid].uid = uidmax;
                                } else {
                                    mydevices[udevid].uid = resp.uid;
                                }
                                mydb.updateRow("devices", mydevices[udevid], `id = ${resp.id} AND hubid = ${hubindex} AND userid = ${userid}`, true)
                                .then(res => {
                                    n++;
                                    if ( n >= numnodes ) {
                                        checkDone("nodes");
                                    }        
                                })
                                .catch(reason => {
                                    console.warn( (ddbg()), reason);
                                    checkDone("nodes", "error");
                                });
                            } else {
                                uidmax++;
                                mydevices[devid].uid = uidmax;
                                mydb.addRow("devices", mydevices[devid])
                                .then(res => {
                                    n++;
                                    if ( n >= numnodes ) {
                                        checkDone("nodes");
                                    }        
                                })
                                .catch(reason => {
                                    console.warn( (ddbg()), reason);
                                    checkDone("nodes", "error");
                                });
                            }
                        })
                        .catch(reason => {
                            console.warn( (ddbg()), reason);
                            checkDone("nodes", "error");
                        });
                    }
                }
            }

            function getISYGroups(groups) {
                if ( !is_object(groups) ) {
                    checkDone("groups", "error");
                    return;
                } else {
                    var numgroups = groups.length;
                }
                
                if ( numgroups === 0 ) {
                    checkDone("groups");
                } else {                    
                    var ng = 0;
                    for ( var obj in groups ) {
                        var node = groups[obj];
                        var devid = fixISYid(node["address"][0].toString());
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

                        // grab the list of device id's to process duplicate removal later
                        var sqldevid = "'" + devid + "'";
                        if ( !currentDevices.includes(sqldevid) ) {
                            currentDevices.push(sqldevid);
                        }
                        var pvalstr = encodeURI2(pvalue);
                        var device = {userid: userid, hubid: hubindex, deviceid: devid, name: name, 
                                    devicetype: "isy", hint: hint, refresh: "never", pvalue: pvalstr};

                        mydb.getRow("devices", "id,uid", `userid = ${userid} AND hubid = ${hubindex} AND devicetype = 'isy' AND deviceid = '${devid}'`)
                        .then(resp => {
                            if ( resp ) {
                                device.id = resp.id;
                                if ( resp.uid === 0 ) {
                                    uidmax++;
                                    device.uid = uidmax;
                                } else {
                                    device.uid = resp.uid;
                                }
                                mydb.updateRow("devices", device, `id = ${device.id} AND hubid = ${hubindex} AND userid = ${userid}`, true)
                                .then(res => {
                                    ng++;
                                    mydevices[devid] = device;
                                    if ( ng >= numgroups ) {
                                        checkDone("groups");
                                    }
                                })
                                .catch(reason => {
                                    console.warn((ddbg()), reason);
                                    checkDone("groups", "error");
                                    return;
                                });
                            } else {
                                uidmax++;
                                device.uid = uidmax;
                                mydb.addRow("devices", device)
                                .then(res => {
                                    ng++;
                                    mydevices[devid] = device;
                                    if ( ng >= numgroups ) {
                                        checkDone("groups");
                                    }
                                })
                                .catch(reason => {
                                    console.warn((ddbg()), reason);
                                    checkDone("groups", "error");
                                    return;
                                });
                            }
                        })
                        .catch(reason => {
                            console.warn((ddbg()), reason);
                            checkDone("groups", "error");
                            return;
                        });
                    }
                }
            }
            
            function getStatusInfo(result) {
                try {
                    if ( DEBUG19 ) {
                        console.log( (ddbg()), "node details: ", UTIL.inspect(result, false, null, false) );
                    }
                    if ( !result || !result.nodes ) {
                        checkDone("states", "error - invalid format for node status update info");
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
                                var pvalue = setIsyFields(nodeid, mydevices[nodeid], props);
                                var pvalstr = encodeURI2(pvalue);
                                mydevices[nodeid]["pvalue"] = pvalstr;
                                mydb.updateRow("devices", mydevices[nodeid], "userid = "+userid+" AND hubid = "+hubindex+" AND deviceid = '" + nodeid + "'")
                                .then( ()=> {
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
                    console.error( (ddbg()), e);
                    checkDone("states", "error - something went wrong capturing device detials");
                }
            }
        }

    // end of the getDevices promise function to return to caller
    });
    return promise;

}
// ------ end of getDevices

// maps an ISY id to a Hubitat subid field
function mapIsyid(isyid, devicetype) {
    var id = isyid;
    if ( array_key_exists(devicetype, GLB.mainISYMap) ) {
        var mainMap = GLB.mainISYMap[devicetype][0];
        if ( array_key_exists(isyid, mainMap) ) {
            id = mainMap[isyid];
        }
    }
    return id;
}

// map a subid to an ISY command
function mapIsycmd(subid, devicetype) {
    var cmd = subid;
    if ( array_key_exists(devicetype, GLB.mainISYMap) ) {
        var mainMap = GLB.mainISYMap[devicetype][1];
        if ( array_key_exists(subid, mainMap) ) {
            cmd = mainMap[subid];
        }
    }
    return cmd;
}

function mapIsyparm(parm, swval) {
    var isyparm = null;
    const tmap = {"off":1, "heat":2, "cool": 3, "auto": 4, "emergencyHeat": 5, "emergency": 5};
    const fanmap = {"auto":1, "on":2, "circulate": 7};
    if ( parm === "SET_TMODE" && array_key_exists(swval, tmap) ) {
        isyparm = tmap[swval];
    } else if ( parm==="SET_FMODE" && array_key_exists(swval, fanmap) ) {
        isyparm = fanmap[swval];
    }
    return isyparm;
}

function getColorName(index) {
    if ( index < 0 || index >= GLB.ISYcolors.length ) {
        index = GLB.ISYcolors.length - 1;
    }
    return GLB.ISYcolors[index];
}

function getColorIndex(colorname) {
    var index = GLB.ISYcolors.indexOf(colorname);
    if ( index < 0 || index >= GLB.ISYcolors.length ) {
        index = GLB.ISYcolors.length - 1;
    }
    return index;
}

// devicetype, value, obj.id, obj.value, obj.formatted, obj.uom, obj.prec, setuom
function translateIsy(devicetype, value, isyid, val, formatted, uom, prec, subid, setuom) {

    // either use the ISY id or map it to the equivalent HP version
    // var devicetype = device["devicetype"];
    // convert levels for Insteon range
    if ( typeof uom === "string" ) {
        uom = parseInt(uom);
    }

    if ( uom && uom===100 ) {
        val = Math.floor(parseInt(val) * 100 / 255);
    }
    val = val.toString();

    if ( typeof formatted === "undefined" ) {
        formatted = "";
    }

    // adjust value based on prec
    if ( prec ) {
        var oldval = val;
        if ( typeof prec === "string" ) {
            prec = parseInt(prec);
        }
        val = parseFloat(val);
        if ( !isNaN(prec) && !isNaN(val) && prec > 0 ) {
            var pow10 = Math.pow(10,prec);
            val = val / pow10;
            val = val.toString();
        } else {
            prec = 0;
            val = oldval;
        }
    }

    var newvalue = clone(value);
    if ( setuom ) {
        newvalue["uom_" + isyid] = uom;
    }
    if ( DEBUG19 ) {
        console.log( (ddbg()), "translate: type: ", devicetype, " isyid: ", isyid, " val: ", val, " formatted: ", formatted, " uom: ", uom, " prec: ", prec, " value: ", value);
    }

    // functions that return mapped values based on type
    // if the object map is not an object or val is not there return val
    function setSelect(target, hestates) {
        var i = val;
        if ( typeof val === "string" ) {
            i = parseInt(val);
        }
        if ( !isNaN(i) && array_key_exists(i,hestates) ) {
            newvalue[target] = hestates[i];
        } else {
            newvalue[target] = val;
        }
    }

    function setLevel(target) {
        if ( formatted && formatted==="On" ) {
            val = "100";
        } else if ( formatted && formatted==="Off" ) {
            val = "0";
        }
        newvalue[target] = val;
        if ( target === "position" ) {
            newvalue["level"] = val;
        }
    }

    function setColor(target) {
        var index = parseInt(val);
        var colorhex = "#" + index.toString(16);
        newvalue[target] = colorhex;
    }

    // do a lookup to translate isyid into a HP subid if it isn't passed in
    if ( !subid ) {
        subid = mapIsyid(isyid, devicetype);
    }

    // set values based on uom and indexMap
    // all status_ nodes are a special case as it applies to all devices
    var obj = null;
    if ( subid === "status_" ) {
        obj = {1:"ACTIVE", 2:"INACTIVE", 3:"ONLINE", 4:"OFFLINE", 5:"UNKNOWN"};
        setSelect(subid, obj);
    } else if ( subid==="color" ) {
        setColor(subid);
    } else if ( subid==="colorname" ) {
        var index = parseInt(val);
        newvalue[subid] = getColorName(index - 1);
    } else if ( isyid === "OL") {
        setLevel(subid);
    } else if ( array_key_exists(devicetype, GLB.indexMap) && 
                array_key_exists(isyid, GLB.indexMap[devicetype]) ) {
        obj = GLB.indexMap[devicetype][isyid];
        setSelect(subid, obj);
    } else {
        if ( array_key_exists(uom, GLB.uomMap) ) {
            obj = GLB.uomMap[uom];
            setSelect(subid, obj);
        } else {
            newvalue[subid] = val;
        }
    }
    return newvalue;
}

// this takes an array of props and updates values
function setIsyFields(nodeid, device, props) {

    var value = device.pvalue;
    var devicetype = device.devicetype;
    if ( props && value && is_array(props) ) {
        value = decodeURI2(value);
        props.forEach(function(aprop) {
            var obj = aprop['$'];
            // devicetype, value, obj.id, obj.value, obj.formatted, obj.uom, obj.prec, setuom
            value = translateIsy(devicetype, value, obj.id, obj.value, obj.formatted, obj.uom, obj.prec, false, true);
        });        
        if ( DEBUG19 ) {
            console.log( (ddbg()), "in setIsyFields - node: ", nodeid, " device: ", device, " value: ", value, " props: ", props);
        }
    }
    return value;
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

// this sends control over to doLogin upon return
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
    tc+= hidden("webDisplayPort", GLB.port);
    tc+= hidden("api", "dologin");
    tc+= hidden("apiSecret", GLB.apiSecret);
    // tc+= hidden("userid", userid, "userid");

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    tc+= "<div class='loginline'>";
    tc+= "<label for=\"emailid\" class=\"startupinp\">Email: </label><br>";
    tc+= "<input id=\"emailid\" tabindex=\"1\" name=\"emailid\" size=\"60\" type=\"text\" value=\"" + emailname + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"mobileid\" class=\"startupinp\">Mobile (or any >6 digit number): </label><br>";
    tc+= "<input id=\"mobileid\" tabindex=\"2\" name=\"mobile\" size=\"60\" type=\"text\" value=\"" + mobile + "\"/>"; 
    tc+= "</div>";
    
    tc+= "<div class='loginline'>";
    tc+= "<label for=\"pword\" class=\"startupinp\">Password: </label><br>";
    tc+= "<input id=\"pword\" tabindex=\"3\" name=\"pword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    tc+= "Forgot Password? ";
    tc+= '<div id="forgotpw" tabindex=\"8\" class="inlinebutton">Click here to reset</div>';
    tc+= "</div>";

    // code supports multiuple panels, but I've disabled it to simplify the user experience
    // everybody now just gets one panel called "default" and it can't be changed
    // I might revisit this at some point in the future so all the code to support panels remains intact
    // tc+= "<div class='loginline'>";
    // tc+= "<label for=\"pname\" class=\"startupinp\">Panel Name: </label><br>";
    // tc+= "<input id=\"pname\" tabindex=\"4\" name=\"pname\" size=\"60\" type=\"text\" value=\"" + pname + "\"/>"; 
    // tc+= "</div>";
    tc+= hidden("pname","default","pname");
    // var currentport = getCookie(req, "pname") || "1:default";
    // if ( currentport.substr(1,1)!==":" ) {
    //     currentport = "1";
    // } else {
    //     currentport = currentport.substr(0,1);
    // }
    // tc+= "<div class='loginline'>";
    // tc+= "<label for=\"pnumber\" class=\"startupinp\">Panel # (1 .. 9, must be unique): </label><br>";
    // tc+= "<input id=\"pnumber\" tabindex=\"5\" name=\"pnumber\" type='number' min='1' max='9' step='1' value='" + currentport + "'>"; 
    // tc+= "</div>";
    
    // tc+= "<div class='loginline'>";
    // tc+= "<label for=\"panelpword\" class=\"startupinp\">Panel Password: </label><br>";
    // tc+= "<input id=\"panelpword\" tabindex=\"6\" name=\"panelpword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    // tc+= "</div>";
    tc+= hidden("panelpword","","panelpword");
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="dologin" tabindex=\"7\" class="formbutton">Sign In</div>';
    tc+= "</div>";

    // the forgot pw link only uses the email and mobile fields
    // tc+= "<hr>";
    // tc+= "<div class='loginline'>";
    // tc+= "Forgot Password? Enter email and<br>";
    // tc+= '<div id="forgotpw" tabindex=\"8\" class="inlinebutton">Click Here to Reset</div>';
    // tc+= "</div>";

    // disable creating new accounts
    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "Don't have an account?<br>";
    tc+= '<div id="newuser" tabindex=\"9\" class="inlinebutton">Create One Here</div>';
    tc+= "</div>";

    tc+= "<hr>";
    tc+= "<div class='loginline'>";
    tc+= "<div>By signing in, you are agreeing to our <div id=\"privacypolicy\" class=\"inlinebutton\">Privacy Policy</div></div>";
    tc+= "<br><div>For login instructions<div id=\"moreinfo\" tabindex=\"10\" class=\"inlinebutton\">Click Here...</div></div>";
    tc+="<div id=\"loginmore\" class=\" loginmore hidden\">Enter a valid registered Email, Mobile, and Password to access HousePanel " +
            "and gain access to your smart home devices. " +
            "The Mobile number doesn't have to be an actual phone number. It can be any 7-digit or greater number you provided at registration. " +
            "But, real mobile numbers can also be used and you will be sent a txt to validate and do future password resets. " +
            "All accounts are required to have a password.<br><br>" +

            "Each device at the same location using the same IP address must be given a unique number from 1 to 9. " +
            "</div><br />";
    tc+= "</div>";
            // "Each user can have any number of panels defined with each one having its own password and skin. " + 
            // "This allows a single account holder to display their smart devices in different ways on different devices. " +
            // "To load a specific panel skin, please enter its name and password. " +
            // "If this is left blank, the first panel available that is not password protected in the user's account will be loaded. " +
            // "If all panels are password protected you must provide the name and password of a valid panel to sign into HousePanel." +
    tc+= "</div>";
    tc+= "</form>";

    tc+= "<form id=\"newuserform\" class=\"hidden\" name=\"newuserform\" action=\"#\"  method=\"POST\">";
    tc+= hidden("returnURL", GLB.returnURL);
    tc+= hidden("pagename", "login");
    var webSocketUrl = getSocketUrl(hostname);
    tc+= hidden("webSocketUrl", webSocketUrl);
    tc+= hidden("webSocketServerPort", GLB.webSocketServerPort);
    tc+= hidden("webDisplayPort", GLB.port);
    tc+= hidden("api", "createuser");
    tc+= hidden("apiSecret", GLB.apiSecret);
    // tc+= hidden("userid", userid);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    if ( !GLB.dbinfo.allownewuser || GLB.dbinfo.allownewuser==="false" || GLB.dbinfo.allownewuser.includes("none") ) {
        tc+= "<div class='loginline'>";
        tc+= "Sorry, but HousePanel is no longer available for new public users. You can still use the \"freeware\" ";
        tc+= "version of HousePanel by downloading the files onto your own server or rPI. Instructions for how ";
        tc+= "to do this and where to find the files are available at <a href=\"https://www.housepanel.net\" target=\"_blank\">https://www.housepanel.net</a>";
        tc+= "</div>";
    } else {

        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newemailid\" class=\"startupinp\">Email: </label><br>";
        tc+= "<input id=\"newemailid\" tabindex=\"1\" name=\"newemailid\" size=\"60\" type=\"text\" value=\"\"/>"; 
        tc+= "</div>";

        tc+= "<div class='loginline'>";
        tc+= "<label for=\"newmobileid\" class=\"startupinp\">Mobile (or any >6 digit number): </label><br>";
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
    tc+= "Already have an account?<br>";
    tc+= '<div id="olduser" tabindex=\"8\" class="inlinebutton">Click Here To Login</div>';
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= getFooter();
    return tc;
}

function createUser(body) {

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

    return checkUser(emailname)
    .then( res => {
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
                new Promise( function (resolve, reject) { resolve(newuser); }),
                makeNewConfig(userid),
                makeNewRooms(userid, pname, "", "skin-housepanel", GLB.defaultrooms),
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
            console.log( (ddbg()), "new user: ", newuser);
            console.log( (ddbg()), "new configs: ", configs);
            console.log( (ddbg()), "new panel: ", panel);
            console.log( (ddbg()), "new rooms: ", rooms);
            console.log( (ddbg()), "new default hub: ", defhub);
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
        let thecode = newuser.hpcode;

        // var d = new Date();
        // var time = d.toLocaleTimeString();
        // var logincode = pw_hash(mobile + time).toUpperCase();
        // var len = logincode.length;
        // var mid = len / 2;
        // var thecode = logincode.substring(0,1) + logincode.substring(mid,mid+1) + logincode.substring(len-4);
        let msg = "HousePanel confirmation code: " + thecode;

        // write confirmation to console and email and/or text it to user
        console.log( (ddbg()), msg );
           
        if ( (GLB.dbinfo.service==="twilio" || GLB.dbinfo.service==="both") ) {
            sendText(mobile, msg);
        }
        if ( GLB.dbinfo.service==="email" || GLB.dbinfo.service==="both" ) {
            msg += "<br>\n\nTo confirm and activate your HousePanel account, <a href=\"" + GLB.returnURL + "/activateuser?userid="+userid+"&hpcode="+thecode+"\">click here</a>, or enter the above code manually.";
            msg += "<br>\n\nThis code expires in 15 minutes.";
            sendEmail(emailname, msg, "confirmation of a HousePanel password");
        }
    
        // make the hpcode expire after 15 minutes, replaced by a permanent code to use for API calls
        const delay = 15 * 60000;
        setTimeout(function() {
            let permcode = getNewCode(emailname);
            mydb.updateRow("users",{hpcode: permcode},"id = "+userid)
            .then( () => {
                console.log( (ddbg()), "For security purposes, all API calls will use hpcode="+permcode);
            })
            .catch( reason => {
                console.error( (ddbg()), "error updating hpcode:", reason);
            });
        }, delay);

        return newuser;
    })
    .catch(reason => {
        console.error( (ddbg()), "error creating new user:", reason );
        return reason;
    });
}

// promise function to check for existing user
function checkUser(emailname) {
    var promise = new Promise(function(resolve, reject) {

        let emailre = /^\S+@\S+\.\S{2,}$/;    // email form xxx@yyyyy.zzz
        if ( ! emailre.test(emailname) ) {
            reject(`error - ${emailname} is not a valid email address.`);
        }

        let allow = GLB.dbinfo.allownewuser;
        if ( allow==="false" || (is_array(allow) && !allow.includes("all") && ( allow.includes("none") || !allow.includes(emailname) )) ) {
            reject(`error - ${emailname} is not allowed to create a new HousePanel account or log in`);
        }

        mydb.getRow("users","id","email = '"+emailname+"'")
        .then(row => {
            if ( row ) {
                reject("error - user with email [" + emailname + "] already exists"); 
            } else {
                resolve(emailname);
            }
        })
        .catch(reason => {
            reject(reason);
        });    
    });
    return promise;
}

function getNewCode(seed="") {
    if ( seed ) {
        var logincode = pw_hash(seed).toUpperCase();
    } else {
        var d = new Date();
        var time = d.toLocaleTimeString();
        logincode = pw_hash(time).toUpperCase();
    }
    var len = logincode.length;
    var mid = len / 2;
    var thecode = logincode.substring(0,1) + logincode.substring(mid,mid+1) + logincode.substring(len-4);
    return thecode;
}

function addNewUser(emailname, username, mobile, pword) {
    // create confirmation code
    var thecode = getNewCode();

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
        
        // if the type of service is not specified or set to something other than twilio, email, and both
        // we skip the user confirmation process by setting the usertype to userid and hpcode to the permanent value
        // otherwise we wait for the confirmation step to do these things
        // but note that if email or txt is not used, forgot password will require logs to be viewed to get the code
        if ( GLB.dbinfo.service!=="twilio" && GLB.dbinfo.service!=="email" && GLB.dbinfo.service!=="both"  ) {
            var usertype = userid;
            var permcode = getNewCode(emailname);
            newuser.hpcode = permcode;
            mydb.updateRow("users",{usertype: usertype, hpcode: permcode}, "id = " + userid)
            .then(()=> {
                var msg = "For security purposes all API calls must use hpcode="+permcode;
                console.log( (ddbg()), msg );
            })
            .catch(reason => {
                console.error( (ddbg()), "error updating new user: ", reason );
            });
        } else {
            usertype = 0;
        }
        newuser.id = userid;
        newuser.usertype = usertype;
        return newuser;
    })
    .catch(reason => {
        console.error( (ddbg()), "error creating new user:", reason );
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
    configs.push( await addConfigItem(userid, "phototimer","0") );
    configs.push( await addConfigItem(userid, "fast_timer","0") );            // unused at present
    configs.push( await addConfigItem(userid, "slow_timer","0") );            // unused at present
    configs.push( await addConfigItem(userid, "fcastcity", "san-carlos") );   // (userid, "fcastcity") || "ann-arbor" );
    configs.push( await addConfigItem(userid, "fcastregion","San Carlos") );  // (userid, "fcastregion","Ann Arbor") );
    configs.push( await addConfigItem(userid, "fcastcode","37d51n122d26") );  // (userid, "fcastcode","42d28n83d74") );
    configs.push( await addConfigItem(userid, "accucity","san-carlos") );     // (userid, "accucity","ann-arbor-mi") );
    configs.push( await addConfigItem(userid, "accuregion","us") );           // (userid, "accuregion","us") );
    configs.push( await addConfigItem(userid, "accucode", "337226") );        // (userid, "accucode", "329380") );
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
        if ( typeof value !== "object" ) {
            var updval = {userid: userid, configkey: key, configval: value, configtype: 0};
        } else {
            updval = {userid: userid, configkey: key, configval: JSON.stringify(value), configtype: 0};
        }
        // mydb.addRow("configs", updval)
        mydb.updateRow("configs", updval, `userid = ${userid} AND configkey = '${key}'`)
        .then(result => {
            updval.id = result.getAutoIncrementValue();
            resolve(updval);
        })
        .catch(reason => {
            reject(reason);
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
            console.error( (ddbg()), "error creating default hub:", reason);
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

            var controlval = getController();
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
            console.error( (ddbg()), "error attempting to create default devices: ", reason);
            reject(reason);
        });
    });
    return promise;
}

function getController() {
    var controlval = {"name": "Controller", "showoptions": "Options", "editdevices": "Edit Devices", "refreshpage": "Refresh",
    "c__userauth": "Hub Auth","showid": "Show Info","toggletabs": "Toggle Tabs", "showdoc": "Documentation",
    "blackout": "Blackout","operate": "Operate","reorder": "Reorder","edit": "Edit"};
    return controlval;
}

// this function now makes a panel and fills it with rooms based on names passed
function makeNewRooms(userid, pname, password, skin, defaultrooms) {
    var promise = new Promise(function(resolve, reject) {
        var defaultpanel = {userid: userid, pname: pname, password: password, skin: skin};
        mydb.addRow("panels", defaultpanel)
        .then(resultPanel => {
            // if we added a default panel okay create a set of default rooms
            var panelid = resultPanel.getAutoIncrementValue();
            defaultpanel.id = panelid;
            var rooms = [];
            var k = 0;
            for ( var roomname in defaultrooms ) {
                k++;
                var room = {userid: userid, panelid: panelid, rname: roomname, rorder: k};
                mydb.addRow("rooms", room)
                .then(resultRoom => {
                    room.id = resultRoom.getAutoIncrementValue();
                    rooms.push(room);

                    // if we added the last room then resolve the promise
                    if ( k === Object.keys(defaultrooms).length ) {
                        resolve([defaultpanel, rooms]);
                    }
                })
                .catch( reason => {
                    console.error( (ddbg()), "error creating default rooms: ", reason );
                    reject(reason);
                });
            }
        })
        .catch( reason => {
            console.error( (ddbg()), "error creating default panel: ", reason );
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
    tc+= "<div class='userinfo'>A security code was sent to your email. Enter it below to activate your account. ";
    tc+= "Or you can click on the link in the email and the code will be provided below. ";
    tc+= "</div>";
    tc+= "<hr>";

    tc+= "<form id=\"validateuserpage\" name=\"validateuserpage\" action=\"#\"  method=\"POST\">";
    tc+= hidden("returnURL", GLB.returnURL);
    tc+= hidden("pagename", "login");
    tc+= hidden("userid", userid, "userid");
    tc+= hidden("email", user.email);
    tc+= hidden("uname", user.uname);
    tc+= hidden("mobile", user.mobile);
    tc+= hidden("hpcode", user.hpcode, "hpcode");
    tc+= hidden("apiSecret", GLB.apiSecret);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    tc+= "<div class='userinfo'><strong>User ID: </strong>" + userid + "</div>";
    tc+= "<div class='userinfo'><strong>Email: </strong>" + user.email + "</div>";
    tc+= "<div class='userinfo'><strong>Username: </strong>" + user.uname + "</div>";
    tc+= "<div class='userinfo'><strong>Mobile: </strong>" + user.mobile + "</div>";

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
    tc+= hidden("userid", userid, "userid");
    tc+= hidden("email", user.email);
    tc+= hidden("uname", user.uname);
    tc+= hidden("mobile", user.mobile);
    tc+= hidden("hpcode", user.hpcode, "hpcode");
    tc+= hidden("apiSecret", GLB.apiSecret);

    tc+= "<div class='logingreeting'>";
    tc+= "<h2 class='login'>" + GLB.APPNAME + "</h2>";

    tc+= "<div class='userinfo'><strong>User ID: </strong>" + userid + "</div>";
    tc+= "<div class='userinfo'><strong>Email: </strong>" + user.email + "</div>";
    tc+= "<div class='userinfo'><strong>Username: </strong>" + user.uname + "</div>";
    tc+= "<div class='userinfo'><strong>Mobile: </strong>" + user.mobile + "</div>";
    
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
    
    // code supports multiuple panels, but I've disabled it to simplify the user experience
    // everybody now just gets one panel called "default" and it can't be changed
    // I might revisit this at some point in the future so all the code to support panels remains intact
    // tc+= "<div class='loginline'>";
    // tc+= "<label for=\"pname\" class=\"startupinp\">Panel Name: </label><br>";
    // tc+= "<input id=\"pname\" name=\"pname\" size=\"60\" type=\"text\" value=\"" + "default" + "\"/>"; 
    // tc+= "</div>";
    tc+= hidden("pname","default","pname");

    // tc+= "<div class='loginline'>";
    // tc+= "<label for=\"panelpword\" class=\"startupinp\">Panel Password: </label><br>";
    // tc+= "<input id=\"panelpword\" name=\"panelpword\" size=\"60\" type=\"password\" value=\"\"/>"; 
    // tc+= "</div>";
    tc+= hidden("panelpword","","panelpword");
    
    tc+= "<div class='loginline'>";
    tc+= '<div id="newpassword" class="formbutton">Save Credentials</div>';
    tc+= "</div>";

    tc+= "<br><hr>";
    tc+= "<div class='loginline'>";
    tc+= "If you know your password:<br>";
    tc+= '<div id="revertolduser" class="inlinebutton">Click here to login with existing credentials</div><br>';
    tc+= "</div>";

    tc+= "</div>";
    tc+= "</form>";

    tc+= getFooter();

    return tc;

}

// email and mobile must match
// returns the user object
function forgotPassword(body) {

    var emailname = body["email"];
    var mobilefield = body["mobile"];

    // get the user from the database and send reminder if user exists
    return mydb.getRow("users","*","email = '"+emailname+"'")
    .then(row => {
        if ( !row ) { 
            return "error - user with email = " + emailname + " does not exist"; 
        }

        // update the mobile number if one is given
        var mobile = mobilefield ? mobilefield : row.mobile;

        // compute a special code to check later
        var thecode = getNewCode();
        
        // save code to the DB for confirming later, also update mobile number
        var userid = row.id;
        return mydb.updateRow("users",{mobile: mobile, hpcode: thecode},"id = "+userid)
        .then(result => {
            if ( !result ) { 
                return "error - could not process password reset for user " + emailname + " (ID #" + userid + ")"; 
            }
            row.mobile = mobile;
            row.hpcode = thecode;
            var msg = "To confirm and activate your updated password, use this HousePanel Security Code: " + thecode;
            console.log( (ddbg()), msg);
            if ( (GLB.dbinfo.service==="twilio" || GLB.dbinfo.service==="both") ) {
                sendText(mobile, msg);
            }
            if ( GLB.dbinfo.service==="email" || GLB.dbinfo.service==="both" ) {
                msg += "<br>\n To confirm and activate your updated password, <a href=\"" + GLB.returnURL + "/forgotpw?userid="+userid+"&hpcode="+thecode+"\">click here, or enter the code manually.</a>";
                msg += "<br>\n\nThis code expires in 15 minutes.";
                sendEmail(emailname, msg, "confirmation of a forgotten password");
            }
    
            // make the hpcode expire after 15 minutes
            // replace with a permanent code that must be used to make API calls
            // this will be different than the login authentication code
            // which means the login authentication code cannot be used for API calls and vice versa
            // we don't communicate this value until the user has been validated, unless validation is diabled
            const delay = 15 * 60000;
            setTimeout(function() {
                const permcode = getNewCode(emailname);
                mydb.updateRow("users",{hpcode: permcode},"id = "+userid)
                .then( () => {
                    if ( GLB.dbinfo.service==="none" ) {
                        msg = "For security purposes, all API calls will use hpcode=" + permcode;
                        console.log( (ddbg()), msg);
                    }
                })
                .catch( reason => {
                    console.error( (ddbg()), "error updating hpcode:", reason);
                });
            }, delay);
            return row;
        })
        .catch( reason => {
            console.error( (ddbg()), "error occurred when requesting password reset:", reason);
            return "error - problem occurred when requesting password reset. Check logs.";
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
            var permcode = getNewCode(emailname);
            var upduser = {email: emailname, mobile: mobile, hpcode: permcode, usertype: userid};
            return mydb.updateRow("users", upduser, "id = " + userid)
            .then( row => {
                var msg = "Account " + emailname + " validated. For security purposes, all API calls will use hpcode=" + permcode;
                msg += " Protect this code and your password to prevent unauthorized use of your account.";
                console.log( (ddbg()), msg);
                if ( (GLB.dbinfo.service==="twilio" || GLB.dbinfo.service==="both") ) {
                    sendText(mobile, msg);
                }
                if ( GLB.dbinfo.service==="email" || GLB.dbinfo.service==="both" ) {
                    sendEmail(emailname, msg, "to create and validate a new HousePanel user");
                }
                return row;
            })
            .catch( reason => {
                console.error( (ddbg()), "error validating user:", reason);
                return "error - problem validating user";
            });
        } else {
            return "error - problem validating user, the code you provided probably did not match";
        }
    })
    .catch(reason => {
        console.error( (ddbg()), "error validating user:", reason);
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

    if ( !userid || !emailname ) {
        return "error - invalid user or the user account was not found - password cannot be updated.";
    }
    if ( !hpcode ) {
        return "error - a valid security code was not provided - password cannot be updated.";
    }

    // check hpcode to see if it matches
    // and then update the designated user
    return mydb.getRow("users","*","id = " + userid + " AND hpcode = '" + hpcode + "'")
    .then(row => {
        if ( row ) {
            var permcode = getNewCode(emailname);
            var upduser = {email: emailname, uname: uname, mobile: mobile, password: pword, usertype: userid, defhub: "", hpcode: permcode};
            return mydb.updateRow("users", upduser, "id = " + userid)
            .then( row => {
                if ( row ) {
                    var updpanel = {userid: userid, pname: pname, password: panelpw};
                    return mydb.updateRow("panels", updpanel, "userid = " + userid + " AND pname = '"+pname+"'")
                    .then( row => {
                        if ( row ) {
                            var msg = "Password for account " + emailname + " updated. For security purposes, all API calls will use hpcode=" + permcode;
                            msg += " Protect this code and your password to prevent unauthorized use of your account.";
                            console.log( (ddbg()), msg);
                            if ( (GLB.dbinfo.service==="twilio" || GLB.dbinfo.service==="both") ) {
                                sendText(mobile, msg);
                            }
                            if ( GLB.dbinfo.service==="email" || GLB.dbinfo.service==="both" ) {
                                sendEmail(emailname, msg, "a new HousePanel password");
                            }
                            return {email: emailname, uname: uname, mobile: mobile, pname: pname, userid: userid, hpcode: permcode};
                        } else {
                            return "error - problem updating or creating a new panel for user = " + userid;
                        }
                    })
                    .catch(reason => {
                        msg = "error - problem with DB in password reset for user = " + userid;
                        console.error( (ddbg()), msg, " reason: ", reason);
                        return msg;
                    });                    
                } else {
                    return "error - problem updating user password for user = " + userid;
                }
            })
            .catch(reason => {
                console.error( (ddbg()), "error updating user password:", reason );
                return "error - problem with DB in password reset for user = " + userid;
            });                    
        } else {
            return "error - the provided security code is invalid for user = " + userid;
        }
    })
    .catch(reason => {
        console.error( (ddbg()), "error resetting password:", reason );
        return "error - problem with DB in password reset for user = " + userid;
    });
}

function doLogin(body, res) {

    // check the user name and password based on login form data
    var uname = encodeURI(body["emailid"].trim());
    var umobile = encodeURI(body["mobile"].trim());
    var uhash = pw_hash(body["pword"]);

    // get the panel number here
    // this was disabled because we no longer need it for multiple panels
    // because I fixed the websocket code to work with only one port now
    if ( !body["pname"] ) {
        var pname = "";
        var phash = "";
    } else {
        pname = encodeURI(body["pname"].trim());
        phash = pw_hash(body["panelpword"]);
    }

    if ( DEBUG20 ) {
        console.log( (ddbg()), "dologin: uname= ", uname, " pword= ", uhash, " pname= ", pname, " panelpword= ", phash, " body: ", body);
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
    
    return mydb.getRow("panels", fields, conditions, joinstr)
    .then(therow => {
        if ( therow ) {
            // make sure we get the actual email and panel names to store in our cookies
            // since this is what we check for a valid login
            // var userid = therow["users_id"];
            var userid = therow["users_id"];
            var usertype = therow["users_usertype"];

            // store the username as a hash
            uname = therow["users_email"];
            setCookie(res, "uname", pw_hash(uname));
            
            // store the panel name as a hash
            pname = therow["panels_pname"];
            setCookie(res, "pname", pw_hash(pname));
            if ( DEBUG3 ) {
                console.log((ddbg()), therow);
                console.log((ddbg()), "Successful login. userid: ", userid, " Username: ", uname);
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
                    makeDefaultFolder(userid, pname);
                })
                .catch(reason => {
                    console.error( (ddbg()), "error updating null hub:", reason );
                });
            
            }
        } else {
            delCookie(res, "uname");
            delCookie(res, "pname");
            console.warn( (ddbg()), "Failed login attempt. Username: ", uname, " Panelname: ", pname, " fields: ", fields, " conditions: ", conditions);
            therow = "error - invalid username or password";
        }
        return therow;
    }).catch(reason => {
        const msg = "error - failed to read panel from database. You may have a corrupt database.";
        console.error( (ddbg()), msg, "reason: ", reason);
        return msg;
    });
}

function getAuthPage(user, configoptions, hubs, hostname, defaultHub) {

    // get the current settings from options file
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var defhub = defaultHub;
    if ( !defhub ) {
        defhub = user["users_defhub"];
    }
    var hpcode = user["users_hpcode"];
    if ( !defhub || defhub === "new" ) {
        defhub = "-1";
    }
    var panelid = user["panels_id"];
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    var hub = findHub(defhub, hubs);

    // this was replaced with a simple device query based on default hub index since hubs is already available
    var result = mydb.getRows("devices","*","userid = " + userid + " AND hubid = " + hub.id + " GROUP BY deviceid")
    .then(devices => {
        if ( devices ) {
            var numdev = devices.length;
        } else {
            numdev = 0;
        }
        return getauthcontents(configoptions, hubs, hub, numdev);
    })
    .catch(reason => {
        console.error((ddbg()), "error getting devices for auth page:", reason );
        return "error - something went wrong trying to display auth page";
    });

    return result;

    function getauthcontents(configoptions, hubs, hub, numdev) {

        var $tc = "";

        $tc += getHeader(userid, null, null, true);
        $tc += "<h2>" + GLB.APPNAME + " Hub Authorization</h2>";

        if ( GLB.dbinfo.donate===true ) {
            $tc += "<div class=\"donate\">";
            $tc += '<h4>Donations appreciated for HousePanel support and continued improvement, but not required to proceed.</h4> \
                <br /><div><form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
                <input type="hidden" name="cmd" value="_s-xclick"> \
                <input type="hidden" name="hosted_button_id" value="XS7MHW7XPYJA4"> \
                <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
                <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
                </form></div>';
            $tc += "</div>";
        }

        // provide welcome page with instructions for what to do
        // this will show only if the user hasn't set up HP
        // or if a reauth is requested or when converting old passwords
        // $tc += "<div class=\"greeting\">";
        // $tc +="<p>This is where you link a hub to " +
        //         "HousePanel to gain access to your smart home devices. " +
        //         "Hubitat and ISY hubs are supported. " +
        //         "You can link any number and combination of hubs. " + 
        //         "To authorize a Hubitat hub you must provide an access token and the hub endpoint " + 
        //         "These are both shown in the HousePanel app on the Hubitat hub. " +
        //         "ISY hubs require you to enter your username and password in the fields shown below, " +
        //         "and enter the IP of your hub in the Host API Url field " +
        //         "using format https://xxx.xxx.xxx.xxx:8443" +
        //         "</p>";
        // $tc += "</div>";
        
        var webSocketUrl = getSocketUrl(hostname);
        $tc += hidden("pagename", "auth");
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("webSocketUrl", webSocketUrl);
        $tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        $tc += hidden("webDisplayPort", GLB.port);
        $tc += hidden("userid", userid, "userid");
        $tc += hidden("pname", pname);
        $tc += hidden("emailid", useremail, "emailid");
        $tc += hidden("skinid", skin, "skinid");
        $tc += hidden("hpcode", hpcode, "hpcode");
        $tc += hidden("apiSecret", GLB.apiSecret);
        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        // $tc += hidden("configsid", JSON.stringify(configs), "configsid");
        $tc += "<div class=\"greetingopts\">";
            
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
        var newhub = {id: 0, userid: userid, hubid: "new", hubhost: "https://oauth.cloud.hubitat.com", hubtype: "New",
                      hubname: "", clientid: "", clientsecret: "",
                      hubaccess: "", hubendpt: "", hubrefresh: "", 
                      useraccess: "", userendpt: "", hubtimer: 0};
        authhubs.push(newhub);

        // determine how many things are in the default hub
        var ntc= "Hub " + hub.hubname + " (" + hub.hubtype + ") is authorized with " + numdev + " devices";
        $tc += "<div id=\"newthingcount\">" + ntc + "</div>";

        $tc += getHubPanels(authhubs, defhub);
        $tc += "<div id=\"authmessage\"></div>";
        $tc += "<br><br>";
        $tc += "<button class=\"bluebutton infobutton\">Return to HousePanel</button>";
        $tc += getFooter();
        return $tc;
    }

    function getHubPanels(authhubs, defhub) {
        var allhubtypes = GLB.dbinfo.hubs;
        var $tc = "";
        $tc += "<div class='hubopt'><label for=\"pickhub\" class=\"startupinp\">Authorize Hub: </label>";
        $tc += "<select name=\"pickhub\" id=\"pickhub\" class=\"startupinp pickhub\">";

        var selected = false;
        var hub = authhubs[0];
        var id = 0;
        var theid = 0;
        authhubs.forEach(function(ahub) {
            id++;
            var hubName = ahub["hubname"];
            var hubType = ahub["hubtype"];
            var hubId = ahub["hubid"].toString();
            var hubindex = ahub.id;
            var hoptid = "hubopt_"+hubindex;
            if ( !selected && hubId === defhub) {
                var hubselected = "selected";
                selected = true;
                hub = ahub;
                theid = id;
            } else {
                hubselected = "";
            }
            $tc += "<option id=\"" + hoptid + "\" value=\"" + hubId + "\" " + hubselected + ">Hub #" + id + " " + hubName + " (" + hubType + ")</option>";
        });
        $tc += "</select></div>";

        $tc +="<div id=\"authhubwrapper\">";

        var hubType = hub["hubtype"];
        var hubId = hub["hubid"].toString();
        var hubindex = hub.id;
        var hubclass = "";
        var authclass = "";
        if ( hubId==="-1" || hubId==="new" ) {
            hubclass = " hidden";
        }
        if ( hubId==="-1" ) {
            authclass = " hidden";
        }

        // rewrote this to only create a single web interface
        // this changes dynamically when new hubs are selected
        $tc += "<div id=\"authhub\">";
        $tc += "<form id=\"hubform\" class=\"houseauth\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

        // insert the fields needed in the apiCall function
        $tc += hidden("userid", userid, "userid");
        $tc += hidden("uname", uname);
        $tc += hidden("panelid", panelid);
        $tc += hidden("pname", pname);
        $tc += hidden("skinid", skin,"skinid");
        $tc += hidden("hubindex", hubindex);
        $tc += hidden("hpcode", hpcode, "hpcode");

        // for new hubs give user option to pick the hub type
        // existing hubs cannot change type
        if ( hubId==="new" ) {
            $tc += "<div id=\"hubdiv\" class=\"startupinp\">";
        } else {
            $tc += "<div id=\"hubdiv\" class=\"startupinp disabled\">";
        }
        $tc += "<label for='inp_hubtype' class=\"startupinp\">Hub Type: </label>";
        $tc += "<select id='inp_hubtype' disabled name=\"hubtype\" class=\"hubtypeinp\">";
        for (var ht in allhubtypes) {
            if ( ht === hubType ) {
                $tc += "<option value=\"" + ht + "\" selected>" + allhubtypes[ht] + "</option>";
            } else {
                $tc += "<option value=\"" + ht + "\">" + allhubtypes[ht] + "</option>";
            }
        }
        $tc += "</select></div>";

        $tc += "<div><label for='inp_hubhost' class=\"startupinp\">Hub Host: </label>";
        $tc += "<input id='inp_hubhost' class=\"startupinp\" name=\"hubhost\" size=\"80\" type=\"text\" value=\"" + hub["hubhost"] + "\"/></div>"; 

        $tc += "<div id=\"hideaccess_hub\">";
        $tc += "<div><label for='inp_access' id=\"labelAccess\" class=\"startupinp\">Access Token: </label>";
        $tc += "<input id='inp_access' class=\"startupinp\" name=\"useraccess\" size=\"80\" type=\"text\" value=\"" + hub["useraccess"] + "\"/></div>"; 
        $tc += "<div><label for='inp_endpt' id=\"labelEndpt\" class=\"startupinp\">App IO: </label>";
        $tc += "<input id='inp_endpt' class=\"startupinp\" name=\"userendpt\" size=\"80\" type=\"text\" value=\"" + hub["userendpt"] + "\"/></div>"; 
        $tc += "</div>";

        $tc += "<div><label for='inp_hubname' class=\"startupinp\">Hub Name: </label>";
        $tc += "<input id='inp_hubname' class=\"startupinp\" name=\"hubname\" size=\"80\" type=\"text\" value=\"" + hub["hubname"] + "\"/></div>"; 

        $tc += "<div><label for='inp_hubid' class=\"startupinp\">Hub ID: </label>";
        $tc += "<input id='inp_hubid' class=\"startupinp\" name=\"hubid\" size=\"80\" type=\"text\" value=\"" + hub["hubid"] + "\"/></div>"; 

        $tc += "<div><label for='inp_hubtimer' class=\"startupinp\">Refresh Timer (seconds): </label>";
        $tc += "<input id='inp_hubtimer' class=\"startupinp\" name=\"hubtimer\" size=\"10\" type=\"text\" value=\"" + hub["hubtimer"] + "\"/></div>"; 

        $tc += "<input class=\"hidden\" name=\"hubrefresh\" type=\"hidden\" value=\"" + hub["hubrefresh"] + "\"/>"; 
        
        $tc += "<div class=\"buttonrow\">";
        $tc += "<input class=\"authbutton hubupdate" + "\" value=\"Update Hub\" type=\"button\" />";
        $tc += "<input class=\"authbutton hubauth" + authclass + "\" value=\"Authorize Hub\" type=\"button\" />";
        $tc += "<input class=\"authbutton hubdel" + hubclass + "\" value=\"Remove Hub\" type=\"button\" />";
        $tc += "</div>";
        
        $tc += "</form>";
        $tc += "</div>";

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
    if ( obj!==null && typeof obj === "object" ) {
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

function is_number(obj) {
    var fnum = parseFloat(obj);
    var inum = parseInt(obj);
    return ( (! isNaN(fnum)) || (! isNaN(inum)) );
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
    // var dstr = "{" + d.toLocaleDateString() + " " + d.toLocaleTimeString() + "} => ";
    var dstr = "(" + d.toLocaleString() + ") ==> ";
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
function getNewPage(userid, pname, configoptions, roomid, roomname, kroom, things, alldevices) {
    var $tc = "";
    $tc += "<div id=\"" + roomname + "-tab\">";
    $tc += "<form title=\"" + roomname + "\" action=\"#\">";
    
    // surround all things on a page with a div tied to the room name
    // added roomid from the database since that is now needed to process things
    // if one really wants to style by room number use the panel-kroom class which includes it
    // this will be the actual room order number not the DB roomid value - the DB roomid value is only used internally
    $tc += "<div id=\"panel-" + roomname + "\" roomid=\"" + roomid + "\" title=\"" + roomname + "\" class=\"panel panel-" + kroom + " panel-" + roomname + "\">";

    // place holders for tab navigators that show up on hover
    // $tc += "<div class='prevTab'> </div><div class='nextTab'> </div>";

    // the things list can be integers or arrays depending on drag/drop
    var zcolor = 200;
    things.forEach(function(thing) {
        
        // get the offsets and the tile id
        // var tileid = thing["things_tileid"];
        var tileid = thing["devices_id"];
        var uid = thing["devices_uid"];
        var postop = thing["things_posy"];
        var posleft = thing["things_posx"];
        var zindex = parseInt(thing["things_zindex"]);
        var customname = thing["things_customname"];
        var bid = thing["devices_deviceid"];
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
        var thesensor = {id: bid, name: thingname, thingid: thingid, uid: uid, roomid: roomid, type: swtype, 
                         hubnum: hubid, hubindex: hubindex, hubtype: hubtype,
                         hint: hint, refresh: refresh, value: pvalue};

        // if our thing is an object show it
        if ( typeof thesensor==="object" ) {

            // adjust the zindex to show on top of others if there is a color field
            // this starts at 199 and counts down to 100 assuming fewer than 100 color things on a page
            // but only do this for relative placement tiles
            // we handle color separately for dragged tiles
            if ( array_key_exists("color", thesensor.value) && posleft===0 && postop===0 ) {
                zcolor--;
                zindex = zcolor;
                if ( zcolor < 100 ) { zcolor = 200; }
            }

            $tc += makeThing(userid, pname, configoptions, tileid, thesensor, roomname, postop, posleft, zindex, customname, false, alldevices);
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
        console.error( (ddbg()), thingname, "error: ", e);
        return;
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
function getFileName(userid, pname, thingvalue, thingtype, configoptions) {

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
    var fn = "";

    // get the name, width, height to create
    if ( array_key_exists("name", thingvalue) ) {
        var fn = thingvalue["name"].trim();
    }
    if ( fn === "" ) {
        fn = thingtype.substring(0,1).toUpperCase() + thingtype.substring(1);
    }
    thingvalue["name"] = fn;
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
            grtypes = [".jpg",".jpeg",".png",".gif"];
            break;
        case "video":
            grtypes = [".mp4",".ogg"];
            break;
        case "frame":
            grtypes = [".html",".htm"];
            break;
        case "custom":
        case "blank":
            grtypes = [".jpg",".jpeg",".png",".gif",".mp4",".ogg",".html",".htm"];
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
                if ( $vn==="" && fs.existsSync(skin + "/icons/"+ fn)) {
                    $vn = skin + "/icons/" + fn;
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
                        if ( $vn==="" && fs.existsSync(skin + "/icons/" + fn + $ext) ) {
                            $vn = skin + "/icons/" + fn + $ext;
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
            case "jpeg":
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
    // if ( mediafile ) {
    //     thingvalue["_media_"] = mediafile;
    // }
    return thingvalue;
}

// function to create frame2.html with AccuWeather for a city
// the City Name, Country Code, and the Location Code from AccuWeather must be provided
// writeAccuWeather("ann-arbor-mi","us","329380");
function writeAccuWeather(userid, city, region, code) {
    if ( !userid || !city || !code || !region ) {
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
    if ( !userid || !city || !code || !region ) {
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

// offer an alternative to entering city codes by allowing entire code block copied from either AccuWeather or WeatherWidget.io
function writeWeatherWidget(userid, weatherwidget, framenum) {
    if ( !userid || !weatherwidget || !framenum ) {
        return;
    }

    // fix up weather widget code to be a full html page
    // but first check if its already a full html page
    weatherwidget = weatherwidget.trim();
    if ( ! (weatherwidget.toLowerCase().includes("<html") && weatherwidget.toLowerCase().includes("<body") &&
            weatherwidget.toLocaleLowerCase().startsWith("<!doctype") ) ) {
        weatherwidget = "<!DOCTYPE html>\n<html>\n<head>\n" +
            "<title>Weather Widget</title>\n</head>\n<body>\n" +
            weatherwidget + "\n</body>\n</html>\n";
    }
    
    var fname = "user" + userid + "/Frame" + framenum + ".html";
    fs.writeFileSync(fname, weatherwidget, {encoding: "utf8", flag:"w"});
}

function getWeatherIcon(num, weathertype) {
    var iconimg;
    var iconstr;
    var numstr = num.toString();
    if ( weathertype==="accuWeather" ) {
        num = numstr + ".svg";
        iconimg = "https://accuweather.com/images/weathericons/" + num;
        iconstr = "<img src=\"" + iconimg + "\" alt=\"" + num + "\" width=\"80\" height=\"80\">";
    } else if ( weathertype==="tomorrowio" ) {
        iconimg = "media/tomorrowio/na.png";
        var description = "unknown";
        const files = fs.readdirSync("media/tomorrowio");
        // if day or night not given assume day
        if ( numstr.length === 4 ) {
            numstr = numstr + "0";
        }
        for (var icfile of files) {
            const fileBase = path.basename(icfile,".png");
            const fileExt = path.extname(icfile);
            var i = fileBase.indexOf("_");

            if ( fileExt === ".png" && fileBase.substring(0,i) === numstr ) {
                var len = fileBase.length;
                description = fileBase.substring(i+1, len - 6);
                iconimg =  "media/tomorrowio/" + fileBase + fileExt;
                break;
            }
        }
        iconstr = "<img src=\"" + iconimg + "\" alt=\"" + description + "\" width=\"80\" height=\"80\">";

    } else if ( weathertype==="hubitat") {

        if ( typeof num === "string" && num.startsWith("<img") ) {
            iconstr = num;
        } else if ( num==="na" || (typeof num === "string" && num.startsWith("weather")) ) {
            iconimg = "media/weather/" + num + ".png";
            iconstr = "<img src=\"" + iconimg + "\" alt=\"" + num + "\" width=\"80\" height=\"80\">";
        } else {
            num = num.toString();
            if ( num.length < 2 ) {
                num = "0" + num;
            }
            iconimg = "media/weather/" + num + ".png";
            iconstr = "<img src=\"" + iconimg + "\" alt=\"" + num + "\" width=\"80\" height=\"80\">";
        }
    } else {
        iconimg = "media/weather/na.png";
        iconstr = "<img src=\"" + iconimg + "\" alt=\"na\" width=\"80\" height=\"80\">";
    }
    return iconstr;
}

// TODO - update this to handle special translations for Ambient Weather
function translateWeather(pvalue) {
    if ( !pvalue || typeof pvalue!=="object" ) {
        console.log( (ddbg()), "invalid weather data - object expected but not found");
    } else if ( pvalue.weatherIcon && pvalue.forecastIcon ) {
        pvalue["weatherIcon"] = getWeatherIcon(pvalue.weatherIcon,"hubitat");
        pvalue["forecastIcon"] = getWeatherIcon(pvalue.forecastIcon,"hubitat");
    } else if ( pvalue.weatherCode ) {
        pvalue["weatherCode"] = getWeatherIcon(pvalue.weatherCode, "tomorrowio");
    } else if ( pvalue.realFeel ) {
        pvalue = translateAccuWeather(pvalue);
    }
    return pvalue;
}

function translateAccuWeather(pvalue) {
    // the rest of this function fixes up the accuWeather tile
    var newvalue = {};
    newvalue.name = "Weather";
    newvalue.temperature = pvalue.temperature;
    newvalue.realFeel = pvalue.realFeel;
    newvalue.weatherIcon = getWeatherIcon(pvalue.weatherIcon, "accuWeather");
    if ( newvalue.weatherIcon===false ) {
        delete newvalue.weatherIcon;
    }

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

function makeThing(userid, pname, configoptions, kindex, thesensor, panelname, postop, posleft, zindex, customname, wysiwyg, alldevices) {
    let $tc = "";
    let thingtype = thesensor["type"];
    let bid = thesensor["id"];
    const wwx = wysiwyg ? "x_" : "";

    // set custom name provided by tile editor
    // this is overruled by any name provided in the tile customizer
    if ( customname && array_key_exists("name", thesensor.value) ) { 
        thesensor.value["name"] = customname.trim();
    }

    // add in customizations here
    if ( configoptions && is_object(configoptions) ) {
        thesensor.value = getCustomTile(userid, configoptions, thesensor.value, bid);
        thesensor.value = getFileName(userid, pname, thesensor.value, thingtype, configoptions);
    }
    
    if ( !wysiwyg || wysiwyg!=="pe_wysiwyg" ) {
        thesensor.value = setValOrder(thesensor.value);
    }

    var thingvalue = thesensor.value;
        
    // set type to hint if one is given
    // this is to support ISY nodes that all register as ISY types
    // so we can figure out what type of tile this is closest to
    // this also is used to include the hub type in the tile
    var hint = thesensor["hint"] || "";
    var hubnum = thesensor["hubnum"] || "-1";
    var hubindex = thesensor["hubindex"];
    var refresh = "";
    var thingid = thesensor.thingid;
    var hubtype = thesensor.hubtype || "None";
    var uid = thesensor.uid;

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
    // zindex = parseInt(zindex);

    // now swap out cnt for thingid since thingid is guaranteed to be unique
    var cnt = thingid;

    var idtag = "t-" + thingid;
    if ( wysiwyg ) {
        idtag = wysiwyg;
    }

    // set the custom name
    // limit to 132 visual columns but show all for special tiles and custom names
    // now we use custom name in both places
    // var thingname = thingvalue["name"];
    var thingname = thesensor["name"];

    // wrap thing in generic thing class and specific type for css handling
    // include the new thingid value for direct access to the specific thing in the DB
    // removed aid since it is the same as thingid and updated the js code
    // added uid which is a unique id for just this user to get to the device quickly
    // that way devices[userid, uid] can be used to get to devices[id] and avoid huge pointer numbers in the GUI
    // $tc = "<div id=\""+idtag+"\" thingid=\""+thingid+"\" aid=\""+cnt+"\" uid=\""+uid+"\" hub=\""+hubnum+"\" hubindex=\""+hubindex+"\"  hubtype=\""+hubtype+"\" tile=\""+kindex+"\" bid=\""+bid+"\" type=\""+thingtype+"\"";
    $tc = "<div id=\""+idtag+"\" thingid=\""+thingid+"\" uid=\""+uid+"\" hub=\""+hubnum+"\" hubindex=\""+hubindex+"\"  hubtype=\""+hubtype+"\" tile=\""+kindex+"\" bid=\""+bid+"\" type=\""+thingtype+"\"";
    
    // set up the class setting
    var classstr = "thing " + thingtype+"-thing" + subtype;
    if ( hint ) {
        $tc += " hint=\""+hint+"\"";
    }
    classstr += " p_"+kindex;

    // add the panel name to the class
    // this allows styling to be page dependent or applied everywhere
    classstr = panelname + " " + classstr;
    classstr = uniqueWords(classstr);

    $tc += " panel=\""+panelname+"\" class=\""+classstr+"\"";
    if ( refresh!=="never" && refresh!=="" ) {
        $tc += " refresh=\""+refresh+"\"";
    }
    var pos = "absolute";
    if ( wysiwyg || (postop===0 && posleft===0) ) {
        pos = "relative";
        posleft = 0;
        postop = 0;
    }
    $tc += " style=\"position: "+pos+"; left: "+posleft+"px; top: "+postop+"px; z-index: "+zindex+";\"";
    $tc += ">";


    // same thingname field for each tile with the original name
    $tc += `<div aid="${cnt}" type="${thingtype}" subid="thingname" title="${thingname}" class="thingname ${thingtype} t_${kindex}" id="${wwx}s-${cnt}">`;
    $tc += thingname;
    $tc += "</div>";

    // no longer do any special handling for weather tiles since we can do side by side other ways
    // also weather can now be from other sources
    // create a thing in a HTML page using special tags so javascript can manipulate it
    // multiple classes provided. One is the type of thing. "on" and "off" provided for state
    // for multiple attribute things we provide a separate item for each one
    // the first class tag is the type and a second class tag is for the state - either on/off or open/closed
    // ID is used to send over the groovy thing id number passed in as $bid
    // for multiple row ID's the prefix is a$j-$bid where $j is the jth row
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
        let tval = thingvalue[tkey];
        let userSubtype = subtype;

        // add operating state for thermostats
        if ( thingtype === "thermostat" && tkey==="temperature" && thingvalue["thermostatOperatingState"] ) {
            userSubtype = userSubtype + " " + thingvalue["thermostatOperatingState"];
        }

        // check value for "json" strings
        let jsontval;
        if ( is_object(tval) ) {
            jsontval = clone(tval);
        } else if ( typeof tval === "string" ) {
            try {
                jsontval = JSON.parse(tval);
            } catch(jerr) {
                jsontval = null;
            }
        }
        
        // handle other cases where the value is an object like audio or music tiles
        // but audio, music, and weather and handled elsewhere so don't do it again here
        // expanded json objects only descend 2 levels and won't honor customizations
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
                        let isarr2 = is_array(jtval);
                        for (let jtkey2 in jtval) {
                            let jtval2 = jtval[jtkey2];
                            if ( isarr2 ) {
                                jtkey2 = jtkey + "_" + jtkey2.toString();
                            }
                            // only print strings and non duplicates - don't descend more than 2 levels
                            // i should have written putElement as a recursive function call - this is to be done later
                            if ( jtkey2 && jtval2 && (typeof jtval2!=="object") && !array_key_exists(jtkey2, thingvalue) ) {
                                $tc += putElement(kindex, cnt, bid, thingtype, jtval2, jtkey2, subtype, "", jtkey2, twidth, theight, "");
                                j++;
                            }
                        }
                    } else {
                        $tc += putElement(kindex, cnt, bid, thingtype, jtval, jtkey, subtype, "", jtkey, twidth, theight, "");
                        j++;
                    }
                }
            }
        } else { 
            
            // new logic for links - they all now follow the format LINK::content
            // where content is linkid::realsubid (see customize.js for details)
            // and companion tags are only printed within LINK elements on the browser now
            // print a hidden field for user web calls and links
            // this is what enables customization of any tile to happen
            $tc += putLinkElement(kindex, cnt, bid, thingtype, tval, tkey, userSubtype, twidth, theight);
            j++;
        }
    }    

    $tc += "</div>";    
    return $tc;

    // modified to not write a sidecar element but to instead write a modified element directly
    // this makes it easier to manage links since we don't have to look for sidecar elements
    function putLinkElement(kindex, cnt, bid, thingtype, tval, tkey, subtype, twidth, theight)  {

        var linktype = thingtype;
        var subid = tkey;
        var realsubid = subid;
        var linkbid = bid;
        let command = "";
        let linkid = "";
        let linkhub = "";
        let linkval = tval ? tval : "";
        let helperval = linkval.toString();
        try {
            const ipos = helperval.indexOf("::");
            if ( ipos !== -1 ) {
                command = helperval.substr(0, ipos);
                linkval = helperval.substr(ipos+2);
            }
        } catch(e) {
            console.error( (ddbg()), "error parsing link command from helperval: ", helperval, " error: ", e);
            command = "";
            linkval = helperval;
        }
        let linktileval = linkval;

        if ( command === "LINK" && alldevices ) {
            linkval = helperval.substring(6);
            let jpos = linkval.indexOf("::");
            let linkuid = linkval;
            if ( jpos !== -1 ) {
                // new link format so we can get both linkid and realsubid
                // we now pass the linkid and the realsubid here so it is easy to get the realsubid
                // for this to work we changed the way LINK tiles are presented on screen
                // note that this will now always show the subid after the linkid
                // for new links this will be the realsubid for legacy links it will be the subid used in the link
                // realsubid = linkval.substr(0, jpos)
                // var linkid = linkval.substr(jpos+2);
                linkuid = linkval.substring(0, jpos);
                realsubid = linkval.substring(jpos+2);
            }

            // get the device for this linked tile
            var linkdev = alldevices[linkuid];
            if ( linkdev && realsubid ) {
                
                // replace the place holder value with the linked value
                // these will be updated in the updateLink() function later in housepanel.js
                try {
                    linktype = linkdev["devices_devicetype"];
                    linkid = linkdev["devices_id"];
                    linkbid = linkdev["devices_deviceid"];
                    linkhub = linkdev["devices_hubid"];
                    hint = linkdev["devices_hint"];
                    linktileval = decodeURI2(linkdev["devices_pvalue"]);

                    // put linked val through the customization
                    // also include processing of special tiles that could be linked too
                    // the customtile call here can only be a time or a date field
                    // because we don't present custom fields when links are defined in the customizer
                    // so this call is only here to properly format times and dates that are linked
                    linktileval = getCustomTile(userid, configoptions, linktileval, linkbid);
                    linktileval = getFileName(userid, pname, linktileval, linktype, configoptions);
                    if ( array_key_exists(realsubid, linktileval) ) {
                        tval = linktileval[realsubid];
                    } else {
                        console.warn( (ddbg()), "warning, realsubid: ", realsubid, " not found in linked tile #"+linkuid);
                        tval = helperval;
                    }
                    // look for width and height and replace if there
                    if ( array_key_exists("width",linktileval) && linktileval["width"] && twidth ) {
                        twidth = linktileval["width"];
                    }
                    if ( array_key_exists("height",linktileval) && linktileval["height"] && theight ) {
                        theight = linktileval["height"];
                    }
                } catch(e) {
                    console.warn( (ddbg()), "warning for linkuid: ", linkuid, " realsubid: ", realsubid, " error: ", e);
                    tval = helperval;
                }
            } else {
                tval = helperval;
            }

        } else if ( command === "TEXT" ) {
            tval = linkval;

        // these commands don't get invoked upon page refresh
        // to invoke them you must click on them
        } else if ( command === "PUT" || command === "POST" ) {
            tval = command + "::" + subid;

        } else if ( command === "GET" ) {
            const configkey = "user_" + bid;
            const configval = getConfigItem(configoptions, configkey) || [];
            configval.forEach( item => {
                let weburl = item[1];
                let skey = item[2];
                tval = command + "::" + subid;
                if ( item[0]===command && skey === tkey ) {
                    curl_call(weburl, null, false, false, command)
                    .then( response => {
                        setTimeout( function() {
                            urlCallback(userid, bid, thingtype, tkey, response, command);
                        }, PUSHDELAY);
                    })
                    .catch( error => {
                        console.error( (ddbg()), "error on " + command + " call: ", error, " userid=",userid, " bid=",bid, " thingtype=",thingtype, " tkey=",tkey);
                    });
                }
            });          
        }
        return putElement(kindex, cnt, linkbid, linktype, tval, tkey, subtype, realsubid, twidth, theight, command);
    }

    function putElement(kindex, i, bid, thingtype, tval, tkey, subtype, realsubid, twidth, theight, command) {
        
        // cleans up the name of music tracks for proper html page display
        // no longer trim the name because that breaks album art
        function fixTrack(tval) {
            if ( !tval || typeof tval!=="string" || tval.trim()==="" ) {
                tval = "None"; 
            }
            return tval;
        }

        let $tc = "";
        var aitkey = "a-" + i + "-" + tkey;
        var pkindex = " p_" + kindex;
        var aidi = `<div aid="${i}"`;
        var ttype = ` type="${thingtype}"`;
        var pn = ` pn="0"`;
        const bidtag = " linkbid=" + bid;
        const commandtag = command ? ` command="${command}"` : "";
        var n = 0;
        
        // fix the command subid for linked tiles by using the real subid instead of tkey
        // if ( realsubid.startsWith("_") && tval!=="0" && tval!== realsubid.substring(1) ) {
        if ( realsubid && realsubid.startsWith("_") && tval!=="0" ) {
            n = parseInt(tval);
            if ( isNaN(n) ) { n = 0; }
            pn = ` pn="${n}"`
            // tval = realsubid.substring(1)
            tval = tkey;
            if ( tkey.startsWith("_") ) {
                tval = tkey.substring(1);
            }
        }

        // handle global text substitutions
        if ( array_key_exists(tval, GLB.dbinfo.subs) ) {
            tval = GLB.dbinfo.subs[tval];
        }

        if ( typeof subtype === "undefined" ) {
            subtype = "";
        } else if ( typeof subtype === "string" && subtype.substring(0,1)!==" " ) {
            subtype = " " + subtype;
        }

        if ( tval===0 ) { tval = "0"; }
        else if ( typeof tval === "undefined" ) { tval = ""; }

        // do nothing if this is a rule and rules are disabled
        if ( !GLB.dbinfo.enablerules && typeof tval==="string" && tval.substring(0,6)==="RULE::" ) {
            return $tc;
        }
            
        // build a styling tag for those that differ and include the command if there is one
        var tkeyshow = (tkey === thingtype) ? "" : " " + tkey;
        if ( realsubid && realsubid!==tkey && realsubid!==thingtype ) {
            tkeyshow = tkeyshow + " " + realsubid;
        }
        if ( command ) {
            tkeyshow = tkeyshow + " " + command.toLowerCase();
        }

        // make a tag to hold the real subid if this is a link
        var realtag = "";
        if ( command==="LINK" ) {
            realtag = " realsubid=\"" + realsubid + "\"";
        }
        
        // fix thermostats to have proper consistent tags
        // we use the real key name here since the link could be any random name
        // this only matters if this is a link reference - but notice we keep the user's tkey in the styling
        // we only use the realsubid to determine whether to apply this special type of styling
        // notice we use alias name in actual value and original key in up/down arrows
        if ( realsubid==="hue" || realsubid==="saturation" ||
             realsubid==="heatingSetpoint" || realsubid==="coolingSetpoint" ) 
        {
            $tc += "<div class=\"overlay " + tkey + " " + subtype + " v_" + kindex + "\">";
            $tc += aidi + " subid=\"" + tkey + "-dn\" title=\"" + tkey + " down\" class=\"" + thingtype + " arrow-dn " + tkey + "-dn " + pkindex + "\"></div>";
            $tc += aidi + pn + bidtag + commandtag + realtag + " subid=\"" + tkey + "\" title=\"" + thingtype + " " + tkey + "\" class=\"" + thingtype + " arrow-it " + tkeyshow + pkindex + "\"" + " id=\"" + wwx + aitkey + "\">" + tval + "</div>";
            $tc += aidi + " subid=\"" + tkey + "-up\" title=\"" + tkey + " up\" class=\"" + thingtype + " arrow-up " + tkey + "-up " + pkindex + "\"></div>";
            $tc += "</div>";

        // process analog clocks signalled by use of a skin with a valid name other than digital
        // changed this so we can use customizer to make multiple analog clocks anywhere
        // } else if ( thingtype==="clock" && tkey==="skin" && tval && tval!=="digital" ) {
        } else if ( realsubid==="skin" && tval && tval.startsWith("CoolClock:") ) {
            $tc += "<div class=\"overlay "+tkey+" v_"+kindex+"\">";
            $tc += aidi + pn + bidtag + commandtag + realtag + ttype + "\"  subid=\""+tkey+"\" title=\"Analog Clock\" class=\"" + thingtype + subtype + tkeyshow + pkindex + "\" id=\"" + wwx +aitkey+"\">" +
                "<canvas id=\"" + wwx + "clock_"+tkey+"_"+i+"\" class=\""+tval+"\"></canvas></div>";
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
            } else if ( realsubid==="time" || realsubid==="date" || realsubid==="color" || typeof tval!=="string" || tval==="" || tval==="lastRunTime" || tval==="lastFinishTime" ||
                    (realsubid.substr(0,6)==="event_") || realsubid.startsWith("_") ||
                    realsubid==="trackDescription" || realsubid==="currentArtist" || realsubid==="groupRole" ||
                    realsubid==="currentAlbum" || realsubid==="trackImage" || realsubid==="mediaSource" ||
                    realsubid==="weatherIcon" || realsubid==="forecastIcon" ||
                    !isNaN(+tval) || thingtype===tval ||
                    (tval.substring(0,7)==="number_") || 
                    (tval.indexOf("://")!==-1) ||
                    (tval.indexOf("::")!==-1) || tval.length > 30 ) {
                extra = "";
            } else {
                extra = " " + tval;
            }

            if ( realsubid === "def_Int" || realsubid === "def_State" ) {
                extra += " vardef";
            }
            
            // fix track names for groups, empty, and super long
            if (realsubid==="trackDescription") {
                tval = fixTrack(tval);
            // change this over to a css so we can style it if needed
            } else if (realsubid==="trackImage") {
                if ( tval.substring(0,4) === "http" ) {
                    if ( twidth && theight ) {
                        tval = "<img class='" + tkey + "' width='" + twidth + "' height='" + theight + "' src='" + tval + "'>";
                    } else {
                        tval = "<img class='" + tkey + "' width='120px' height='120px' src='" + tval + "'>";
                    }
                }
            } else if ( realsubid === "battery") {
                var powmod = parseInt(tval);
                powmod = powmod - (powmod % 10);
                tval = "<div style=\"width: " + tval + "%\" class=\"ovbLevel L" + powmod.toString() + "\"></div>";
            } else if ( tval && typeof tval==="string" && tval.startsWith("rtsp:") && tval.length > 40 ) {
                extra = extra + " rtsp";
            }

            // include class for main thing type, the subtype, a sub-key, and a state (extra)
            // also include a special hack for other tiles that return number_ to remove that
            // this allows KuKu Harmony to show actual numbers in the tiles
            // finally, adjust for level sliders that can't have values in the content
            // hide all fields that start with uom_ since that contains units 
            // couid do in CSS but this is easier and faster
            if ( realsubid.startsWith("uom_") ) {
                $tc += "<div class=\"overlay "+tkey+" hidden v_"+kindex+"\">";
            } else if ( realsubid.startsWith("def_") ) {
                $tc += "<div class=\"overlay "+tkey+" vardef v_"+kindex+"\">";
            } else {
                $tc += "<div class=\"overlay "+tkey+" v_"+kindex+"\">";
            }

            if ( tkey === "level" || tkey==="onlevel" || tkey==="colorTemperature" || tkey==="volume" || tkey==="position" ) {
                $tc += aidi + pn + bidtag + commandtag + realtag + ttype + " subid=\"" + tkey+"\" value=\""+tval+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + "\" id=\"" + wwx + aitkey + "\"></div>";
            } else if ( typeof tkey==="string" && typeof tval==="string" && tkey.substring(0,8)==="_number_" && tval.substring(0,7)==="number_" ) {
                var numval = tkey.substring(8);
                $tc += aidi + pn + bidtag + commandtag + realtag + ttype + " subid=\"" + tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + "\" id=\"" + wwx + aitkey + "\">" + numval + "</div>";
            } else {
                if ( command==="RULE" && subtype!=="rule" ) {
                    tkeyshow += " rule";
                }
                $tc += aidi + pn + bidtag + commandtag + realtag + ttype + "  subid=\""+tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + extra + "\" id=\"" + wwx + aitkey + "\">" + tval + "</div>";
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
            var mstr = (mofy + 1).toString();
            if ( mstr.length < 2 ) {
                mstr = "0" + mstr;
            }   
            datestr = datestr.replace("m", mstr);
        }
        if ( fmtdate.indexOf("W")!==-1 ) {
            datestr = datestr.replace("W", weekday);
        }
        if ( fmtdate.indexOf("w")!==-1 ) {
            var wstr = (dofw+1).toString();
            datestr = datestr.replace("w", wstr);
            weekday = wstr;
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
    return timestr;
}

function getClock(clockid) {
    // set up all defaults here - can change with customizer
    var clockname = "Digital Clock";
    var clockskin = "";
    if ( clockid==="clockanalog" ) {
        clockname = "Analog Clock";
        clockskin = "CoolClock:housePanel:80";
    }
    var d = new Date();
    var fmtdate = "M d, Y";
    var dates = getFormattedDate(fmtdate, d);
    var dateofmonth = dates.date;
    var weekday = dates.weekday;

    var fmttime = "h:I:S A";
    var timezone = d.getTimezoneOffset();
    var timeofday = getFormattedTime(fmttime, d, timezone);

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
// Documenting how custom tiles work here:
// Each tile has a set of default subid's and values, and in the customer a user can add new ones or
// replace existing ones. Each custom subid is stored in the DB as a config option with
// configkey = "user_" + bid where bid is the deviceid of the tile being customized
// configval is an encoded URI string representing an array of arrays
// each subarray has three entries: [calltype, content, subid]
// calltype is one of PUT, GET, POST, URL, LINK, LIST, RULE, TEXT
// content is different for each calltype. For PUT, GET, POST, URL it is the URL to call.
// For LINK it is linkid::realsubid where linkid is the deviceid and realsubid is the subid in that device
// for RULE it is the rule logic used in the rule engine to perform instructions
// for TEXT it is just a text string to display that 
// for LIST it is linkid::realsubid::frequency where frequency is how often to reset the list
// different things happen when these calltypes are used as shown in the doAction() function in hubserver.js
// the value returned here is processed by the putElement() function to create the proper on screen element
function getCustomTile(userid, configoptions, custom_val, bid) {

    const configkey = "user_" + bid;
    let updated_val = clone(custom_val);
    for ( const i in configoptions ) {
        const key = configoptions[i].configkey;
        const val = configoptions[i].configval;
        const keyuser = configoptions[i].userid;
        if ( key === configkey ) {
            if ( typeof val === "object" ) {
                updated_val = processCustom(val, updated_val);
            } else if ( typeof val === "string" ) {
                const lines = decodeURI2(val);
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
            
                const calltype = msgs[0].toString().toUpperCase().trim();
                const content = msgs[1].toString().trim();
                const subidraw = msgs[2].trim();
                // var subid = subidraw.replace(/[ \"\*\<\>\!\{\}\.\,\:\+\&\%]/g,"");
                const subid = subidraw.replace(/[^A-Za-z0-9_]/g, "");

                // process web calls made in custom tiles
                // in a tag called user_subid where subid is the requested field
                // the values for GET and LINK are placeholders and will be replaced on the browser
                // LINK is handled diferently. It passes the content which has the linkid and realsubid
                // TEXT just passes the text to display but also includes the command identifier so we know it was a custom text
                // that identifier will be removed in the putLinkeElement function
                // everything else just gets the calltype and subid
                if ( calltype === "LINK" ) {
                    let j = content.indexOf("::");
                    if ( j=== -1 ) {
                        custom_val[subid]= "LINK::" + content + "::" + subid;
                    } else {
                        custom_val[subid]= "LINK::" + content;
                    }
                } else if ( calltype === "TEXT" ) {                           
                    custom_val[subid] = content;
                } else {
                    custom_val[subid] = calltype + "::" + subid;
                }
            }
        });


        function isDate(val) {
            if ( typeof val==="string" ) {
                var d = Date.parse(val);
                return !isNaN(d);
            }
            return false;
        }

        // fix any date field to the user custom format specified
        // modified this to fix multiple date and time fields if present
        const d = new Date();
        if ( array_key_exists("fmt_date", custom_val) ) {
            try {
                const dates = getFormattedDate(custom_val["fmt_date"], d);
                for ( var key in custom_val ) {
                    if ( key.startsWith("date") && isDate(custom_val[key]) ) {
                        custom_val["date"] = dates.date;                    
                    }
                    if ( key.startsWith("weekday") ) {
                        custom_val[key] = dates.weekday;
                    }
                }
            } catch (e) {
                console.error((ddbg()), "error - setting custom date format");
            }
        }

        if ( array_key_exists("fmt_time", custom_val) || array_key_exists("tzone", custom_val)  ) {
            try {
                const tz = custom_val["tzone"] || 0;
                const tfmt = custom_val["fmt_time"] || "";
                const timeformatted = getFormattedTime(tfmt, d, tz);
                for ( var key in custom_val ) {
                    if ( key.startsWith("time") && isDate(custom_val[key]) ) {
                        custom_val["time"] = timeformatted;
                    }
                }
            } catch (e) {
                console.error((ddbg()), "error - setting custom time format");
            }
        }
        
        if ( DEBUG14 ) {
            console.log((ddbg()), "customized tile: ", custom_val);
        }
        return custom_val;
    }
}

// this little gem makes sure items are in the proper order
function setValOrder(val) {
    const order = { "_": 190, "_number_":70, 
                   "name": 1, "subname": 2, "color": 3, "switch": 6, "momentary": 7, "presence": 7, "presence_type": 8,
                   "contact": 9, "door": 8, "garage":8, "motion": 9, "themode": 10,
                   "make": 11, "modelName":12, "modelYear": 13, "vehiclecolor": 14, "nickName": 15,
                   "temperature": 41, "feelsLike":42, "temperatureApparent":42, "weatherCode":43, "weatherIcon":44, "forecastIcon":45,
                   "coolingSetpoint": 51, "heatingSetpoint": 52, "thermostatMode": 53, "thermostatFanMode": 54, 
                   "thermostat": 55, "thermostatSetpoint": 56, "thermostatOperatingState": 57, "humidity": 58,
                   "mileage": 21, "longitude": 22, "latitude": 23, "distanceToEmpty": 24, "fuelLevel_value": 25,
                   "trackDescription": 11, "trackImage": 12, "currentAlbum": 13, "mediaSource": 14, "currentArtist": 15, "playbackStatus": 16, 
                   "_mute": 17, "_muteGroup": 17, "_unmute": 18, "_unmuteGroup": 18, "_volumeDown": 19, "_volumeUp": 20, 
                   "_previousTrack": 21, "_pause": 22, "_play": 23, "_stop": 24, "_nextTrack": 25,
                   "_number_0":60, "_number_1":61, "_number_2":62, "_number_3":63, "_number_4":64, 
                   "_number_5":65, "_number_6":66, "_number_7":67, "_number_8":68, "_number_9":69,
                   "onlevel": 150, "level": 151, "volume": 152, "colorTemperature": 153, "hue": 141, "saturation": 142, "position": 153,
                   "allon": 41, "alloff": 42, "count": 148, "duration": 149, "deltaT": 149,
                   "user_":191, "event_":200,
                };

    function getComp(vala) {

        var comp = 100;
        Object.keys(order).forEach(function(val) {
            if ( vala.startsWith(val) ) {
                comp = order[val];
            }
        });

        return comp;
    }

    // leave user fields unsorted
    // but sort all others based on type of subid
    var keys = Object.keys(val).sort( function(vala, valb) {

        var compa = array_key_exists("user_"+vala, val) ? 199 : getComp(vala);
        var compb = array_key_exists("user_"+valb, val) ? 199 : getComp(valb);
        return compa - compb;
    });

    var newval = {};
    keys.forEach( function(key) {
        newval[key] = val[key];
    });

    return newval;
}

function updateTimeStamp(subid, pvalue) {
    var d = new Date();
    var timestr = d.toLocaleDateString() + " " +  d.toLocaleTimeString();
    if ( !subid ) return;

    if ( array_key_exists("duration",pvalue) && array_key_exists("deltaT",pvalue) ) {
        if ( pvalue[subid]==="on" || pvalue[subid]==="DON" || pvalue[subid]==="active" || pvalue[subid]==="present" || pvalue[subid]==="open" || pvalue[subid]==="unlocked" ) {
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
        } else if ( pvalue[subid]==="off" || pvalue[subid]==="DOF" || pvalue[subid]==="inactive" || pvalue[subid]==="absent" || pvalue[subid]==="closed" || pvalue[subid]==="locked" ) {
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
    if ( typeof pvalue[subid] === "number" ) {
        pvalue["event_1"] = timestr + " " + subid + " " + pvalue[subid].toString();
    } else if ( typeof pvalue[subid] === "string" && pvalue[subid].length < 20 ) {
        pvalue["event_1"] = timestr + " " + subid + " " + pvalue[subid];
    } else {
        pvalue["event_1"] = timestr;
    }
    return pvalue;
}

function processHubMessage(userid, hubmsg, newST) {
    var modemap = {"Day":"md", "Evening":"me", "Night":"md", "Away":"ma"};
    // loop through all devices tied to this message for any hub
    // push info to all things that match
    // we don't know the thing types so we have to check all things
    // this uses the format defined in the HousePanel.groovy file
    // that was also used in the old housepanel.push app
    var subid = hubmsg['change_attribute'];
    var hubmsgid = hubmsg['change_device'].toString();
    if ( DEBUG12 ) {
        console.log( (ddbg()), "processHubMessage - userid: ", userid, " hubmsg: ", hubmsg);
    }
    var pvalue;
    // pvalue[subid] = hubmsg['change_value'];

    // deal with presence tiles
    if ( hubmsg['change_value']==="not present" || hubmsg['change_value']==="not_present" ) {
        hubmsg['change_value'] = "absent";
    }
    var value = hubmsg['change_value'];

    // handle global text substitutions
    if ( !is_array(value) && array_key_exists(value, GLB.dbinfo.subs) ) {
        value = GLB.dbinfo.subs[value];
    }

    // update all devices from our list belonging to this user
    // the root device values are updated in the DB which causes all instances to update when this is called
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

            // handle special case where groovy pushes an array for color changes
            // this branch should no longer ever be used because I changed color to send a Map object that is handled below
            // I left this here for legacy support purposes which should still work but LIST and RULE attributes tied to hue, saturation, and level for bulbs will all fail
            if ( subid==="color" && is_array(value) && value.length > 3 && value[0] ) {
                pvalue["hue"] = value[0];
                pvalue["saturation"] = value[1];
                pvalue["level"] = value[2];
                pvalue["color"] = value[3];
            } else if ( is_object(value) ) {
                for (var key in value) {
                    pvalue[key] = value[key];
                }
            } else {
                pvalue[subid] = value;
            }

            // increment the count if this is not the inverse of a turn on action
            pvalue = updateTimeStamp(subid, pvalue);
            var swtype = device.devicetype;

            // handle special audio updates
            if ( swtype==="audio" || pvalue.audioTrackData ) {
                pvalue = translateAudio(pvalue);
            } else if ( swtype==="weather" ) {
                pvalue = translateWeather(pvalue);
            } else if ( swtype==="music" ) {
                pvalue = translateMusic(pvalue);
            } else {
                pvalue = translateObjects(pvalue, 2);
            }

            // update the DB
            device.pvalue = encodeURI2(pvalue);
            mydb.updateRow("devices", device, "userid = " + userid + " AND id = "+device.id, true)
            .then( res => {
                if ( DEBUG12 ) {
                    console.log( (ddbg()), "processHubMessage - db update: ", subid, " swtype: ", swtype, " pvalue: ", pvalue, " dbres: ", res);
                }
            })
            .catch( reason => {
                console.error( (ddbg()), "processHubMessage - DB update error: ", reason);
                return;
            });

            // if we request resetting upon a mode change, do it here, even if there are no rules set for the mode tile
            if ( subid==="themode" ) { 
                var newmode = pvalue["themode"];
                if ( modemap.hasOwnProperty(newmode) ) {
                    var nreset = modemap[newmode];
                    resetList(userid, nreset);
                }
            }

            pushClient(userid, hubmsgid, swtype, subid, pvalue);
            processRules(userid, device.uid, hubmsgid, swtype, subid, pvalue, true, "processMsg");
        });
        return devices;
    })
    .catch(reason => {
        console.error( (ddbg()), "processHubMessage - DB error: ", reason);
    });
}

// this function handles processing of all websocket calls from ISY
// used to keep wsclients in sync with the status of ISY operation
// because ISY hubs are local, this function must be invoked locally
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
    
    // skip this whole routine for local testing
    if ( EMULATEHUB ) {
        return;
    }

    if ( jsondata ) {
        var control = jsondata.control;
        var action = jsondata.action;
        var node = jsondata.node;
        var eventInfo = jsondata.eventInfo;

        var uom = 0;
        var prec = 0;
        if ( DEBUG9 ) {
            console.log( (ddbg()), "ISY event: ", jsonshow(jsondata) );
        }

        if ( is_array(node) && node.length && node[0]!=="" &&
                is_array(control) && control.length && control[0]!=="" &&
                action[0] && action[0]["$"] && action[0]["_"] ) 
        {
            var bid = node[0];
            newval = action[0]["_"];
            var obj = action[0]["$"];
            var isyid = control[0];
            var conditions = "userid = "+userid+" AND deviceid = '"+bid+"'";

            mydb.getRows("devices", "*", conditions)
            .then(devices => {

                if ( !devices ) { return; }
                devices.forEach(function(device) {
                    var devtype = device.devicetype;
                    var subid = mapIsyid(isyid, devtype);
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
                        // moved this to translate function - and obj always exists here
                        uom = obj["uom"] || 0;
                        prec = obj["prec"] || 0;
                    } catch (e) {
                        console.warn( (ddbg()), "warning - processIsyMessage failed: ", e);
                        return;
                    }
                    
                    // devicetype, value, obj.id, obj.value, obj.formatted, obj.uom, obj.prec, subid, setuom
                    pvalue = translateIsy(devtype, pvalue, isyid, newval, "", uom, prec, subid, false);
                    pvalue = updateTimeStamp(subid, pvalue);
                    
                    // update the DB
                    var pvalstr = encodeURI2(pvalue);
                    mydb.updateRow("devices", {id: device.id, pvalue: pvalstr}, "userid = "+userid+" AND id = "+device.id, true)
                    .then( res => {
                        if ( DEBUG9 ) {
                            console.log( (ddbg()), "ISY device update: ", bid, " trigger: ", isyid, " subid: ", subid, " pvalue: ", pvalue, " dbresult: ", res);
                        }
                    })
                    .catch( reason => {
                        console.error( (ddbg()), "ISY device update error: ", reason);
                    });

                    // handle global text substitutions
                    for (var skey in pvalue) {
                        var value = pvalue[skey];
                        if ( array_key_exists(value, GLB.dbinfo.subs) ) {
                            pvalue[skey] = GLB.dbinfo.subs[value];
                        }
                    }

                    pushClient(userid, bid, devtype, subid, pvalue);
                    processRules(userid, device.uid, bid, devtype, subid, pvalue, true, "processMsg");
                });


            }).catch(reason => {
                console.error( (ddbg()), "error with processIsyMessage, reason: ", reason);
            });

        // set variable changes events
        // include test for an init action which is skipped (kudos to @KMan)
        } else if ( is_array(eventInfo) && eventInfo.length && is_object(eventInfo[0]) && array_key_exists("var", eventInfo[0]) && action && action[0]==="6" ) {
            var varobj = eventInfo[0].var[0];
            var bid = "isy_variables";
            mydb.getRow("devices", "*", "userid = "+userid+" AND deviceid = '"+bid+"'")
            .then(results => {

                if ( !results ) { return; }

                var device = results;
                var devtype = device.devicetype;
                
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

                        // moved precision handling to translate function
                        var prec = 0;
                        if ( array_key_exists("prec", varobj) && is_array(varobj.prec) ) {
                            prec = varobj["prec"][0];
                        }
                        pvalue = translateIsy("variables", pvalue, subid, newval, "", 0, prec, subid, false)
                        pvalue = updateTimeStamp(subid, pvalue);

                        // update the DB
                        var pvalstr = encodeURI2(pvalue);
                        mydb.updateRow("devices", {id: device.id, pvalue: pvalstr}, "userid = "+userid+" AND id = "+device.id, true)
                        .then( res => {
                            if ( DEBUG9 ) {
                                console.log( (ddbg()), "ISY webSocket updated: ", bid, " subid: ", subid, " pvalue: ", pvalue, " dbresult: ", res);
                            }
                        })
                        .catch( reason => {
                            console.error( (ddbg()), "ISY device update error: ", reason);
                        });

                        // handle global text substitutions
                        for (var skey in pvalue) {
                            var value = pvalue[skey];
                            if ( array_key_exists(value, GLB.dbinfo.subs) ) {
                                pvalue[skey] = GLB.dbinfo.subs[value];
                            }
                        }

                        pushClient(userid, bid, devtype, subid, pvalue);
                        processRules(userid, device.uid, bid, devtype, subid, pvalue, true, "processMsg");
                    }
                } catch (e) {
                    console.warn( (ddbg()), "warning - var // processIsyMessage: ", e, device);
                    return;
                }
            })
            .catch(reason => {
                console.error( (ddbg()), "error in processIsyMessage: ", reason);
            });

        // handle program changes events
        } else if ( is_array(eventInfo) && eventInfo.length && is_object(eventInfo[0]) && array_key_exists("id", eventInfo[0]) && 
                    array_key_exists("r",  eventInfo[0]) && array_key_exists("f",  eventInfo[0]) ) {
            // var idsymbol = parseInt(eventInfo[0]["id"]);
            // idsymbol = idsymbol.toString();
            var idsymbol = eventInfo[0]["id"][0].toString().trim();
            var len = 4 - idsymbol.length;
            var bid = "prog_" + "0000".substring(0,len) + idsymbol;
            var subid = "status_";

            mydb.getRow("devices","*", "userid = "+userid+" AND deviceid = '"+bid+"'")
            .then(results => {

                if ( !results ) { return; }

                var device = results;
                var devtype = device.devicetype;
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

                    pvalue = updateTimeStamp(subid, pvalue);

                    // update the DB
                    var pvalstr = encodeURI2(pvalue);
                    mydb.updateRow("devices", {id: device.id, pvalue: pvalstr}, "userid = "+userid+" AND id = "+device.id, true)
                    .then( res => {
                        if ( DEBUG9 ) {
                            console.log( (ddbg()), "ISY webSocket updated: ", bid, " subid: ", subid, " pvalue: ", pvalue, " dbres: ", res);
                        }
                    })
                    .catch( reason => {
                        console.error( (ddbg()), "ISY device update error: ", reason);
                    });            

                    // handle global text substitutions
                    for (var skey in pvalue) {
                        var value = pvalue[skey];
                        if ( array_key_exists(value, GLB.dbinfo.subs) ) {
                            pvalue[skey] = GLB.dbinfo.subs[value];
                        }
                    }
                    
                    pushClient(userid, bid, devtype, "lastRunTime", pvalue);
                    processRules(userid, device.uid, bid, devtype, subid, pvalue, true, "processMsg");
                } catch(e) {
                    console.warn( (ddbg()), "warning - ISY program failure in processIsyMessage: ", e, device);
                    return;
                }
            }).catch(reason => {
                console.error( (ddbg()), "error in processIsyMessage: ", reason);
            });

        }
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

    return timestr;
}

function processRules(userid, uid, bid, thetype, trigger, pvalueinput, dolists, rulecaller) {

    if ( !GLB.dbinfo.enablerules || (typeof pvalueinput !== "object") ) {
        return;
    }

    var pvalue = clone(pvalueinput);
    pvalue.subid = trigger;

    // go through all things that could be links for this tile
    var configkey = "user_" + bid;
    var ifvalue = false;
    var rbid = bid;
    var rtype = thetype;

    // retrieve customization for this device
    Promise.all([
        mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'"),
        mydb.getRows("hubs", "*", "userid = "+userid),
        mydb.getRows("devices", "*", "userid = "+userid),
        mydb.getRow("devices","*","userid = "+userid+" AND deviceid = 'clockdigital'"),
    ])
    .then(results => {
        var config = results[0];
        var dbhubs = results[1];
        var dbdevices = results[2];
        var dbclock = results[3];
        var devices = {};
        var lines = null;
        if ( config ) {
            var rlines = decodeURI2(config.configval);
            lines = [];
            rlines.forEach(aline => {
                lines.push(aline);
            });
        }

        // get master array of devices keyed to the user specific new uid field
        // this matches how we set alldevices for use in displaying linked tiles
        if ( dbdevices && dbhubs && lines && lines.length ) {
            dbdevices.forEach(device => {
                const luid = device.uid;
                devices[luid] = device;
            });

            var hubs = {};
            dbhubs.forEach(hub => {
                const hid = hub.id;
                hubs[hid] = hub;
            });
            invokeRules(uid, lines, hubs, devices);
        }
        return [devices, dbclock];
    })
    .then( devarray => {
        var devices = devarray[0];
        var dbclock = devarray[1];
        if ( dolists ) {
            mydb.getRows("configs","*","userid = "+userid+" AND configtype = 1 AND configval LIKE '%LIST%'")
            .then(configs => {
                // must invoke separately and use all the configurations per query above
                if ( configs ) {
                    invokeLists(uid, configs, pvalueinput, dbclock, devices);
                }
            })
            .catch(reason => {
                console.error( (ddbg()), "processLists error: ", reason);
            });
        }
    })
    .catch(reason => {
        console.error( (ddbg()), "processLists error: ", reason);
    });

    // this populates all lists being tracked with new information upon changes
    function invokeLists(tileuid, configs, pvalue, dbclock, devices) {
        if ( DEBUG11 ) {
            console.log( (ddbg()),`InvokeLists tileuid: ${tileuid} pvalue: `, pvalue);
        }

        // get the time from our clock tile if it exists - this provides the user chosen format and time zone
        var d = new Date();
        var today;
        if ( dbclock && dbclock.pvalue ) {
            var tpvalue = decodeURI2(dbclock.pvalue);
            today = getFormattedDate(tpvalue["fmt_date"], d).date + ", " + getFormattedTime(tpvalue["fmt_time"], d, tpvalue["tzone"]);
        } else {
            today = d.toLocaleString();
        }

        // for (var devuid in devices ) {
        //     if ( devices[devuid].deviceid === "clockdigital" ) {
        //         var tpvalue = devices[devuid].pvalue;
        //         if ( typeof tpvalue === "string") {
        //             tpvalue = decodeURI2(tpvalue);
        //         }
        //         today = getFormattedDate(tpvalue["fmt_date"], d).date + ", " + getFormattedTime(tpvalue["fmt_time"], d, tpvalue["tzone"]);
        //         break;
        //     }
        // }

        // loop through all the configs and capture the invoking device so we know which one to attribute
        for (var i in configs) {
            var config = configs[i];
            var sourcebid = config.configkey.substring(5); // "user_xxx"
            var sourcetile = tileuid;

            // this little bit of code is only needed to deal with legacy LIST items
            // that nobody should have except me. Otherwise we could just set sourcetile = 0 becasue it won't be used
            // to confirm this, take a look into the code of parseCustomizeContent where user params are set
            for (var devuid in devices ) {
                if ( devices[devuid].deviceid === sourcebid ) {
                    sourcetile = parseInt(devuid);
                    break;
                }
            }
            var rlines = decodeURI2(config.configval);
            var items = [];
            if ( is_array(rlines) ) {
                rlines.forEach(aline => {
                    items.push(aline);
                });
            }

            items.forEach( function(item) {
                if (item[0]==="LIST") {
                    var lsubid = item[2];
                    var arr = parseCustomizeContent(sourcetile, item[1]);
                    var targetsubid = arr[1];
                    if ( arr[0]===tileuid && targetsubid===trigger && pvalue[targetsubid] ) {                
                        var newval = pvalue[targetsubid];
                        var newobj = {userid: userid, deviceid: sourcebid, subid: lsubid, ltime: today, lvalue: newval }

                        // now get the last item in the list to see if this is a duplicate
                        // var lastadd = null;
                        var lastadd = mydb.getAdd();
                        if ( lastadd && lastadd.ltime && lastadd.userid === userid && lastadd.deviceid === sourcebid && lastadd.subid === lsubid && 
                                        lastadd.ltime === today && lastadd.lvalue === newval ) {
                            if ( DEBUG11 ) {
                                console.log( (ddbg()), "LIST update skipped due to duplicate: ", lastadd, newobj);
                            }
                        } else {
                            mydb.addRow("lists", newobj)
                            .then( ()=> {
                                if ( DEBUG11 ) {
                                    console.log( (ddbg()), "LIST updated: ", newobj);
                                }
                            })
                            .catch(reason => {
                                console.error( (ddbg()), "LIST update error: ", reason);
                            });
                        }
                    }
                }
            });
        }
    }

    function invokeRules(tileuid, items, hubs, devices) {
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
            console.log( (ddbg()), "RULE: id: ", bid, " type: ", thetype, " trigger: ", trigger, " tileuid: ", tileuid, " userid: ", userid, " rules: ", jsonshow(items) );
        }

        // loop through all the custom elements of this tile looking for rules
        items.forEach( function(item) {

            // process custom entries that are rules
            // the subid it is tied to is ignored as is the order number
            // so we only need to get item[0] and item[1]
            if ( item[0]==="RULE" ) {
                const linkval = item[1].trim();
                let isrule = false;

                // split the test line between commas and semi-colons
                const testcommands = linkval.split(regsplit);

                // only proceed if there are at least two parts and the first part starts with "if "
                if ( testcommands.length > 1 && testcommands[0].trim().startsWith("if") ) {

                    // get the if and the rule and continue if in the right format
                    const iftest = testcommands[0].match(ifpattern);
                    const rulestr = (iftest && iftest.length>1 && iftest[2]) ? iftest[2] : "";
                    if ( iftest[1]==="if" && rulestr ) {

                        // get the rule set
                        const ruleset = rulestr.split(/\s+/);
                        const newset = [];
                        let theword = "";
                        ruleset.forEach(function(aword) {
                            aword = aword.trim();
                            const alower = aword.toLowerCase();
                            if ( alower==="or" || alower==="and" ) {
                                newset.push(theword);
                                newset.push(alower);
                                theword = "";
                            } else if ( alower==="am" || alower==="pm" ) {
                                theword = theword + " " + aword;
                            } else {
                                theword = theword + aword;
                            }
                        }) 
                        newset.push(theword);

                        let doand = true;
                        if ( DEBUG11 ) {
                            console.log( (ddbg()), "RULE debug: rulestr: ", rulestr, " rulseset: ", ruleset, " newset: ", newset);
                        }
        
                        // loop through each one and add to test
                        let rulenum = 0;
                        let priorand = false;
                        let firstlogical = false;
                        newset.forEach( function(ruleRaw) {

                            let rule = ruleRaw.trim();
                            let ruleparts = null;
                            let ruletileid = null;
                            let rulesubid = "";
                            let rulevalue = "";
                            let ruleop = "";
                            let ruleop2 = "";
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
                                        ruletileid = tileuid;
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
                                const jv = rulevalue.substring(0,1);
                                const kv = rulevalue.indexOf("$");
                                let rvindex;
                                if ( jv === "$" ) {
                                    rvindex = rulevalue.substring(1);
                                    if ( array_key_exists(rvindex, pvalue) ) {
                                        rulevalue = pvalue[rvindex];
                                    }
                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "rule: rvindex = ", rvindex, " rulevalue= ", rulevalue, " pvalue: ", pvalue);
                                    }

                                // use another tile's existing value for check using @tilenum$fieldname syntax
                                // rvtile now is the uid of the referenced tile, not the id
                                } else if ( jv === "@" && kv !== -1 ) {
                                    const rvtile = rulevalue.substring(1, kv);
                                    rvindex = rulevalue.substring(kv+1);
                                    const rulepvalue = decodeURI2(devices[rvtile].pvalue);
                                    if ( rulepvalue ) {
                                        rulevalue = rulepvalue[rvindex];
                                    } else {
                                        rulevalue = false;
                                    }
                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "rule: rvtile = ", rvtile, " rvindex: ", rvindex, " rulevalue= ", rulevalue);
                                    }
                                }

                                if ( DEBUG11 ) {
                                    console.log( (ddbg()), "RULE debug: ruleparts: ", ruleparts, " ruletileid: ", ruletileid, " rulesubid: ", rulesubid, 
                                                        " ruleop: ", ruleop, " rulevalue: ", rulevalue, " before: ", doand, " rule: ", rule, " isrule: ", isrule);
                                }
        
                                // compute the test if this test part has the required elements
                                if ( ruletileid !== null && !isNaN(ruletileid) && ruleop && rulevalue!==undefined && rulevalue!==null && rulevalue!=="" ) {

                                    // find the tile index and proceed with activating the rule
                                    if ( ruletileid===tileuid && array_key_exists(rulesubid, pvalue) ) {
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

                                    // fix up ISY hubs - no longer do this because ISY devices now can be any type
                                    // this means when writing rules you have to use DON and DOF if that is what you want
                                    // if ( rtype==="isy" && rulevalue==="on" ) { rulevalue = "DON"; }
                                    // if ( rtype==="isy" && rulevalue==="off" ) { rulevalue = "DOF"; }

                                    if ( DEBUG11 ) {
                                        console.log( (ddbg()), "RULE debug: rtype= ", rtype, " rbid= ", rbid, " ifvalue: ", ifvalue, "rulevalue: ", rulevalue, " ruletileid: ", ruletileid, " parts: ", ruleparts );
                                    }

                                    // get the rule check if the requested subid is recognized
                                    // we handle numbers, dates, and times differently than strings
                                    if ( ifvalue!==false ) {

                                        let num1 = ifvalue;
                                        let num2 = rulevalue;
                                        let d1, d2;
                                        if ( rulesubid==="date") {
                                            d1 = new Date(ifvalue);
                                            d2 = new Date(rulevalue);
                                            num1 = d1.getTime();
                                            num2 = d2.getTime();
                                            if ( DEBUG11 ) {
                                                console.log( (ddbg()), "ruleop=", ruleop," ifvalue=",ifvalue," rulevalue= ",rulevalue," d1=",d1," d2=",d2," num1=",num1," num2=",num2);
                                            }
                                        } else if ( rulesubid==="time") {
                                            const today = new Date();
                                            d1 = new Date(today.toDateString() + " " + getTimeStr(ifvalue, rulevalue));
                                            d2 = new Date(today.toDateString() + " " + rulevalue);
                                            num1 = d1.getTime();
                                            num2 = d2.getTime();
                                            if ( DEBUG11 ) {
                                                console.log( (ddbg()), "ruleop=", ruleop," ifvalue=",ifvalue," rulevalue= ",rulevalue," d1=",d1," d2=",d2," num1=",num1," num2=",num2);
                                            }
                                        } else if ( !isNaN(parseFloat(ifvalue)) && !isNaN(parseFloat(rulevalue)) ) {
                                            num1 = parseFloat(ifvalue);
                                            num2 = parseFloat(rulevalue);
                                        }

                                        let ismatch = ( 
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
                            execRules(userid, rulecaller, thetype, 1, testcommands, pvalue, hubs, devices);
                        }
                    }
                }
            }
        });
    }
}

    // this executes the rules in the list starting with either 0 or 1
    // rules without if statements start at 0, if RULES start at 1
    // updated this to fix loop to use blocking values let instead of var to prevent async issues
    function execRules(userid, rulecaller, swtype, istart, testcommands, pvalue, hubs, devices) {
        // get a unique has for this rule to use for managing timers and gathering stats
        // we also use this to prevent dup rules within the same doAction cycle
        // var itemhash = pw_hash(item,'md5');

        if ( DEBUG11 ) {
            console.log( (ddbg()), "RULE commands: ", testcommands, " caller: ", rulecaller, " type: ", swtype);
        }

        // perform all of the commands if we meet the if test
        // const actpattern = /(\d+)\s*=\s*(\w+)\s*=\s*(\w+)\s*=?\s*(.*)/;
        for (let i= istart; i<testcommands.length; i++) {
            let autostr = testcommands[i].trim();

            // get the parts of the auto exec
            // the regex is an alternate approach but it is slower and not needed for this simple syntax
            // var autoexec = autostr.match(actpattern);
            // the unshift is just so I can keep the same index numbers as when using regex
            let autoexec = autostr.split("=");
            autoexec.unshift(" ");
            let len = autoexec.length;

            if ( len >= 3 ) {
                let rtileid = parseInt(autoexec[1].trim());
                let rsubid = autoexec[2].trim();
                let rvalue = len > 3 ? autoexec[3].trim() : "on" ;
                let delay = len > 4 ? autoexec[4] : false;
                if ( delay ) {
                    delay = parseInt( delay.trim() );
                    if ( isNaN(delay) || delay<=0 ) {
                        delay = false;
                    } else {
                        delay = delay * 1000;
                    }
                }
                let rswattr = len > 5 ? autoexec[5].trim() : "";
                if ( DEBUG11 ) {
                    console.log( (ddbg()), "RULE debug: exec step #", i, " rtileid: ", rtileid, " rsubid: ", rsubid, " rvalue: ", rvalue, " rswattr: ", rswattr, " delay: ", delay);
                }

                if ( rtileid && devices[rtileid] ) {
                    // var idxitems = ridx.split("|");
                    let rswtype = devices[rtileid].devicetype;
                    let rswid = devices[rtileid].deviceid;
                    let hubindex = devices[rtileid].hubid;
                    let rhint = devices[rtileid].hint;
                    let tileid = devices[rtileid].id;

                    let hub = hubs[hubindex];
                    let devpvalue = decodeURI2(devices[rtileid].pvalue);
                    // handle requests for parameters of the trigger tile ($) or destination tile (@)
                    // disable hub calls for this type of rule
                    let trigtype = rvalue.substr(0,1);
                    
                    // look for +n  or  -n  to modify rvalue if rvalue is a number
                    let kpos = rvalue.indexOf("+");
                    let kneg = rvalue.indexOf("-");
                    let rvaldelta = 0;
                    if ( kpos!==-1 && !isNaN(parseInt(rvalue.substr(kpos+1))) ) {
                        rvaldelta = parseInt(rvalue.substr(kpos+1).trim());
                        rvalue = rvalue.substr(0, kpos).trim();
                    }
                    else if ( kneg!==-1 && !isNaN(parseInt(rvalue.substr(kneg+1))) ) {
                        rvaldelta = 0 - parseInt(rvalue.substr(kneg+1).trim());
                        rvalue =  rvalue.substr(0, kneg).trim();
                    }

                    let trigsubid = "";
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
                        let curvalue = devpvalue[rsubid];
                        
                        if ( rswtype==="isy" ) {
                            if ( rvalue==="on" || (rvalue==="toggle" && curvalue==="DOF") ) { rvalue = "DON"; }
                            else if ( rvalue==="off" || (rvalue==="toggle" && curvalue==="DON") ) { rvalue = "DOF"; }
                        } else {
                            if ( rvalue==="toggle" && curvalue==="off" ) { rvalue = "on"; }
                            else if ( rvalue==="toggle" && curvalue==="on" ) { rvalue = "off"; }
                        }
                    } 

                    // make the rule hub call
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
                            rswattr= rswtype + " p_" + tileid + swval;
                        }

                        // make the hub call now or delayed
                        // if delayed we store the handle in our rules array so that
                        // should the same rule come along again we cancel this one first
                        // this way delay light on and off will stay on if trigger keeps happening
                        if ( DEBUG11 ) {
                            console.log("final rule step: userid: ", userid, "hubid: ", hub.id, "id=",  rswid, "type=", rswtype, "value=", rvalue, "attr=", rswattr, "subid=", rsubid, "rhint=", rhint);
                        }

                        if ( delay && delay > 0 ) {
                            setTimeout( function() {
                                try {
                                    callHub(userid, hub.id, tileid, rswid, rswtype, rvalue, rswattr, rsubid, rhint, true);
                                } catch (e) {
                                    console.warn( (ddbg()), "error calling hub from rule for userid: ", userid, " hub.id, rswid,rswtype,rvalue,rsattr,rsubid,rhint: ", hub.id, rswid, rswtype, rvalue, rswattr, rsubid, rhint, " error: ", e);
                                }
                            }, delay);
                        } else {
                            try {
                                callHub(userid, hub.id, tileid, rswid, rswtype, rvalue, rswattr, rsubid, rhint, true);
                            } catch (e) {
                                console.warn( (ddbg()), "error calling hub from rule for userid: ", userid, " hub.id, rswid,rswtype,rvalue,rsattr,rsubid,rhint: ", hub.id, rswid, rswtype, rvalue, rswattr, rsubid, rhint, " error: ", e);
                            }
                        }
                    }
                }


            }
        }

    }

function pushClient(userid, swid, swtype, subid, body) {
    // send the new results to all clients
    let entry = {};
    entry["userid"] = userid;
    entry["id"] = swid;
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

    // for websocket type pushes, only push to the specified client tied to this subid which is the client id in this case
    if ( swid === "websocket" ) {
        let c = clients[subid];
        if ( c && c.conn ) {
            if ( DEBUG17 ) {
                console.log( (ddbg()), "push: ", jsonshow(entry), " to client #"+c.id, " userid: ", c.userid, " at url: ", c.browserurl, " established: ", new Date(c.established).toLocaleString() );
            }
            c.conn.sendUTF(JSON.stringify(entry));
        }
    } else {
        // push to all clients that match this userid
        // if there are multiple users on the same hub this will only update the screen for the user tied to this event
        // however, the other users will get an event oo so they will be handled
        var userclients = Object.values(clients).filter(c => c.userid === userid);
        userclients.forEach( c => {
            if ( c && c.conn ) {
                if ( DEBUG17 ) {
                    console.log( (ddbg()), "push: ", jsonshow(entry), " to client #"+c.id, " userid: ", c.userid, " at url: ", c.browserurl, " established: ", new Date(c.established).toLocaleString() );
                }
                c.conn.sendUTF(JSON.stringify(entry));
            }
        });
    }
}

function callHub(userid, hubindex, tileid, swid, swtype, swval, swattr, subid, hint, inrule) {

    // first get the hub from the DB
    return mydb.getRow("hubs","*","userid = "+userid+" AND id = " + hubindex)
    .then(hub => {

        if ( !hub ) { return null; }

        var access_token = hub.hubaccess;
        var hubEndpt = hub.hubendpt;
        var result;

        var valint = parseInt(swval);
        if ( isNaN(valint) ) {
            valint = 50;
        }
        if ( DEBUG8 ) {
            console.log( (ddbg()), "callHub: access_token: ", access_token, " hubEndpt: ", hubEndpt, " swval: ", swval, " subid: ", subid, " swtype: ", swtype, " attr: ", swattr, " hub: ", hub, " tileid: ", tileid);
        }

        // reset count if clicked on regardless of hub type
        if ( subid==="count" || subid==="duration" || subid==="deltaT" ) {
            var newval = "0";
            if ( subid==="deltaT" ) {
                var d = new Date();
                newval = d.getTime();                            
            }

            // get counter from DB and update if it is there
            return mydb.getRow("devices", "*", "userid = " + userid + " AND hubid = "+hubindex+" AND deviceid = '"+swid+"'")
            .then(subdevice => {
                var pvalue = decodeURI2(subdevice.pvalue);
                pvalue[subid] = newval;
                subdevice.pvalue = encodeURI2(pvalue);
                return mydb.updateRow("devices", subdevice, "userid = " + userid + " AND id = "+subdevice.id, true)
                .then( () => {
                    var body = {};
                    body[subid] = newval;
                    getHubResponse(body, hub);
                    return pvalue;
                })
                .catch(reason => {
                    console.warn( (ddbg()), "***warning*** error retrieving devices for rule execution. reason: ", reason );
                });
            })
            .catch(reason => {
                console.warn( (ddbg()), "***warning*** error retrieving devices for rule execution. reason: ", reason );
            });
        }

        // this function calls the Groovy hub api
        // if a user accesstoken is provided then we use it without a bearer token
        if ( hub.hubtype==="Hubitat" ) {
            var host = hubEndpt + "/doaction";
            var header = {"Content-Type": "application/json"};
            var nvpreq = {"access_token": access_token, "swid": swid, "swattr": swattr, "swvalue": swval, "swtype": swtype};
            // var nvpreq = `access_token=${access_token}&swid=${swid}&swattr=${swattr}&swvalue=${swval}&swtype=${swtype}`;

            if ( subid && subid!=="none" ) { nvpreq["subid"] = subid; }
            var promise = new Promise( function(resolve, reject) {

                if ( DEBUG1 ) {
                    console.log((ddbg()), "callHub curl: ", jsonshow(nvpreq), " value type: ", (typeof swval));
                }
                curl_call(host, header, nvpreq, false, "POST") // , function(err, res, body) {
                .then(body => {
                    if ( DEBUG7 ) {
                        console.log( (ddbg()), "curl response: body: ", body);
                    }

                    if ( !body ) {
                        body = {};
                        body[subid] = swval;
                    }

                    // send info back to hub for quick feedback
                    getHubResponse(body, hub, resolve, reject);
                })
                .catch(reason => {
                    console.error( (ddbg()), reason);
                    reject(reason);
                });
            });
            return promise;

        // this module below is the equivalent of the HE groovy app
        // for ISY where the logic for handling actions is provided
        // compare this to the doAction function in HousePanel.groovy
        } else if ( hub.hubtype==="ISY" ) {

            access_token  = hub.hubaccess;
            hubEndpt = hub.hubendpt;
            var buff = Buffer.from(access_token);
            var base64 = buff.toString('base64');
            var isyheader = {"Authorization": "Basic " + base64};
            var cmd;
    
            // fix up isy devices
            result = mydb.getRow("devices", "*", "userid = " + userid + " AND hubid = "+hubindex+" AND deviceid = '"+swid+"'")
            .then(subdevice => {
                var devicetype = subdevice.devicetype;

                // first check for variables or programs
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
                        }
                        cmd = "/vars/set/1/" + varnum + "/" + intvar.toString();
                        curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                        .then(res => {
                            getNodeResponse(res);
                        })
                        .catch(reason => {
                            console.error((ddbg()), reason);
                        });
                        result = cmd;
                    } else {
                        result = "error - Int variable setting invalid: " + swval;
                    }

                } else if ( hint==="ISY_variable" && subid.startsWith("State_") ) {
                    // get the real subid that the arrows are pointing toward
                    var intvar = parseFloat(swval);
                    if ( !isNaN(intvar) ) {
                        if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
                            var varnum = subid.substr(6, subid.length-9);
                            var realsubid = subid.substr(0, subid.length-3);
                            intvar = subid.endsWith("-up") ? intvar + 1 : intvar - 1;
                        } else {
                            varnum = subid.substr(6);
                            realsubid = subid;
                        }
                        cmd = "/vars/set/2/" + varnum + "/" + intvar.toString();
                        curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                        .then(res => {
                            getNodeResponse(res);
                        })
                        .catch(reason => {
                            console.error((ddbg()), reason);
                        });
                        result = cmd;
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
                        curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                        .then(res => {
                            getNodeResponse(res);
                        })
                        .catch(reason => {
                            console.error((ddbg()), reason);
                        });
                        result = cmd;
                    } else {
                        result = "error - program: " + subid + " not supported for ISY programs";
                    } 

                } else if ( subid==="color" ) {
                    var color = swval;
                    var i1 = color.indexOf(",");
                    var i2 = color.indexOf(",", i1+1);
                    var i3 = color.indexOf(")");
                    var h = Math.round(parseInt(color.substring(4,i1)) * 100 / 360);
                    var s = parseInt(color.substring(i1+1,i2));
                    var v = parseInt(color.substring(i2+1,i3));

                    // set hue based on color
                    cmd = "/nodes/" + swid + "/cmd/SET_HUE/" + h.toString();
                    result = cmd;
                    curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                    .then(res => {
                        getNodeResponse(res);
                    })
                    .catch(reason => {
                        console.error((ddbg()), reason);
                    });

                    // set sat based on color
                    cmd = "/nodes/" + swid + "/cmd/SET_SAT/" + s.toString();
                    result = result + "\n" + cmd;
                    curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                    .then(res => {
                        getNodeResponse(res);
                    })
                    .catch(reason => {
                        console.error((ddbg()), reason);
                    });

                    // set level based on color
                    cmd = "/nodes/" + swid + "/cmd/SET_BRI/" + v.toString();
                    result = result + "\n" + cmd;
                    curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                    .then(res => {
                        getNodeResponse(res);
                    })
                    .catch(reason => {
                        console.error((ddbg()), reason);
                    });

                } else {

                    // get the commands for this device
                    var isycmd = mapIsycmd(subid, devicetype);

                    // if we map to state then translate the state specific value
                    if ( isycmd && isycmd === "ST" ) {
                        isycmd = mapIsycmd("ST:"+swval, devicetype);
                    }

                    // if this is a valid command then proceed
                    if ( isycmd ) {
                        cmd = "/nodes/" + swid + "/cmd/" + isycmd;

                        // if a numerical value is passed then send it with the command
                        if ( is_number(swval) ) {
                            cmd = cmd + "/" + swval.toString();
                        } else {
                            var isyparm = mapIsyparm(isycmd, swval);
                            if ( isyparm ) {
                                cmd = cmd + "/" + isyparm;;
                            }
                        } 
                        curl_call(hubEndpt + cmd, isyheader, false, false, "GET")
                        .then(res => {
                            getNodeResponse(res);
                        })
                        .catch(reason => {
                            console.error((ddbg()), reason);
                        });
                        result = cmd;
                    } else {
                        result = "error - invalid ISY command: " + subid;
                    }
                }
                return result;
            })
            .catch(reason => {
                console.error( (ddbg()), "callHub ISY - failed to get device: ", reason, "\n swid: ", swid, " subid: ", subid);
                result = "error - callHub ISY - failed to get device: " + swid;
            });
        };
        return result;
    })
    .catch(reason => {
        console.error( (ddbg()), "callHub - failed to get hubs: ", reason);
        return null;
    });

    // --------------------- end of callHub commands ------------------------------
    // supporting sub-functions are below
    // ----------------------------------------------------------------------------

    function getHubResponse(body, hub, resolve, reject) {
        // update all clients - this is actually not needed if your server is accessible to websocket updates
        // It is left here because my dev machine sometimes doesn't get websocket pushes
        // you can comment this if your server gets pushes reliably
        // leaving it here causes no harm other than processing the visual update twice
        var hubtype = hub.hubtype;
        var hubid = hub.hubid;
        var pvalue;
        try {
            if ( typeof body==="object" ) {
                pvalue = body;
            } else if ( typeof body==="string" && body.startsWith("No response") ) {
                throw "Hub offline"
            } else if ( typeof body==="string" ) {
                pvalue = JSON.parse(body);
            } else {
                throw "Invalid object.";
            }
            if ( !pvalue ) throw "Nothing returned";
        } catch (e) {
            console.error( (ddbg()), "hub call error: ", e, " returned body: ", body);
            if ( typeof reject === "function" ) {
                reject(e);
            }
            return;
        }

        // save to DB - we must read all the devices and merge the pvalue with existing
        if ( hubtype==="ISY" ) {
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
                    } else {
                        newpvalue = {};
                    }
                    for (var skey in pvalue) {
                        newpvalue[skey] = pvalue[skey];
                    }
                    var pvalstr = encodeURI2(newpvalue);
                    mydb.updateRow("devices", {id: device.id, pvalue: pvalstr}, "userid = "+userid+" AND id = "+device.id, true)
                    .then( res => {
                        if ( DEBUG2 ) {
                            console.log( (ddbg()), res);
                        }
                    })
                    .catch( reason => {
                        console.error( (ddbg()), "Error updating device in DB: ", reason);
                    });

                    pushClient(userid, swid, swtype, subid, newpvalue);
                    ndev++;    
                });
            }).catch(reason => { console.error( (ddbg()), "Error retrieving devices for rule execution: ", reason ); } );
        } else {

            if ( typeof resolve === "function" ) {
                resolve(pvalue);
            }
            if ( DEBUG1 ) {
                console.log( (ddbg()),"Hub call result: swid:", swid," swtype:", swtype," subid:", subid," pvalue:", pvalue);
            }

            // emulate hub pushing results if testing locally
            // this uses the object variant of the function to change multiple things at once
            // otherwise just push results to screen for fast visual response
            if ( EMULATEHUB ) {
                var devname = pvalue.name || "";
                var msg = {
                    msgtype: "update", 
                    hubid: hubid,
                    change_name: devname,
                    change_device: swid,
                    change_attribute: subid,
                    change_type: swtype,
                    change_value: pvalue
                };    
                processHubMessage(userid, msg, true);
            } else {
                pushClient(userid, swid, swtype, subid, pvalue);
            }

            return pvalue;
        }
     
    }

    // I don't need to use this because the ISY pushes a webSocket that I use
    // to do the same thing in the processIsyMessage function so we just report the result in a debug
    function getNodeResponse(body) {
        if ( DEBUG19 ) {
            console.log( (ddbg()),"getNodeResponse: ", body);
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
        console.warn( (ddbg()), "Error in translateAudio: ", jerr);
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

// recursively expand objects
function translateObjects(pvalue, levels) {
    var jtval;
    var nvalue = {};  // clone(pvalue);
    var moreobjects = false;
    for  (var tkey in pvalue) {
        var tval = pvalue[tkey];

        // attempt to convert string into object
        if ( typeof tval === "string" ) {
            try {
                var tvobj = JSON.parse(tval);
                tval = tvobj;
            } catch(err) { }
        }

        if ( typeof tval==="object" ) {
            for (var jtkey in tval ) {
                var jtval = tval[jtkey];
                var newkey = tkey + "_" + jtkey.toString();

                if ( typeof jtval === "string" ) {
                    try {
                        var jtvobj = JSON.parse(jtval);
                        jtval = jtvobj;
                    } catch(err) { }
                }
        
                if ( typeof jtval === "object" && levels > 1 ) {
                    moreobjects = true;
                    nvalue[newkey] = jtval;
                } else if ( typeof jtval !== "object" ) {
                    nvalue[newkey] = jtval.toString();
                }
            }
            // delete nvalue[tkey];
        } else {
            nvalue[tkey] = tval;
        }
    }
    if ( moreobjects ) {
        levels = levels - 1;
        return translateObjects(nvalue, levels);
    } else {
        return nvalue;
    }
}

function doAction(userid, hubindex, tileid, uid, swid, swtype, swval, swattr, subid, hint, command, linkval) {

    var msg = "success";
    if ( DEBUG7 ) {
        console.log( (ddbg()), "doaction: swid: ", swid, " tileid: ", tileid, " uid: ", uid, " swtype:", swtype, " swval: ", swval, " hubindex: ", hubindex,
                               " swattr: ", swattr, " subid: ", subid, " command: ", command, " linkval: ", linkval);
    }

    // first check for a command
    if ( linkval && command) {

        if  ( command==="POST" || command==="GET" ) {
            const hosturl = new URL(linkval);
            const posturl = hosturl.href;
            const parmobj = hosturl.searchParams;
            msg = curl_call(posturl, null, parmobj, false, command)
            .then( res => {
                return urlCallback(userid, swid, swtype, subid, res, command);
            })
            .catch( error => {
                console.error( (ddbg()), "error on " + command + " call: ", error, " userid=",userid, " swid=",swid, " swtype=",swtype, " subid=",subid);
            });

        } else if ( command==="PUT" ) {
            const hosturlp = new URL(linkval);
            const posturlp = hosturlp.href;
            const parmobjp = hosturlp.searchParams;
            msg = curl_call(posturlp, null, parmobjp, false, command)
            .then( res => {
                return res;
            })
            .catch( error => {
                console.error( (ddbg()), "error on PUT call: ", error);
            });

        } else if ( command==="TEXT" ) {
            msg = "warning - TEXT command is deprecated and will be removed in a future release. Please use POST, PUT, or GET instead to invoke a command.";

        } else if ( command==="LINK" ) {
            // processLink(linkval);
            msg = callHub(userid, hubindex, tileid, swid, swtype, swval, swattr, subid, hint, null, false);
        
        } else if ( command==="LIST" ) {
            msg = mydb.getRows("lists","ltime, lvalue",`userid = ${userid} AND deviceid = '${swid}' AND subid = '${subid}'`)
            .then(results => {
                return results;
            })
            .catch(reason => {
                console.error( (ddbg()), "LIST update error: ", reason);
                return "error - something went wrong with LIST command";
            });
        } else if ( command==="RULE" ) {
            if ( !GLB.dbinfo.enablerules ) {
                msg = "warning - rules are disabled.";
            } else {
                
                // I can simplify this because I now have the actual rule to run in the linkval variable
                // var configkey = "user_" + swid;
                msg = Promise.all( [
                    new Promise( function (resolve) { resolve({userid: userid, swtype: swtype, linkval: linkval}); }),
                    mydb.getRows("devices", "*", "userid = "+userid),  
                    mydb.getRows("hubs", "*", "userid = "+userid)
                ] )
                .then(results => {
                    var pvalue;
                    var devices = {};
                    var hubs = {};
                    const userid = results[0].userid;
                    const swtype = results[0].swtype;
                    const therule = results[0].linkval;
                    var dbdevices = results[1];
                    var dbhubs = results[2];

                    dbdevices.forEach(device => {
                        const luid = device.uid;
                        devices[luid] = device;
                        if ( device.deviceid === swid ) {
                            if ( !device.pvalue ) {
                                pvalue = {};
                            } else {
                                pvalue = decodeURI2(device.pvalue);
                            }
                        }
                    });
                    for ( const ahub in dbhubs ) {
                        const id = dbhubs[ahub].id;
                        hubs[id] = dbhubs[ahub];
                    }

                    const regsplit = /[,;]/;
                    var testcommands = therule.split(regsplit);
                    var istart = 0;
                    if ( testcommands[0].trim().startsWith("if") ) {
                        istart = 1;
                    }
                    execRules(userid, "callHub", swtype, istart, testcommands, pvalue, hubs, devices);
                    return testcommands;
                }).catch(reason => { 
                    console.error( (ddbg()), "Error executing rules: ", reason );
                });
            }
        }

    } else {
        if ( DEBUG1 ) {
            console.log( (ddbg()), `callHub: userid: ${userid}, hubindex: ${hubindex}, tileid: ${tileid}`, 
                                   `swid: ${swid}, swtype: ${swtype}, swval: ${swval}, swattr: ${swattr}, subid: ${subid}`, " type: ", (typeof swval) );
        }
        msg = callHub(userid, hubindex, tileid, swid, swtype, swval, swattr, subid, hint, null, false);
    }
    return msg;
}

function recurseKeys(pvalue, prefix, val) {
    if ( typeof val !== "object" ) {
        pvalue[prefix] = val;
        return pvalue;
    } else {
        for ( var key in val ) {
            var subval = val[key];
            var newkey = prefix ? prefix + "_" + key.toString() : key.toString();
            // var subresult = recurseKeys(newkey, subval);
            // result[newkey] = Object.assign(result, subresult);
            pvalue = recurseKeys(pvalue, newkey, subval);
        }
        return pvalue;
    }
}

function urlCallback(userid, swid, swtype, subid, body, command) {
    if ( DEBUG13 ) {
        console.log( (ddbg()), "URL callback returned: ", body );
    }
    var pvalue = {};
    pvalue[subid] = command + "::" + subid; 

    // if a string is returned then just push it as is
    if ( typeof body === "string" ) {
        pvalue[subid] = body;
    
    // if an object is returned then push each field separately
    // but keep track of whether our trigger subid was replaced
    } else if ( typeof body === "object" ) {
        try {
            let subidfound = false;
            for (var key in body) {
                subidfound = (key === subid) || subidfound;
            }
            // if our trigger subid was not found then set it to value field if there was one and if not
            // these values will only show up from the push if the fields are present
            // users can create the fields by creating custom TEXT fields in the tile to force them to show up
            if ( subidfound ) {
                pvalue = recurseKeys(pvalue, subid, body[subid]);
            } else if ( !subidfound && array_key_exists("value", body) ) {
                pvalue = recurseKeys(pvalue, "value", body["value"]);
            } else {
                pvalue = recurseKeys(pvalue, "", body);
            }

        } catch(e) {
            console.warn((ddbg()), "Error in urlCallback after invoking a custom ", command," command: ", e);
        }
    }

    // push new values to all clients to get an immediate onscreen response
    pushClient(userid, swid, swtype, subid, pvalue);
    return pvalue;
}

function setOrder(userid, swtype, swval) {
    var result;
    var promiseArray = [];

    if ( swtype==="rooms" ) {
        for ( var k in swval ) {
            var roomid = swval[k].id;
            var updval = { rorder: swval[k]["rorder"], rname: swval[k]["rname"] };
            var apr = mydb.updateRow("rooms", updval, "userid = " + userid + " AND id = "+roomid);
            promiseArray.push(apr);
        }
    } else if ( swtype==="things" ) {
        for ( var kk in swval ) {
            var thingid = swval[kk].id;
            var updval = {tileid: swval[kk].tileid, torder: swval[kk].torder};
            var arow = mydb.updateRow("things", updval, "userid = " + userid + " AND id = "+thingid);
            promiseArray.push(arow);
        }
    }

    if ( promiseArray.length ) {
        result = Promise.all(promiseArray)
        .then(results => {
            var num = results.length;
            return "success - updated order of " + num + " " + swtype + " for user: " + userid;
        })
        .catch( reason => {
            console.error( (ddbg()), "Error in reorder request: ", reason);
            return "error - something went wrong in reorder request for " + swtype;
        });
    } else {
        result = "Something went wrong with reorder request";
    }

    return result;
}

function setPosition(userid, swtype, thingid, swattr) {
    
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

    // thingid is all we need to get this tile
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
            return mydb.updateRow("things", thing, "userid = " + userid + " AND id = " + id)
            .then(result => {
                if ( result ) {
                    var tileloc = {top: top, left: left, "z-index": zindex, position: postype, thingid: thingid};
                    pushClient(userid, "setposition", swtype, "", tileloc);
                    if ( DEBUG6 ) {
                        console.log( (ddbg()), "moved tile: ", thingid, " to a new position: ", tileloc);
                    }
                    return tileloc;
                } else {
                    console.error( (ddbg()), "error - failed to update position for tile: ", thingid, " to permanent position: ", top, left, zindex, postype);
                    return "error - failed up to update position for tile: " + thingid;
                }
            })
            .catch( reason => {
                console.error( (ddbg()), "error updating position: ", reason);
                return "error - something went wrong updating position for tile: " + thingid;
            });
        } else {
            console.warn( (ddbg()), "error - could not find tile: ", thingid, " to move to position: ", top, left, zindex, postype);
            return "error - could not find tile: " + thingid;
        }
    }).catch(reason => {
        console.error( (ddbg()), "error in setPosition: ", reason);
        return "error - something went wrong in setPosition for tile: " + thingid;
    });

    return pr;
}

// userid, swid, swtype, rname, hubid, hubindex, roomid, startpos
function addThing(userid, pname, bid, thingtype, panel, hubindex, roomid, pos) {

    // first get the max order number of the tiles in this room
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
            console.warn( (ddbg()), "Error attempting to add a thing. Reason: ", reason );
            return [configoptions, 1];
        });
    })
    .then(arr => {

        var configoptions = arr[0];
        var maxtorder = arr[1];
        // let's retrieve the thing from the database
        var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
        var fields = "devices.id as devices_id, devices.uid as devices_uid, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubtype as hubs_hubtype";
        // return mydb.getRow("devices", fields, "devices.userid = "+userid+" AND hubs.hubid='"+hubid+"' AND devices.deviceid='"+bid+"' AND devices.devicetype='"+thingtype+"'", joinstr)
        return mydb.getRow("devices", fields, "devices.userid = "+userid+" AND hubs.id='"+hubindex+"' AND devices.deviceid='"+bid+"' AND devices.devicetype='"+thingtype+"'", joinstr)
        .then(row => {
            if ( row && is_object(row) ) {

                var device = row;
                var tileid = device["devices_id"];
                var uid = device["devices_uid"];
                var hint = device["devices_hint"];
                var refresh = device["devices_refresh"];
                var hubid = device["hubs_hubid"];
                var hubtype = device["hubs_hubtype"];
                var pvalue = decodeURI2(device["devices_pvalue"]);
                hubindex = device["hubs_id"];
                var result;
                if ( pvalue ) {                
                    // construct the thing to add to the things list
                    var athing = {userid: userid, roomid: roomid, tileid: tileid, posy: pos.top, posx: pos.left, zindex: pos["z-index"], torder: maxtorder, customname: ""};
                    result = mydb.addRow("things", athing)
                    .then(row => {
                        if ( row ) {

                            // obtain the new id of the added thing
                            var thingid = row.getAutoIncrementValue();

                            // now make the visual tile and return it as a promised value
                            // construct the old things element equivalent but add the unique thingid and roomid fields
                            var thesensor = {id: bid, thingid: thingid, uid: uid, roomid: roomid, type: thingtype, hubnum: hubid, hubindex: hubindex,
                                            hubtype: hubtype, hint: hint, refresh: refresh, value: pvalue};
                            var thing = makeThing(userid, pname, configoptions, tileid, thesensor, panel, pos.top, pos.left, pos["z-index"], "", false, null);
                            if ( DEBUG6 ) {
                                console.log((ddbg()), "added tile #",tileid," (thingid = ",thingid,") of type: ",thingtype," to page: ",panel,
                                                      " deviceid: ", bid, " hubid: ", hubid, " hubindex: ", hubindex);
                            }
                            return thing;
                        } else {
                            var errmsg = "error - could not create a new device of type " + thingtype + " on page " + panel;
                            console.error((ddbg()), "error attempting to addThing: ", errmsg);
                            return errmsg;
                        }
                    })
                    .catch(reason => {
                        console.error( (ddbg()), "error attempting to addThing: ", reason);
                        return "error - something went wrong attempting to add a thing of type " + thingtype + " on page " + panel;
                    });
        
                } else {
                    result = "error - nothing returned for device in parse for type + " + thingtype + " on page " + panel;
                }
                return result;
            } else {
                return "error - could not find device of type " + thingtype + " in your list of authenticated devices";
            }
        }).catch(reason => {
            console.error( (ddbg()), "error attempting to addThing: ", reason);
            return "error - something went wrong in attempting to add a thing of type " + thingtype;
        });

    });
   
    return promiseResult;
}

// this only needs thingid to remove but other parameters are logged
function delThing(userid, bid, thingtype, panel, tileid, uid, thingid) {
    
    return mydb.deleteRow("things","userid = "+userid+" AND id="+thingid)
    .then(result => {
        var msg;
        if ( result ) {
            msg = "removed tile #" + uid + " tileid: " + tileid + " deviceid: " + bid + " of type: " + thingtype + " from room: " + panel;
            if ( DEBUG6 ) {
                console.log( (ddbg()), msg);
            }
        } else {
            msg = "error - could not remove tile #" + uid + " tileid: " + tileid + " deviceid: " + bid + " of type: " + thingtype + " from room: " + panel;
            console.warn( (ddbg()), msg);
        }
        return msg;
    })
    .catch(reason => {
        console.error( (ddbg()), "delThing - ", reason);
        return "error - " + reason.toString();
    });
}

function delPage(userid, roomid, roomname, panel) {

    return Promise.all([
        mydb.deleteRow("rooms","userid = "+userid+" AND id="+roomid),
        mydb.deleteRow("things","userid = "+userid+" AND roomid="+roomid)
    ])
    .then(result => {
        var msg;
        var numdelrooms = result[0].getAffectedItemsCount();
        if ( numdelrooms ) {
            msg = "removed room: " + roomname + " (" + roomid + ") from panel: " + panel;
            var numdeltiles = result[1].getAffectedItemsCount();
            if ( numdeltiles ) {
                msg+= " and removed " + numdeltiles + " tiles that were in that room.";
            }
        } else {
            msg = "error - failed to remove room: " + roomname + " (" + roomid + ") from panel: " + pamel;
            console.warn( (ddbg()), "delPage - ", msg );
        }
        return msg;
    })
    .catch(reason => {
        console.error( (ddbg()), "delPage - ", reason);
        return "error - something went wrong trying to remove a";
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
            if ( DEBUG6 ) {
                console.log( (ddbg()), "New room created: ", newroom, " but no clock was added");
            }
            return newroom;
        });
    }).catch(reason => {
        console.error( (ddbg()), "error adding room: ", newroom, " reason: ", reason);
        return "error adding a room. Reason: " + reason;
    });

}

function getInfoPage(user, configoptions, hubs, req) {
 
    // get the port number
    // var currentport = getCookie(req, "pname");
    // if ( typeof currentport!=="string" || currentport.substring(1,2)!==":" ) {
    //     currentport = "Unknown";
    // } else {
    //     currentport = GLB.webSocketServerPort + parseInt(currentport.substring(0,1));
    //     currentport = currentport.toString();
    // }
    var currentport = GLB.webSocketServerPort;

    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var usertype = parseInt(user["users_usertype"]);
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    var hpcode = user["users_hpcode"];
    var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
    var fields = "devices.id as devices_id, devices.uid as devices_uid, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
    "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
    "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
    "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubtype as hubs_hubtype, hubs.hubname as hubs_hubname, " +
    "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
    "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
    
    return mydb.getRows("devices", fields, "devices.userid = " + userid + " GROUP BY devices.deviceid", joinstr, "hubs.id, devices.name")
    .then(devices => {
        return getinfocontents(userid, pname, currentport, configoptions, hubs, devices);
    }).catch(reason => {
        const msg = reason ? reason.toString() :"something went wrong trying to get your information page";
        console.error( (ddbg()), "getInfoPage - ", msg);
        return msg;
    });

    function getinfocontents(userid, pname, currentport, configoptions, hubs, devices) {
        
        var $tc = "";
        $tc += getHeader(userid, null, skin, true);
        $tc += "<h3>" + GLB.APPNAME + " Information Display</h3>";

        if ( GLB.dbinfo.donate===true ) {
            $tc += "<div class=\"donate\">";
            $tc += '<h4>Donations appreciated for HousePanel support and continued improvement, but not required to proceed.</h4> \
                <br /><div><form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
                <input type="hidden" name="cmd" value="_s-xclick"> \
                <input type="hidden" name="hosted_button_id" value="XS7MHW7XPYJA4"> \
                <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
                <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
                </form></div>';
            $tc += "</div>";
        }

        var numhubs = 0;
        hubs.forEach (function(hub) {
            if ( hub && hub.hubid !== "-1" ) {
                numhubs++;
            }
        });

        $tc += "<form>";
        $tc += hidden("userid", userid, "userid");
        $tc += hidden("pname", pname);
        $tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        $tc += hidden("emailid", useremail, "emailid");
        $tc += hidden("skinid", skin, "skinid");
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("pagename", "info");
        $tc += hidden("hpcode", hpcode, "hpcode");
        $tc += hidden("apiSecret", GLB.apiSecret);
        var configs = {};
        for (var i in configoptions) {
            var key = configoptions[i].configkey;
            if ( !key.startsWith("user_") ) {
                configs[key] = configoptions[i].configval;
            }
        }
        // $tc += hidden("configsid", JSON.stringify(configs), "configsid");
        $tc += "</form>";
        $tc += "<div class=\"infosum\">";
        $tc += "<div class='bold'>Site url = " + GLB.returnURL + "</div>";
        $tc += "<div class='bold'>User ID: " + userid + "</div>";
        $tc += "<div class='bold'>Username: " + uname + "</div>";
        $tc += "<div class='bold'>User email: " + useremail + "</div>";
        // $tc += "<div class='bold'>Displaying panel: " + pname + "</div>";
        // $tc += "<div class='bold'>WebSocket port: " + currentport + "</div>";
        // $tc += "<div class='bold'>Skin folder = " + skin + "</div>";
        $tc += "<div class='bold'>" + numhubs + " Hubs authorized</div><br>";
        
        var num = 0;
        hubs.forEach (function(hub) {
            if ( hub.hubid !== "-1" ) {
                num++;
                $tc += "<hr />";
                $tc += "<div class='bold'>Hub ID #" + num + "</div>";
                for ( var hubattr in hub ) {
                    if ( hub[hubattr]!=="" ) {
                        $tc += "<div class='wrap'>" + hubattr + " = " + hub[hubattr] + "</div>";
                    }
                }
            }
        });

        $tc += "</div>";

        let userclients = Object.values(clients).filter( c => c.userid === userid );
        var str = "<div class='infosum'><div class='bold'>Client Connection Details</div>"
        const ctext = userclients.length === 1 ? "client" : "clients";
        str += "<div class='bold'>Currently connected to " + userclients.length + " " + ctext + "</div>";
        str += "<hr>";
        userclients.forEach( c => {
            const cpos = c.wsport.lastIndexOf(":");
            let port = cpos === -1 ? c.wsport : c.wsport.substring(cpos+1); 
            str = str + `<div class="clientinfo" id="${c.id}">Client ID: ${c.id} host: ${c.browserurl} port: ${port}</div>`;
        });
        str = str + "</div>";

        $tc +=  str;

        // Section 1 - show dev history
        $tc += "<button id=\"listhistory\" class=\"bluebutton showhistory\">Show Dev Log</button>";
        $tc += "<div id=\"showhistory\" class=\"infopage hidden\">";
        $tc += "<pre>" + GLB.devhistory + "</pre>";
        $tc += "</div>";

        // Section 2 - show customizations
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
            $tc += "<br><button id=\"listcustom\" class=\"bluebutton showcustom\">Show Customizations</button>";
            $tc += "<div id=\"showcustom\" class=\"infopage hidden\">";
            $tc += "<table class=\"showid\">";
            $tc += "<thead><tr>" + 
                "<th class=\"infotype\">Type</th>" + 
                "<th class=\"thingid\">Custom ID</th>" + 
                "<th class=\"thingarr\">Custom Value</th>" +
                "<th class=\"infonum\">Field</th>" +
                "<th class=\"infobtns rightside\">Action</th>" +
            "</tr></thead>";

            var trid = 0;
            customList.forEach(function(item) {
                trid++;
                $tc += `<tr id="trid_${trid}">` + 
                    "<td class=\"infotype\">" + item[0] + "</td>" +
                    "<td class=\"thingid\">" + item[1] + "</td>" +
                    "<td class=\"thingarr\">" + item[2] + "</td>" +
                    "<td class=\"infonum\">" + item[3] + "</td>" +
                    `<td class="infobtns rightside"><button class="editbutton" trid="${trid}">Edit</button>` +
                    `<button class="delbutton" trid="${trid}">Del</button></td>` +
                "</tr>";
            });
            $tc += "</table></div>";
        }

        // section 3 - show authorized devices
        $tc += "<br><button id=\"listthing\" class=\"bluebutton showhistory\">Authorized Devices</button>";
        $tc += "<div id=\"showthing\" class=\"infopage\">";
        $tc += "<table class=\"showid\">";
        $tc += "<thead><tr>" +
                "<th class=\"thingname\">Dev Name</th>" + 
                "<th class=\"infotype\">Dev Type</th>" + 
                "<th class=\"hubid\">Hub</th>" +
                "<th class=\"infonum\">DB id</th>" +
                "<th class=\"infonum\">GUI id</th>" +
                "<th class=\"infoid\">Dev id</th>" +
                "<th class=\"thingarr rightside\">Value</th>" + 
               "</tr></thead>";

        // don't need to sort here because we did so in the call to the main page
        // var devices = sortedSensors("hubnum", "name", "type");
        for (var i in devices) {
            var device = devices[i];
            var pvalue = decodeURI2(device["devices_pvalue"]);
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
            var hubid = device["hubs_hubid"];
            if ( hubid === -1 || hubid === "-1" ) {
                var hubstr = "None<br><span class=\"typeopt\"> (" + hubid + ": None)</span>";
            } else {
                var hubType = device["hubs_hubtype"] || "None";
                var hubName = device["hubs_hubname"] || "None";
                hubstr = hubName + "<br><span class=\"typeopt\"> (" + hubid + ": " + hubType + ")</span>";
            }
            
            $tc += "<tr>" + 
                    "<td class=\"thingname\">" + device["devices_name"] + "</td>" +
                    "<td class=\"infotype\">" + device["devices_devicetype"] + "</td>" +
                    "<td class=\"hubid\">" + hubstr +  "</td>" +
                    "<td class=\"infonum\">" + device["devices_id"] + "</td>" +
                    "<td class=\"infonum\">" + device["devices_uid"] + "</td>" +
                    "<td class=\"infoid\">" + device["devices_deviceid"] + "</td>" +
                    "<td class=\"thingarr rightside\">" + value + "</td>" +
                "</tr>";
        }
        $tc += "</table></div>";


        $tc += "<button class=\"bluebutton infobutton fixbottom\">Return to HousePanel</button>";

        $tc += getFooter();
        return $tc;
    }
}

function hubFilters(userid, hubpick, hubs, useroptions, pagename, ncols, isform) {

    var thingtypes = getTypes();
    var $tc = "";
    if ( isform ) {
        $tc += "<form id=\"filteroptions\" class=\"options\" name=\"filteroptions\" action=\"#\">";
        $tc += hidden("userid", userid, "userid");
        $tc += hidden("pagename", pagename);
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("apiSecret", GLB.apiSecret);
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
    $tc+= "<br><h3>Select Things to Display:</h2>";
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

        var device = sensors[i];
        var bid = device["devices_deviceid"];
        var thingtype = device["devices_devicetype"];
        var thingname = device["devices_name"] || "";
        var hubId = device["hubs_hubid"];
        var hubindex = device["devices_hubid"];
        var id = device["devices_id"];
        var uid = device["devices_uid"];
        var cat = "cat-" + id.toString();

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

        $tc += "<div id=\"" + cat + "\" bid=\"" + bid + "\" uid=\"" + uid + "\" type=\"" + thingtype + "\" hubid=\"" + hubId + "\" hubindex=\"" + hubindex + "\" ";
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

function getParamsPage(user, configoptions, req) {

    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var hpcode = user["users_hpcode"];
    var pname = user["panels_pname"];
    var panelid = user["panels_id"];
    var panelid = user["panels_id"];
    var hostname = req.headers.host;
    var webSocketUrl = getSocketUrl(hostname);
    var fast_timer = getConfigItem(configoptions, "fast_timer") || "0";
    var slow_timer = getConfigItem(configoptions, "slow_timer") || "0";
    var $kioskoptions = getConfigItem(configoptions, "kiosk") || "false";
    var blackout = getConfigItem(configoptions, "blackout") || "false";
    var $ruleoptions = getConfigItem(configoptions, "rules") || "true";
    var phototimer = parseInt(getConfigItem(configoptions, "phototimer"));
    if ( isNaN(phototimer) ) { phototimer = 0; }
    var fcastcity = getConfigItem(configoptions, "fcastcity") || "san-carlos";
    var fcastregion = getConfigItem(configoptions, "fcastregion") || "San Carlos";
    var fcastcode = getConfigItem(configoptions, "fcastcode") || "37d51n122d26";
    var accucity = getConfigItem(configoptions, "accucity") || "sa-carlos";
    var accuregion = getConfigItem(configoptions, "accuregion") || "us";
    var accucode = getConfigItem(configoptions, "accucode") || "337226";
    var specialtiles = getConfigItem(configoptions, "specialtiles");

    var $tc = "";
    $tc += getHeader(userid, null, null, true);

    if ( GLB.dbinfo.donate===true ) {
        $tc += "<div class=\"donate\">";
        $tc += '<h4>Donations appreciated for HousePanel support and continued improvement, but not required to proceed.</h4> \
            <br /><div><form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"> \
            <input type="hidden" name="cmd" value="_s-xclick"> \
            <input type="hidden" name="hosted_button_id" value="XS7MHW7XPYJA4"> \
            <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
            <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
            </form></div>';
        $tc += "</div>";
    }

    // this is the start of the options page
    $tc += "<button class=\"bluebutton infobutton fixbottom\">Cancel and Return to HousePanel</button>";
    $tc += "<h3>" + GLB.APPNAME + " Options</h3>";
    // $tc += "<h3>Email: " + useremail + "</h3>";
    $tc += "<br><button id=\"delUser\" class=\"smallbutton\">Delete User</button>";

    $tc += "<form id=\"paramspage\" class=\"options\" name=\"paramspage\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";
    $tc += "<div class=\"options\">";

    $tc += hidden("pagename", "options");
    $tc += hidden("returnURL", GLB.returnURL);
    $tc += hidden("webSocketUrl", webSocketUrl);
    $tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
    $tc += hidden("webDisplayPort", GLB.port);
    $tc += hidden("userid", userid, "userid");
    $tc += hidden("uname", uname, "unameid");
    $tc += hidden("emailid", useremail, "emailid");
    $tc += hidden("panelid", panelid, "panelid");
    $tc += hidden("pname", pname);
    $tc += hidden("hpcode", hpcode, "hpcode");
    $tc += hidden("apiSecret", GLB.apiSecret);

    $tc += hidden("fast_timer", "0");
    $tc += hidden("slow_timer", "0");

    // // users can update their username here
    $tc += "<div class=\"filteroption\">";
    $tc += " Username: ";
    $tc += "<input id=\"newUsername\" class=\"optioninp\" name=\"newUsername\" size=\"20\" type=\"text\" value=\"" + uname + "\"/>"; 
    $tc += "<span class='typeopt'>(Email: " + useremail + ")</span>";
    $tc += "</div>";

    $tc += "<div class=\"filteroption\">";
    $tc += "<div><label for=\"kioskid\" class=\"optioncbox\">Kiosk Mode? </label>";    
    var $kstr = ($kioskoptions===true || $kioskoptions==="true") ? " checked" : "";
    $tc+= "<input class=\"optionchk\" id=\"kioskid\" type=\"checkbox\" name=\"kiosk\"  value=\"" + $kioskoptions + "\"" + $kstr + "/></div>";
    $tc += "<div><label for=\"ruleid\" class=\"optioncbox\">Enable Rules? </label>";
    $kstr = ($ruleoptions===true || $ruleoptions==="true") ? " checked" : "";
    $tc += "<input class=\"optionchk\" id=\"ruleid\" type=\"checkbox\" name=\"rules\"  value=\"" + $ruleoptions + "\"" + $kstr + "/></div>";
    $tc += "<div><label for=\"clrblackid\" class=\"optioncbox\">Night & Away Blackout? </label>";    
    $kstr = (blackout===true || blackout==="true") ? " checked" : "";
    $tc+= "<input class=\"optionchk\" id=\"clrblackid\" type=\"checkbox\" name=\"blackout\"  value=\"" + blackout + "\"" + $kstr + "/></div>";
    $tc+= "<div><label for=\"photoid\" class=\"optioninp\">Photo timer (sec): </label>";
    $tc+= "<input class=\"optioninp\" id=\"photoid\" name=\"phototimer\" type=\"number\"  min='0' max='300' step='5' value=\"" + phototimer + "\" /></div>";
    $tc += "</div>";

    $tc += "<div class=\"filteroption\">";
    $tc += "Weather City Selection Option 1:<br>Specify WeatherWidget.io or AccuWeather city or both<br/><br/>";
    $tc += "<table>";
    $tc += "<tr>";
    $tc += "<td style=\"width:15%; text-align:right\"><label for=\"fcastcityid\" class=\"kioskoption\">WeatherWidget City: </label>";
    $tc += "<br><span class='typeopt'>(see: <a href=\"https://weatherwidget.io\" target=\"_blank\">WeatherWidget.io</a>)</span></td>";
    $tc += "<td style=\"width:20%\"><input id=\"fcastcityid\" size=\"30\" type=\"text\" name=\"fcastcity\"  value=\"" + fcastcity + "\" /></td>";
    $tc += "<td style=\"width:20%; text-align:right\"><label for=\"fcastregionid\" class=\"kioskoption\">Forcast Region: </label></td>";
    $tc += "<td style=\"width:15%\"><input id=\"fcastregionid\" size=\"20\" type=\"text\" name=\"fcastregion\"  value=\"" + fcastregion + "\"/></td>";
    $tc += "<td style=\"width:15%; text-align:right\"><label for=\"fcastcodeid\" class=\"kioskoption\">Forecast Code: </label></td>";
    $tc += "<td style=\"width:15%\"><input id=\"fcastcodeid\" size=\"20\" type=\"text\" name=\"fcastcode\"  value=\"" + fcastcode + "\"/></td>";
    $tc += "</tr>";

    $tc += "<tr>";
    $tc += "<td style=\"width:15%; text-align:right\"><label for=\"accucityid\" class=\"kioskoption\">Accuweather City: </label>";
    $tc += "<br><span class='typeopt'>(see: <a href=\"https://www.accuweather.com\" target=\"_blank\">AccuWeather.com</a>)</span></td>";
    $tc += "<td style=\"width:20%\"><input id=\"accucityid\" size=\"30\" type=\"text\" name=\"accucity\"  value=\"" + accucity + "\" /></td>";
    $tc += "<td style=\"width:20%; text-align:right\"><label for=\"accuregionid\" class=\"kioskoption\">Accuweather Region: </label></td>";
    $tc += "<td style=\"width:15%\"><input id=\"accuregionid\" size=\"20\" type=\"text\" name=\"accuregion\"  value=\"" + accuregion + "\"/></td>";
    $tc += "<td style=\"width:15%; text-align:right\"><label for=\"accucodeid\" class=\"kioskoption\">AccuWeather Code: </label></td>";
    $tc += "<td style=\"width:15%\"><input id=\"accucodeid\" size=\"20\" type=\"text\" name=\"accucode\"  value=\"" + accucode + "\"/></td>";
    $tc += "</tr></table></div>";

    $tc += `<br/><div class="filteroption">
            Weather City Selection Option 2:<br>Paste entire code block of your weather widget of choice into any Frame tile
            <br><span class='typeopt'>(Frame number of 1 or 2 will replace the frame file generated from the above settings)</span><br><br>   
            <table><tr>
            <td>
                <textarea id="widgetcodeid" name="widgetcode" rows="6" cols="80" placeholder="Paste your weather widget code here..."></textarea>
            </td>
            <td>
                <label for="widgetcodepanelid" class="optioninp">Which Frame: </label>
                <input id="widgetcodepanelid" name="widgetcodepanelid" type="number" min="0" max="20" step="1" value="0" />
            </td>
            </tr></table>
            </div>`;
            
            
    $tc += "<div class=\"filteroption\">";
    $tc += "Specify number of special tiles:<br/>";
    for (var $stype in specialtiles) {
        var $customcnt = parseInt(specialtiles[$stype]);
        if ( isNaN($customcnt) ) { $customcnt = 0; }
        var $stypeid = "cnt_" + $stype;
        $tc+= "<div><label for=\"$stypeid\" class=\"optioninp\"> " + $stype +  " tiles: </label>";
        $tc+= "<input class=\"optionnuminp\" id=\"" + $stypeid + "\" name=\"" + $stypeid + "\" size=\"10\" type=\"number\"  min='1' max='20' step='1' value=\"" + $customcnt + "\" /></div>";
    }
    $tc+= "</div>";

    // end of the options page
    $tc+= "</div>";

    $tc +='<div id="paramsSave" class="formbutton">Save</div>';
    $tc +='<div id="paramsReset" class="formbutton">Reset</div>';
    $tc +='<div id="paramsCancel" class="formbutton">Cancel</div><br>';
    $tc+= "</div>";
    $tc+= "</form>";


    $tc+= getFooter();
    return $tc;
}

function getDevicesPage(user, configoptions, hubs, req) {
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    var hpcode = user["users_hpcode"];
    var pname = user["panels_pname"];
    var panelid = user["panels_id"];
    var hostname = req.headers.host;
    var hubpick = getCookie(req, "defaultHub");
    var webSocketUrl = getSocketUrl(hostname);
    var useroptions = getConfigItem(configoptions, "usroptions");

    var joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
    var fields1 = "devices.id as devices_id, devices.uid as devices_uid, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubtype as hubs_hubtype, hubs.hubname as hubs_hubname, " +
        "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
        "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
    var joinstr1 = mydb.getJoinStr("things","tileid","devices","id");
    var joinstr2 = mydb.getJoinStr("things","roomid","rooms","id");
    var fields2 = "things.id as things_id, things.userid as things_userid, things.roomid as things_roomid, " +
        "things.tileid as things_tileid, things.customname as things_customname, devices.name as devices_name, " +
        "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";        

    // get all the things in the various rooms as we do on the main page
    // converted this to use the all promise feature
    return Promise.all([
        mydb.getRows("rooms","*", "userid = "+userid+" AND panelid = "+panelid),
        mydb.getRows("devices",fields1, "devices.userid = "+userid + " GROUP BY devices.deviceid", joinstr,"hubs.id"),
        mydb.getRows("things", fields2, "things.userid = "+userid+" AND rooms.panelid = " + panelid, [joinstr1, joinstr2], "devices.name"),
        mydb.getRows("panels","*", "userid = "+userid)
    ])
    .then(resarray => {
        var rooms = resarray[0];
        var devices = resarray[1];
        var things = resarray[2];
        if ( rooms && devices && things ) {
            return renderDeviceRoomSection(hubpick, rooms, devices, things, hubs, useroptions);
        } else {
            return "error - problem with reading your existing tiles";
        }
    })
    .catch(reason => {
        console.error( (ddbg()), "Something went wrong in getDevicesPage: ", reason);
        return ;
    });

    function renderDeviceRoomSection(hubpick, rooms, devices, things, hubs, useroptions) {

        var $tc = "";
        $tc += getHeader(userid, null, null, true);

        // $tc += "<button class=\"bluebutton infobutton fixbottom\">Cancel and Return to HousePanel</button>";
        $tc += "<h3>" + GLB.APPNAME + " Edit Devices</h3>";
        
        $tc += "<form id=\"deveditpage\" class=\"options\" name=\"deveditpage\" action=\"" + GLB.returnURL + "\"  method=\"POST\">";

        $tc += hidden("pagename", "editdevices");
        $tc += hidden("returnURL", GLB.returnURL);
        $tc += hidden("webSocketUrl", webSocketUrl);
        $tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        $tc += hidden("webDisplayPort", GLB.port);
        $tc += hidden("userid", userid, "userid");
        $tc += hidden("uname", uname, "unameid");
        $tc += hidden("emailid", useremail, "emailid");
        $tc += hidden("panelid", panelid, "panelid");
        $tc += hidden("pname", pname);
        $tc += hidden("hpcode", hpcode, "hpcode");
        $tc += hidden("apiSecret", GLB.apiSecret);
        $tc += hidden("hubpick", hubpick);

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

            var $odd = $evenodd = false;
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
            for (var i in rooms) {
                var roomname = rooms[i].rname;
                var roomid = rooms[i].id;
                            
                // now check for whether this thing is in this room
                $tc+= "<td>";
                
                var ischecked = false;
                for (var i in things) {
                    var thing = things[i];
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
        $tc +='<div id="devSave" class="formbutton">Save</div>';
        $tc +='<div id="devReset" class="formbutton">Reset</div>';
        $tc +='<div id="devCancel" class="formbutton">Cancel</div><br>';
        $tc+= "</div>";
        $tc+= "</form>";
        $tc += getFooter();

        return $tc;
    }

}

// process user options page
function processParams(userid, panelid, optarray) {

    // first get the configurations and things and then call routine to update them
    userid = parseInt(userid);
    panelid = parseInt(panelid);
    if ( DEBUG4 ) {
        console.log( (ddbg()), "userid: ", userid, " panelid: ", panelid);
        console.log( (ddbg()), "optarray: ", jsonshow(optarray) );
    }

    return Promise.all([
        mydb.getRow("hubs","*","userid = "+userid+" AND hubid = '-1'"),
        mydb.getRows("devices","*","userid = "+userid+" AND hint='special'"),
        mydb.getRows("configs","*","userid = "+userid+" AND configtype=0")
    ])
    .then(results => {
        var hubzero = results[0];
        var specials = results[1];
        var configs = results[2];
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
        return doProcessOptions(optarray, configoptions, hubzero, specials);
    })
    .catch(reason => {
        console.error( (ddbg()), "error processing user parameter options: ", reason);
        return reason;
    });

    function doProcessOptions(optarray, configoptions, hubzero, specials  ) {
        var specialtiles = configoptions["specialtiles"];

        configoptions["kiosk"] = "false";
        configoptions["rules"] = "false";
        configoptions["blackout"] = "false";
        var newName = "";
        var accucity = "";
        var accuregion = "";
        var accucode = "";
        var fcastcity = "";
        var fcastregion = "";
        var fcastcode = "";
        var weatherwidget = "";
        var frameid = 0;

        for (var key in optarray) {
            var val = optarray[key];
            if ( typeof val === "string" ) val = val.trim();

            //skip the returns from the submit button and the flag
            if (key==="options" || key==="editdevices" || key==="api" || key==="useajax"  || key==="userid" || key==="panelid" || key==="webSocketUrl" || key==="returnURL" || key==="hpcode" || key==="apiSecret" ||
                key==="webSocketServerPort" || key==="webDisplayPort" || key==="pagename" || key==="pathname" || key==="userpanel" || key==="pname" || key==="uname" || key==="panelPw2" ) {
                continue;

            } else if ( key==="newUsername" ) {
                // the \D ensures we start with a non-numerica character
                // and the \S ensures we have at least 2 non-white space characters following
                if ( val && val.match(/^\D\S{2,}$/) ) {
                    newName = val;
                    mydb.updateRow("users",{uname: newName},"id = " + userid);
                }
            } else if ( key==="kiosk") {
                configoptions["kiosk"] = "true";
            } else if ( key==="rules") {
                configoptions["rules"] = "true";
            } else if ( key==="blackout") {
                configoptions["blackout"] = "true";
            } else if ( key==="phototimer" ) {
                configoptions["phototimer"] = val;
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
            } else if ( key==="widgetcode" ) {
                weatherwidget = val;
            } else if ( key==="widgetcodepanelid" ) {
                frameid = parseInt(val);
            
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
            }
        }
        
        // handle the weather codes - write into this users folder
        if ( weatherwidget && weatherwidget.length > 4 && frameid > 0 ) {
            writeWeatherWidget(userid, weatherwidget, frameid);
        } else {
            writeForecastWidget(userid, fcastcity, fcastregion, fcastcode);
            writeAccuWeather(userid, accucity, accuregion, accucode);
        }
        
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
            const config = {userid: userid, configkey: key, configval: configstr, configtype: 0};
            mydb.updateRow("configs", config, "userid = "+userid+" AND configkey = '"+key+"'")
            .then( () => {
            })
            .catch( reason => {
                console.warn( (ddbg()), reason);
            });
        }
        return configoptions;
    }
}

function processDevices(userid, panelid, optarray) {

    // first get the configurations and things and then call routine to update them
    userid = parseInt(userid);
    panelid = parseInt(panelid);
    if ( DEBUG4 ) {
        console.log((ddbg()), "userid: ", userid, " panelid: ", panelid, "optarray: ", jsonshow(optarray) );
    }

    // get the hub filters and process them first
    var joinstr = mydb.getJoinStr("things","roomid","rooms","id");
    var fields = "things.id as things_id, things.userid as things_userid, things.roomid as things_roomid, " +
        "things.tileid as things_tileid, things.posy as things_posy, things.posx as things_posx, " +
        "things.zindex as things_zindex, things.torder as things_torder, things.customname as things_customname, " +
        "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";

    return Promise.all([
        mydb.getRow("hubs","*","userid = "+userid+" AND hubid = '-1'"),
        mydb.getRows("rooms","*","userid = "+userid+" AND panelid="+panelid),
        mydb.getRows("things", fields, "things.userid = "+userid+" AND rooms.panelid = "+panelid, joinstr)
    ])
    .then(results => {
        var hubzero = results[0];
        var rooms = results[1];
        var things = results[2];
        return doProcessOptions(optarray, hubzero, rooms, things);
    })
    .catch(reason => {
        console.warn( (ddbg()), "error retrieving hubs, rooms, and things from the database: ", reason);
        return reason;
    });

    function doProcessOptions(optarray, hubzero, rooms, things) {
        if (DEBUG4) {
            console.log( (ddbg()), "hubzero: " + jsonshow(hubzero) );
            console.log( (ddbg()), "rooms: " + jsonshow(rooms) );
            console.log( (ddbg()), "things: " + jsonshow(things) );
        }
        
        var roomnames = {};
        rooms.forEach(function(item) {
            var id = item.id;
            var rname = item.rname;
            roomnames[rname] = id;
        });

        // force all three to be given for change to happen
        var huboptpick = optarray["hubpick"] || "-1";
        var useroptions = optarray["useroptions"] || [];

        for (var key in optarray) {
            var val = optarray[key];
            if ( typeof val === "string" ) val = val.trim();

            //skip the returns from the submit button and the flag
            if (key==="editdevices" || key==="api" || key==="useajax"  || key==="userid" || key==="panelid" || key==="webSocketUrl" || key==="returnURL" ||
                key==="pagename" || key==="pathname" || key==="userpanel" || key==="pname" || key==="uname" || key==="panelPw2" ) {
                continue;
            }
           
            // made this more robust by checking room name being valid
            if ( array_key_exists(key, roomnames) && is_array(val) ) {
                
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
        
        // save the hub filter options
        saveFilters(userid, useroptions, huboptpick);
        return {"things": "updated"};
       
    }
}

function getErrorPage(reason) {
    var tc = "";
    tc += getHeader(0, null, null, true);
    tc += "<h2>HousePanel Error</h2>"
    tc += "<div class=\"error\">You are seeing this because HousePanel experienced a fatal error.";
    tc += "<br><br>Reason: " + reason;
    tc += "</div>";
    tc += getFooter();
    return tc;

}

// renders the main page
function getMainPage(user, configoptions, hubs, req, res) {

    var hostname = req.headers.host;
    var kioskstr = getConfigItem(configoptions, "kiosk");
    var kioskmode = (kioskstr=="true" || kioskstr==true) ? true : false;
    var userid = user["users_id"];
    var useremail = user["users_email"];
    var uname = user["users_uname"];
    // var defhub = user["users_defhub"];
    var usertype = user["users_usertype"];
    var panelid = user["panels_id"];
    var pname = user["panels_pname"];
    var skin = user["panels_skin"];
    var hubpick = getCookie(req, "defaultHub");
    var alldevices = {};

    console.log(  "\n**********************************************************************************************",
                  "\n", (ddbg()), "Serving pages from: ", GLB.returnURL,
                  "\n**********************************************************************************************");

    // first get the room list and make the header
    var devices_joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
    var devices_fields = "devices.id as devices_id, devices.uid as devices_uid, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, devices.hubid as devices_hubid, " +
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
    "devices.id as devices_id, devices.uid as devices_uid, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
    "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, " +
    "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
    "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, hubs.hubtype as hubs_hubtype, " +
    "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
    "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer, " +
    "rooms.id as rooms_id, rooms.panelid as rooms_panelid, rooms.rname as rooms_rname, rooms.rorder as rooms_rorder";
    
    Promise.all( [
        mydb.getRows("rooms", "*", "userid = "+userid+" AND panelid = "+panelid, "", "rooms.rorder"),
        mydb.getRows("devices", devices_fields, "devices.userid = " + userid + " GROUP BY devices.deviceid, devices.devicetype", devices_joinstr, "hubs.hubid, devices.name"),
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
        // changed the indexing to be based on uid to match the new logic for user specific lower ID numbers
        devices.forEach(function(dev) {
            // var devid = dev["devices_id"];
            // alldevices[devid] = dev;
            const uid = dev["devices_uid"];
            alldevices[uid] = dev;
        });

        var tc = renderMain(configoptions, user, hubpick, hubs, rooms, alldevices, things);
        res.send(tc);
        res.end();
    })
    .catch(reason => {
        console.error( (ddbg()), "problem loading main page. reason: ", reason);
        var tc = getErrorPage();
        res.send(tc);
        res.end();
    });

    // this is the routine that actually draws the page the user sees
    function renderMain(configoptions, user, hubpick, hubs, rooms, alldevices, things) {
        var tc = "";
        tc += getHeader(userid, pname, skin, false);
        var hpcode = user["users_hpcode"];

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
            console.log( (ddbg()), "renderMain: ", userid, uname, panelid, pname, usertype, skin);
        }
    
        tc += '<div id="dragregion">';
        tc += '<div id="tabs">';

        // if we are not in kiosk mode, show the main hamburger menu
        if ( !kioskmode ) {
            tc += '<div id="hpmenu">';
            tc += "____<br>____<br>____";
            tc += '</div>';
        }

        tc += '<ul id="roomtabs">';

        for (var i in rooms) {
            var row = rooms[i];
            var k = row.rorder;
            var roomname = row.rname;
            if ( roomname ) {
                tc += "<li roomnum=\"" + k + "\" class=\"tab-" + roomname + "\"><a href=\"#" + roomname + "-tab\">" + roomname + "</a></li>";
            }
        }
        tc += '</ul>';
            
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
            var pagecontent = getNewPage(userid, pname, configoptions, roomid, roomname, rorder, thingsarray, alldevices);
            tc = tc + pagecontent;
        };
 
        // include doc button and panel name
        const displayname = uname ? uname : useremail;
        if ( kioskmode ) {
            tc += '<div id="showversion" class="hidden">';
        } else {
            tc += '<div id="showversion" class="showversion">';
        }
        tc += '<span id="emailname" class="infoname">' + displayname + '</span><span id="infoversion" class="infoname"> | V' + GLB.HPVERSION + '</span> | <span id="infoport" class="infoname"></span>';
        tc += '</div>';
        if ( kioskmode ) {
            tc += '<div id="quickedit" class="hidden">E</div>';
        } else {
            tc += '<div id="quickedit" class="quickedit">E</div>';
        }
        // tc += '<div id="showopts"><a href="' +  GLB.returnURL + '/showoptions"><img width="24" height=24 src="media/editgear.png"/></a></div>';
        tc += '<div id="showdocs"><a href="https://www.housepanel.net" target="_blank">?</a></div>';

        // end of the tabs
        tc += "</div>";

        // set the websock servername as same as hosted page but different port
        var webSocketUrl = getSocketUrl(hostname);
        
        // include form with useful data for js operation
        tc += "<form id='kioskform'>";
        var erstr =  GLB.dbinfo.enablerules ? "true" : "false"
        tc += hidden("enablerules", erstr);

        // save the socket address for use on js side
        // save Node.js address for use on the js side
        tc += hidden("pagename", "main");
        tc += hidden("returnURL", GLB.returnURL);
        tc += hidden("webSocketUrl", webSocketUrl);
        tc += hidden("webSocketServerPort", GLB.webSocketServerPort);
        tc += hidden("webDisplayPort", GLB.port);
        tc += hidden("userid", userid, "userid");
        tc += hidden("pname", pname);
        tc += hidden("panelid", panelid, "panelid");
        tc += hidden("skinid", skin, "skinid");
        tc += hidden("emailid", useremail, "emailid");
        tc += hidden("hpcode", hpcode, "hpcode");
        tc += hidden("apiSecret", GLB.apiSecret);

        // pass all debug flags to browser
        const dbgflags = {debug1: DEBUG1, debug2: DEBUG2, debug3: DEBUG3, debug4: DEBUG4, debug5: DEBUG5,
                          debug6: DEBUG6, debug7: DEBUG7, debug8: DEBUG8, debug9: DEBUG9, debug10: DEBUG10,
                          debug11: DEBUG11, debug12: DEBUG12, debug13: DEBUG13, debug14: DEBUG14, debug15: DEBUG15,
                          debug16: DEBUG16, debug17: DEBUG17, debug18: DEBUG18, debug19: DEBUG19, debug20: DEBUG20
        };
        tc += hidden("dbgflags", JSON.stringify(dbgflags), "dbgflags");
        tc += "</form>";

        // var hubpick = getConfigItem(configoptions, "hubpick");
        var useroptions = getConfigItem(configoptions, "usroptions");
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
    if ( useroptions && is_array(useroptions) ) {
        var updval = {userid: userid, configkey: 'usroptions', configval: JSON.stringify(useroptions), configtype: 0};
        mydb.updateRow("configs", updval, "userid = " + userid + " AND configkey = 'usroptions'");
    }

    if ( huboptpick ) {
        var updhub = {userid: userid, configkey: 'hubpick', configval: huboptpick, configtype: 0};
        mydb.updateRow("configs", updhub, "userid = " + userid + " AND configkey = 'hubpick'");
    }
}

// this routine updates the null hub with the special tile count requested
async function updSpecials(userid, hubindex, stype, newcount, specials) {

    const defwidth = {"video": 375, "frame": 375, "image": 375, "blank": 180, "custom": 180};
    const defheight = {"video": 210, "frame": 210, "image": 210, "blank": 210, "custom": 210};

    // add special tiles based on type and user provided count
    // this replaces the old code that handled only video and frame tiles
    // this also creates image and blank tiles here that used to be made in groovy
    // putting this here allows them to be handled just like other modifiable tiles
    // note that frame1 and frame2 are reserved for weather and accuweather tiles
    var dtype = stype==="custom" ? stype+"_" : stype;

    // get the number of specials of this type already here
    var numnow = 0;
    if ( specials ) {
        for (const key in specials) {
            const dev = specials[key];
            if ( dev.devicetype === stype ) numnow++;
        }
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
                console.warn( (ddbg()), "error adding special tile to database. device: ", device, "reason: ", reason );
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
                console.error( (ddbg()), "error updating special tile type: ", stype, "reason: ", reason );
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
            console.warn( (ddbg()), "error updating room name: ", reason);
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
            console.error((ddbg()), "error updating name: ", reason);
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
        var num = 0;
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
                num++;
                $tc += '<div class="iconcat">';
                $tc += '<img num="'+num+'" src="' + filedir +'" show="' + showicon + '" class="icon" title="' + froot + '" />';
                $tc += '</div>';
            }
        });
    } else {
        $tc = false;
        console.error( (ddbg()), "Invalid directory: ", activedir, " in getIcons");
    }
    return $tc;
}

// get photos or return false if folder isn't there
function getPhotos(userid, pname) {
    
    var userdir = "user" + userid.toString();
    try {
        var photos = {};
        var activedir = path.join(userdir, pname, "photos");
        var photolist = fs.readdirSync(activedir);
    } catch (e) {
        photos = "No photos available to show";
        photolist = false;
    }

    if ( photolist ) {
        var allowed = ["png","jpg","jpeg","gif","JPG","GIF","PNG","JPEG"];
        var index = 0;
        photolist.forEach( function(filename) {
            // var froot = path.basename(filename);
            var ext = path.extname(filename).slice(1);
            if ( in_array(ext, allowed) ) {
                photos[index] = path.join(activedir,filename);
                index = index + 1;
            }
        });
    }
    return photos;
}

function delImages(userid, pname, files) {
    if ( is_array(files) && files.length ) {
        try {
            files.forEach(fname => {
                fs.unlinkSync("./"+fname);
            });
            if ( DEBUG16 ) {
                console.log((ddbg()), "Image files removed: ", files);
            }
            return files;
        } catch (reason) {
            console.error((ddbg()), "error - trying to remove image files. ", reason);
            return [];
        }
    } else {
        return [];
    }
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

// parse the three components
// tileid is optional and there only for legacy reasons when I had only two parts
// for content (swattr) values with three parts tileid is ignored
function parseCustomizeContent(tileid, swattr) {
    var linkid;
    var targetsubid;
    var nreset;
    var n = swattr.indexOf("::");
    if ( n=== -1 ) {
        linkid = parseInt(tileid);
        targetsubid = swattr;
        nreset = "d";
    } else {
        var part1 = swattr.substring(0,n);
        var part2 = swattr.substring(n+2);
        var m = part2.indexOf("::");
        if ( m=== -1 ) {
            linkid = parseInt(tileid);
            targetsubid = part1;
            nreset = part2;
        } else {
            linkid = parseInt(part1);
            targetsubid = part2.substring(0, m);
            nreset = part2.substring(m+2);
        }
    }

    // failsafes include point to clock, name, and day since they will always be there
    if ( !linkid || isNaN(linkid) ) {
        linkid = 1;
    }
    if ( !targetsubid ) {
        targetsubid = "name";
    }
    if ( !nreset ) {
        nreset = "d";
    }
    return [linkid, targetsubid, nreset];
}

function updCustom(userid, tileid, swid, swval, oldsubid, subid, swtype, rules) {
    var configkey = "user_" + swid;
    var goodrules = [];
    var content = swval;

    // handle encryption and check for valid customization
    // fixed bug below that didn't use the new goodrules array
    if ( rules && is_array(rules) && rules.length ) {

        rules.forEach(rule => {
            if ( is_array(rule) && rule.length>2 && rule[0] && rule[2] ) {
                var customval = rule[1].toString();
                var r2 = rule[2];
                var rtype = rule[0];

                // convert to hash if user is entering a password
                // note that if user isn't entering this pw field, the value is already in hash format
                if ( rtype==="TEXT" && r2==="password" && customval.length > 0 && r2===subid ) {
                    customval = pw_hash(customval);
                }
                goodrules.push( [rtype, customval, r2] );
            }
        });        
    }

    if ( goodrules.length > 0 ) {
        var rulejson = JSON.stringify(goodrules);
        var rulerow = {userid: userid, configkey: configkey, configval: rulejson, configtype: 1};
        mydb.updateRow("configs", rulerow, "userid = "+userid+" AND configkey = '"+configkey+"'")
        .then(res => {
            var str = "Updated " + goodrules.length + " customizations for id: " + swid + ", and user: " + userid;
            if ( DEBUG10 ) {
                console.log((ddbg()), str, "rules: \n", goodrules, " rulerow: ", rulerow);
            }

            // now handle the list request by clearing out old values if there and adding first value based on now
            // this will always use the new format for "content" so the tileid parameter should be zero
            // if content is null then skip the list priming step since we are doing a delete
            if ( swtype === "LIST" ) {
    
                mydb.deleteRow("lists",`userid = ${userid} AND deviceid = '${swid}' AND subid = '${oldsubid}'`)
                .then(res2 => {
                    var numListDel = res2.getAffectedItemsCount();
                    if ( numListDel > 0 && DEBUG12) {
                        console.log((ddbg()), "removed " + numListDel + " items from old LIST for subid = " + oldsubid);
                    }
                })
                .then( ()=> {
                    if ( content ) {
                        var arr = parseCustomizeContent(tileid, content);
                        var uid = arr[0];
                        var targetsubid = arr[1];
                        mydb.getRow("devices","*", `userid = ${userid} AND uid = ${uid}`)
                        .then(device => {
                            if ( device ) {
                                var pvalue = decodeURI2(device.pvalue);
                                try {
                                    var theval = pvalue[targetsubid];
                                } catch(e) {
                                    theval = 0;
                                    console.warn( (ddbg()), `Zero assigned because list field [${targetsubid}] not found for device: `, pvalue);
                                }
                                var d = new Date();
                                var today = d.toLocaleString();
                                var newList = {userid: userid, deviceid: swid, subid: subid, ltime: today, lvalue: theval};
                                mydb.addRow("lists", newList);
                            } else {
                                console.warn( (ddbg()), `Device not found for updating ${swtype} custom item`);
                            }    
                        })
                        .catch(reason => {
                            console.warn( (ddbg()), reason);
                        });
                    }
                });
            }
        })
        .catch( reason => {
            console.error( (ddbg()), reason);
        });

    // if we get here, the rules are empty so we can remove the item from the db
    } else {
        mydb.deleteRow("configs", "userid = "+userid+" AND configkey='"+configkey+"'")
        .then(res => {
            if ( swtype==="LIST" ) {
                mydb.deleteRow("lists",`userid = ${userid} AND deviceid = '${swid}' AND subid = '${oldsubid}'`)
                .then(res2 => {
                    var numListDel = res2.getAffectedItemsCount();
                    if ( DEBUG10 ) {
                        console.log( (ddbg()), `deleted ${numListDel} LIST rows for deviceid=${swid} and subid=${oldsubid}`);
                    }
                })
                .catch(reason => {
                    console.error( (ddbg()), reason);
                });
            }
        })
        .catch( reason => {
            console.error( (ddbg()), reason);
            return "error - problem encountered attempting to update rules";
        });
    }
    return goodrules;
}

function findHub(hubid, hubs) {
    var thehub = hubs[0];
    hubs.forEach( function(hub) {
        if ( hub.hubid === hubid ) {
            thehub = hub;
        }
    });
    return thehub;
}

function getHubObj(hub) {
    var promise = new Promise(function(resolve, reject) {

        if ( !hub || typeof hub!=="object" ) {
            reject("Something went wrong with authorizing a hub");
            return;
        }

        var hubName = hub["hubname"];
        var hubType = hub["hubtype"];

        // first handle user provided auth which only works for ISY and Hubitat
        if ( hub.hubaccess && hub.hubendpt ) {
            // get all new devices and update the options index array
            // this forces page reload with all the new stuff
            // notice the reference to /reauth in the call to get Devices
            // this makes the final read redirect back to reauth page

            // for ISY and HE we can go right to getting hub details and devices
            // this meets up with the js later by pushing hub info back to reauth page
            // determine what to retun to browser to hold callback info for hub auth flow
            var result = {action: "things", hubType: hubType, hubName: hubName, numdevices: 0};

            if (EMULATEHUB===true && hubType==="ISY") {
                resolve(result);
                return;
            }

            // now read the hub and fill in the right info
            getHubInfo(hub)
            .then(mydevices => {
                var ndev = Object.keys(mydevices).length;
                result.numdevices = ndev;

                // reactivate websocket here if we reauthorized an ISY hub
                if ( hubType==="ISY" && EMULATEHUB!==true ) {
                    setupISYSocket();
                }
                resolve(result);
            })
            .catch(reason => {
                reject(reason);
            });
        } else {
            if ( hubType === "ISY" ) {
                var msg = "Hub username and password must both be provided to register an ISY hub";
            } else {
                msg = "Access Token and App ID are both required to register a Hubitat hub";
            }
            result = {action: "error", reason: msg};
            resolve(result);
        }
    });
    return promise;
}

function apiCall(user, body, protocol, res) { 

    if ( DEBUG8 ) {
        console.log( (ddbg()), protocol + " api call, body: ", jsonshow(body) );
    }
    var api = body['api'] || body['useajax'] || "";
    var swid = body["id"] || "none";
    var swtype = body["type"] || "none";
    var swval = body["value"] || "";
    var swattr = body["attr"] || "";
    var subid = body["subid"] || "";
    var tileid = body["tileid"] || body["tile"] || 0;
    var uid = body["uid"] || 0;
    var command = body["command"] || "";
    var linkval = body["linkval"] || "";
    var thingid = body["thingid"] || 0;
    var roomid = body["roomid"] || 0;
    var hubindex = body["hubindex"] || 0;
    var hint = body["hint"] || "";
    var roomname = body["roomname"] || "Unknown";
   
    // new logic now gets this info from DB so user doesn't need to pass it in a post api call
    // but they do need to have the special hpcode value or you wouldn't get this far
    // the else branch should never be reached
    if ( user && typeof user === "object" ) {
        var userid = user["users_id"];
        var useremail = user["users_email"];
        var uname = user["users_uname"];
        var panelid = user["panels_id"];
        var pname = user["panels_pname"];
        var skin = user["panels_skin"];
    } else {
        userid = body["userid"];
        panelid = body["panelid"] || 1;
        pname = body["pname"] || "default";
        useremail = body["email"];
        uname = body["uname"];
        skin = body["skin"] || "skin_housepanel";
    }

    if ( !userid ) {
        console.error( (ddbg()), "*** error *** user not authorized for API call. api: ", api, " body: ", body);
        return "error - HousePanel is not authorized for this user to make an API call";
    }
    
    // handle multiple api calls but only for tiles since nobody would ever give a list of long id's
    // this now has to be a list of thingid's instead of tileid's because the tiles must be reachable
    // either will be taken and used if provided
    var multicall = "";

    if ( (api==="action" || api==="doaction") && tileid && tileid.indexOf(",") !== -1 ) {
        multicall = "tileid";
        if ( !tileid.startsWith("(") ) {
            tileid = "(" + tileid;
        }
        if ( !tileid.endsWith(")") ) {
            tileid = tileid + ")";
        }
    } else if ( (api==="action" || api==="doaction") && uid && uid.indexOf(",") !== -1 ) {
        multicall = "uid";
        if ( !uid.startsWith("(") ) {
            uid = "(" + uid;
        }
        if ( !uid.endsWith(")") ) {
            uid = uid + ")";
        }
    }

        var result;
        switch (api) {
            
            case "doaction":
            case "action":
                if ( multicall ) {
                    result = "";
                    if ( !subid ) { subid = "switch"; }
                    if ( multicall === "tileid" ) {
                        var conditions = `userid = ${userid} AND id IN ${tileid}`;
                    } else {
                        conditions = `userid = ${userid} AND id IN ${uid}`;
                    }
                    mydb.getRows("devices","*",conditions)
                    .then(devices => {
                        devices.forEach(device => {
                            userid = device.userid;
                            hubindex = device.hubid;
                            swid = device.deviceid;
                            swtype = device.devicetype;
                            if ( DEBUG8 ) {
                                console.log( (ddbg()), "doaction multi hubindex: ", hubindex, " tileid: ", device.id, " uid: ", device.uid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid);
                            }
                            doAction(userid, hubindex, device.id, device.uid, swid, swtype, swval, swattr, subid, hint, command, linkval);
                        });
                    });
                    result = "called doAction " + devices.length + " times in a multihub action";
                } else {
                    if ( DEBUG8 ) {
                        console.log((ddbg()), "doaction: swid: ", swid, " swval: ", swval, " swattr: ", swattr, " subid: ", subid, " tileid: ", tileid, " hint: ", hint);
                    }
                    if ( uid && (!swid || !swtype || !hubindex) ) {
                        try {
                            uid = parseInt(uid);
                        } catch(e) {
                            return "Invalid request";
                        }
                        result = mydb.getRows("devices","*",`userid = ${userid} AND uid = ${uid}`)
                        .then(devices => {
                            if ( devices ) {
                                var device = devices[0];
                                userid = device.
                                userid;
                                hubindex = device.hubid;
                                swid = device.deviceid;
                                swtype = device.devicetype;
                                if ( !subid ) { subid = "switch"; }
                                return doAction(userid, hubindex, device.id, device.uid, swid, swtype, swval, swattr, subid, hint, command, linkval);
                            } else {
                                return "No device found.";
                            }
                        })
                        .catch(reason => {
                            console.error((ddbg()), reason);
                            return "Invalid request";
                        })
                    } else {
                        result = doAction(userid, hubindex, tileid, uid, swid, swtype, swval, swattr, subid, hint, command, linkval);
                    }
                }
                break;
                
            case "status":
                result = {version: GLB.HPVERSION, userid: userid, email: useremail, uname: uname, panel: pname, skin: skin};
                break;

            // changed to only handle page fake tile requests
            // we get the real tile from the GUI all the time now
            case "pagetile":
                if ( protocol==="POST" ) {
                    var tc = "";
                    var roomnum = swid;

                    // a fake tile for pages that includes tabs
                    tc += "<div id=\"pe_wysiwyg\" class=\"thing page-thing\" type=\"page\">";
                    tc += "<div id='x_tabs'>";

                    // tabs to use to do styling on the edit page
                    tc += '<ul id="x_roomtabs">';
                    tc += `<li id="x_tab" roomnum="${roomnum}" class="tab-${roomname}"><a href="#tabStyle">${roomname}</a></li>`;
                    tc += `<li id="x_tabon" roomnum="${roomnum}" class="tab-${roomname}"><a href="#tabonStyle">${roomname}</a></li>`;
                    tc += "</ul>";

                    // some simple content to show when the tabs are clicked on
                    tc += `<div id="tabStyle">`;
                    tc += `<div class="tabStyle">Styling for unselected Tab ${roomname}</div>`;
                    tc += "</div>";

                    tc += `<div id="tabonStyle">`;
                    tc += `<div class="tabonStyle">Styling for selected Tab ${roomname}</div>`;
                    tc += "</div>";

                    tc += "</div>";
                    tc += "</div>";
                    result = tc;
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "wysiwyg":
                if ( protocol==="POST" ) {

                    var devices_joinstr = mydb.getJoinStr("devices","hubid","hubs","id");
                    var devices_fields = "devices.id as devices_id, devices.uid as devices_uid, devices.userid as devices_userid, devices.deviceid as devices_deviceid, " +
                        "devices.name as devices_name, devices.devicetype as devices_devicetype, devices.hint as devices_hint, devices.hubid as devices_hubid, " +
                        "devices.refresh as devices_refresh, devices.pvalue as devices_pvalue, " +
                        "hubs.id as hubs_id, hubs.hubid as hubs_hubid, hubs.hubhost as hubs_hubhost, hubs.hubname as hubs_hubname, hubs.hubtype as hubs_hubtype, " +
                        "hubs.clientid as hubs_clientid, hubs.clientsecret as hubs_clientsecret, hubs.hubaccess as hubs_hubaccess, hubs.hubrefresh as hubs_hubrefresh, " +
                        "hubs.useraccess as hubs_useraccess, hubs.userendpt as hubs_userendpt, hubs.hubtimer as hubs_hubtimer";
                    var result = Promise.all([
                        mydb.getRows("configs", "*", "userid = "+userid),
                        mydb.getRows("devices", devices_fields, "devices.userid = " + userid + " GROUP BY devices.deviceid, devices.devicetype", devices_joinstr, "hubs.hubid, devices.name")
                    ])
                    .then(results => {
                        var configoptions = results[0];
                        var devices = results[1];
                        var alldevices = {};
                        var luid;
                        devices.forEach(function(dev) {
                            luid = dev["devices_uid"];
                            alldevices[luid] = dev;
                        });
                        var linkdev = alldevices[uid];
                        try {
                            var device = JSON.parse(decodeURI(swval));
                        } catch(e) {
                            var device = {name: "Unknown", devicetype: "unknown", hint: "", refresh: "never", pvalue: ""};
                        }
                        var thesensor = {id: swid, name: device.name, thingid: -1, uid: uid, roomid: 0, 
                                         type: device.devicetype, hubnum: linkdev["hubs_hubid"], hubindex: device.hubid, hubtype: linkdev["hubs_hubtype"], 
                                         hint: device.hint, refresh: device.refresh, value: device.pvalue};
                        var customname = swattr;
                        return makeThing(userid, pname, configoptions, tileid, thesensor, roomname, 0, 0, 999, customname, "te_wysiwyg", alldevices);
                    }).catch(reason => {
                        console.error( (ddbg()), reason);
                        return null;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "weathericon":
                var num = parseInt(swval);
                result = getWeatherIcon(num, swtype);
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
                    result = setPosition(userid, swtype, thingid, swattr);
                    // result = "moved tile - results pushed to database";
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "addthing":
                if ( protocol==="POST" ) {
                    var startpos = swattr;
                    result = addThing(userid, pname, swid, swtype, roomname, hubindex, roomid, startpos);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
         
            // use the new thingid for the swattr value to delete the specific thing on the page
            case "delthing":
                if ( protocol==="POST" ) {
                    result = delThing(userid, swid, swtype, roomname, tileid, uid, thingid);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "pagedelete":
                if ( protocol==="POST" ) {
                    result = delPage(userid, roomid, roomname, pname);
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
                result = getPhotos(userid, pname);
                break;
                
            case "refreshpage":
                if ( protocol==="POST" ) {
                    result = mydb.getRows("hubs","*","userid = "+userid+ " AND hubid != 'new'")
                    .then(hubs => {
                        var numhubs = hubs ? Object.keys(hubs).length : 0;
                        var promise;
                        if ( numhubs === 0 ) {
                            // return "nothing to refresh";
                            promise = new Promise(function(resolve, reject) {
                                resolve("Nothing to refresh");
                            });
                        } else {
                            promise = new Promise(function(resolve, reject) {
                                var n = 0;
                                var strmsg = "";
                                hubrecurse(n, hubs[0]);

                                function hubrecurse(n, hub) {
                                    getDevices(hub)
                                    .then(mydevices => {
                                        n++;
                                        var num = Object.keys(mydevices).length;
                                        strmsg+= hub.hubname + " refreshed " + num + " devices";
                                        if ( n < numhubs ) {
                                            strmsg+= "<br>";
                                            hubrecurse(n, hubs[n]);
                                        } else {
                                            removeDeadThings(userid);
                                            removeHublessDevices(userid);
                                            resolve(strmsg);
                                        }
                                    })
                                    .catch(reason => {
                                        console.error( (ddbg()), reason );
                                        resolve("error attempting to refresh hubs for userid = " + userid);
                                    })

                                }
                            });
                            return promise;
                        }
                    })
                    .catch(reason => {
                        console.error( (ddbg()), "error attempting to refresh page: ", reason);
                        return reason;
                    });
                    
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                
                break;
            
            // this returns all user customizations and the current mode
            // this is an efficiency thing to prevent two calls to the server
            case "getoptions":
                result = Promise.all([
                    mydb.getRows("configs","*","userid = "+userid),
                    mydb.getRow("devices","*",`userid=${userid} AND deviceid like '%mode' and name = 'Mode'`)
                ])
                .then(results => {
                    var configs = results[0];
                    var moderow = results[1];
                    var rulelist = {};
                    var configlist = {};
                    var themode = "Unknown";
                    if ( configs ) {
                        configs.forEach(row => {
                            if ( row.configkey.startsWith("user_") ) {
                                rulelist[row.configkey] = JSON.parse(row.configval);
                            } else {
                                configlist[row.configkey] = decodeURI2(row.configval);
                            }
                        });
                    }
                    if (moderow) {
                        var pvalue = decodeURI2(moderow.pvalue);
                        themode = pvalue["themode"];
                    }

                    if ( DEBUG11 ) {
                        console.log( (ddbg()),"rules list for user: ", userid," rulelist: ", jsonshow(rulelist), "configlist: ", jsonshow(configlist), " mode: ", themode );
                    }
                    return [rulelist, configlist, themode];
                }).catch(reason => {
                    console.error( (ddbg()), "apiCall - getoptiopns: ", reason);
                    return null;
                });
                break;
            
            // this returns just the rules list for a specific user and device swid
            case "getrules":
                if ( protocol==="POST" ) {
                    var configkey = "user_" + swid;
                    result = mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'")
                    .then(row => {
                        var rulelist;
                        if ( row ) {
                            rulelist = JSON.parse(row.configval);
                            if ( DEBUG2 ) {
                                console.log( (ddbg()),"rule list for user: ", userid," swid: ", swid, " rules: ", jsonshow(rulelist) );
                            }
                        } else {
                            rulelist = [];
                        }
                        return rulelist;
                    }).catch(reason => {
                        console.error( (ddbg()), "apiCall - getrules: ", reason);
                        return [];
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            // similar to above but we get the rules and edit them based on what is sent in
            // and then pass it on to our rules updater function to update them
            case "editrules":
                if ( protocol==="POST" ) {
                    // first get the list of updated rules from the original subid and swid
                    var newid = body["newid"];
                    var newsubid = body["newsubid"];
                    var newval = body["newval"];
                    var doall = body["doall"] === "true" ? true : false;
                    var dorules = body["dorules"] === "true" ? true : false;
                    var configkey = "user_" + swid;
                    var newrule = [swtype, newval, newsubid];
                    var rulelist = [];
                    var k1 = 0;
                    var newvalfront;

                    // get the global replacement value for LINK and RULE bulk replacements
                    if ( dorules && swtype==="LINK" ) {
                        k1 = swval.indexOf("::");
                        newvalfront = newval.substr(0, k1+1);
                    } else if ( dorules && swtype==="RULE" ) {
                        k1 = swval.indexOf("=");
                        newvalfront = newval.substr(0, k1+1);
                    } else {
                        k1 = 0;
                        newvalfront = "";
                        dorules = false;
                    }

                    result = mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'")
                    .then(row => {
                        if ( row ) {
                            var oldrules = JSON.parse(row.configval);

                            // loop through the list of rules and update the one that was edited
                            // we do this by either pushing the existing one or the edited one to a new array
                            var newpushed = false;
                            oldrules.forEach(therule => {
                                if ( therule[2] === subid && therule[0]===swtype && !newpushed ) {
                                    rulelist.push(newrule);
                                    newpushed = true;
                                } else {
                                    // fix up the other rules if we picked the option to update all rules
                                    if ( dorules && k1 && therule[0]===swtype ) {
                                        var updval = newvalfront + therule[1].substring(k1);
                                        therule = [swtype, updval, therule[2] ];
                                    }
                                    rulelist.push(therule);
                                }
                            });

                            if ( !newpushed ) {
                                rulelist.push(newrule);
                            }
                        }
                        return rulelist;
                    })
                    .then(rulelist => {

                        // handle simple case where the swid did not change
                        // for this simple case we just update the database and return
                        if ( newid === swid ) {
                            updCustom(userid, 0, swid, newval, subid, newsubid, swtype, rulelist);

                        // for the more complicated case where we changed the swid, we have to do two passes
                        } else {

                            // remove the reassigned item from the original list if we changed the id
                            // if we have the option to move all id's then only push things of different type
                            var oldrulelist = [];
                            rulelist.forEach(therule => {
                                if ( (!doall && (therule[2]!==subid || therule[0]!==swtype)) ||
                                    (doall && (therule[0]!==swtype ) ) ) {
                                    oldrulelist.push(therule);
                                }
                            });
                            updCustom(userid, 0, swid, null, subid, subid, swtype, oldrulelist);

                            // get the list of rules from the destination and add to it
                            configkey = "user_" + newid;
                            var newrulelist = [];

                            // move over the old one's if that option was picked
                            var newpushed = false;
                            if ( doall ) {
                                rulelist.forEach(therule => {
                                    if ( therule[0]===swtype ) {
                                        newrulelist.push(therule);
                                        if ( therule[2]===newsubid ) {
                                            newpushed = true;
                                        }
                                    }
                                });
                            }

                            // get the rules for the new ID and merge our old ones or the migrated one
                            mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'")
                            .then(row => {
                                if ( row ) {
                                    var newrules = JSON.parse(row.configval);
                                    newrules.forEach(therule => {
                                        if ( therule[2]===newsubid && therule[0]===swtype && !newpushed ) {
                                            newrulelist.push(newrule);
                                            newpushed = true;
                                        } else {
                                            newrulelist.push(therule);
                                        }
                                    });
                                }
                                if ( !newpushed ) {
                                    newrulelist.push(newrule);
                                }
                                updCustom(userid, 0, newid, newval, newsubid, newsubid, swtype, newrulelist);
                            });
                        }
                        return rulelist;
                    })
                    .catch(reason => {
                        console.error( (ddbg()), "apiCall - editrules: ", reason);
                        return null;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            // similar to above but we delete the pointed to rule
            // and then pass it on to our rules updater function to update them
            case "delrules":
                if ( protocol==="POST" ) {
                    var configkey = "user_" + swid;
                    result = mydb.getRow("configs","*","userid = "+userid+" AND configkey = '"+configkey+"'")
                    .then(row => {
                        var rulelist = [];
                        if ( row ) {
                            var oldrules = JSON.parse(row.configval);

                            // loop through the list of rules and only push those not deleted
                            for ( var i = 0; i < oldrules.length; i++ ) {
                                var therule = oldrules[i];
                                if ( therule[2] !== subid ) {
                                    rulelist.push(therule);
                                }
                            };
                        }

                        // save the updated config row
                        // since we are deleting we signal that by sending null in swval place
                        updCustom(userid, 0, swid, null, subid, subid, swtype, rulelist);
                        return rulelist;
                    }).catch(reason => {
                        console.error( (ddbg()), "apiCall - delrules: ", reason);
                        return null;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
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

            // returns the mode from the first mode tile found
            case "getmode":
                result = mydb.getRow("devices","*",`userid=${userid} AND deviceid like '%mode' and name = 'Mode'`)
                .then(row => {
                    if (row) {
                        var pvalue = decodeURI2(row.pvalue);
                        return pvalue["themode"];
                    } else {
                        return "Unknown";
                    }
                })
                .catch(reason => {
                    console.error( (ddbg()), "Something went wrong getting a mode. Reason: ", reason );
                    return "Unknown";
                });
                break;

            // read and return a single devices tied to this user
            case "getdevice":
                result = Promise.all([
                    mydb.getRow("devices","*", "userid = "+userid + " AND deviceid = '" + swid + "'"),
                    mydb.getRows("configs","*", "userid = " + userid + " AND configtype=1")
                ])
                .then(results => {
                    var row = results[0];
                    var configoptions = results[1];
                    row.pvalue = decodeURI2(row.pvalue);
                    if ( configoptions && is_object(configoptions) ) {
                        row.pvalue = getCustomTile(userid, configoptions, row.pvalue, row.id);
                        row.pvalue = getFileName(userid, pname, row.pvalue, row.devicetype, configoptions);
                    }
                    return row;
                })
                .catch(reason => {
                    console.error( (ddbg()), "apiCall - getdevice: ", reason);
                    result = "Something went wrong in the getdevice API call.";
                });
                break;

            // read and return devices tied to this user
            // updated this to return device with customizations included
            case "getdevices":
                if ( protocol==="POST" ) {
                    result = Promise.all([
                        mydb.getRows("devices","*", `userid = ${userid} AND uid > 0 GROUP BY deviceid, devicetype`, false, "name, devicetype, hubid"),
                        mydb.getRows("configs","*", "userid = "+userid + " AND configtype=1"),
                        mydb.getRows("hubs","id, hubname", "userid = "+userid )
                    ])
                    .then(results => {
                        var rows = results[0];
                        var configoptions = results[1];
                        var hubs = results[2];

                        var devices = {};
                        if ( rows ) {
                            rows.forEach(row => {
                                row.pvalue = decodeURI2(row.pvalue);
                                if ( configoptions && is_object(configoptions) ) {
                                    row.pvalue = getCustomTile(userid, configoptions, row.pvalue, row.id);
                                    row.pvalue = getFileName(userid, pname, row.pvalue, row.devicetype, configoptions);
                                    const ahubindex = row.hubid;
                                    let hubname = "None";
                                    hubs.forEach(hub => {
                                        if ( hub.id === ahubindex ) {
                                            hubname = hub.hubname;
                                        }
                                    });
                                    row.hubname = hubname;
                                }
                                devices[row.uid] = row;
                            });
                        }
                        return devices;
                    })
                    .catch(reason => {
                        console.error((ddbg()), "apiCall - getdevices: ", reason);
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            // read things tied to this user and panel
            // currently not used but available for API use
            case "getthings":
                if ( protocol==="POST" ) {
                    result = mydb.getRows("things", "*", "userid = " + userid)
                    .then(things => {
                        return things;
                    }).catch(reason => {
                        console.warn((ddbg()), "error attempting to get things: ", reason);
                        return null;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
                    
            case "filteroptions":
                if ( protocol==="POST" ) {
                    saveFilters(userid, body["useroptions"], body["huboptpick"]);
                    result = "saved filters for hubs";
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
            break;

            case "savedevices":
                if ( protocol==="POST" ) {
                    result = processDevices(userid, panelid, body);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "saveparams":
                if ( protocol==="POST" ) {
                    result = processParams(userid, panelid, body);
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "clipboard":
                if ( protocol==="POST" ) {
                    if ( swattr==="load" ) {
                        result = mydb.getRow("configs","*",`userid=${userid} AND configkey='clipboard'`)
                        .then(row => {
                            if ( row ) {
                                var configval = getConfigItem(row, "clipboard");
                                return configval;
                            } else {
                                return [];
                            }
                        })
                        .catch(reason => {
                            console.warn( (ddbg()), "Clipboard load error: ", reason );
                            return [];
                        });
                    } else {
                        result = swval;
                        var rulejson = JSON.stringify(swval);
                        var rulerow = {userid: userid, configkey: "clipboard", configval: rulejson, configtype: 0};
                        mydb.updateRow("configs", rulerow, `userid=${userid} and configkey='clipboard'`);
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

            case "deluser":
                result = Promise.all([
                    mydb.deleteRow("things","userid = "+userid),
                    mydb.deleteRow("devices","userid = "+userid),
                    mydb.deleteRow("rooms","userid = "+userid),
                    mydb.deleteRow("panels","userid = "+userid),
                    mydb.deleteRow("configs","userid = "+userid),
                    mydb.deleteRow("hubs","userid = "+userid),
                    mydb.deleteRow("users","userid = "+userid),
                    mydb.deleteRow("lists","userid = "+userid)
                ]).then(results => {
                    delCookie(res, "uname");
                    delCookie(res, "pname");
                    return "Account for user #" + userid + ", Username: " + uname + ", Email: " + useremail + " successfully removed.";
                }).catch(reason => {
                    var str = "error trying to remove account for user #" + userid + ", Username: " + uname + ", Email: " + useremail
                    console.error( (ddbg()), str, "\n", reason );
                    return str;
                });
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
            case "updcustom":
                if ( protocol==="POST" ) {
                    if ( body.rules ) {
                        var rules = JSON.parse(decodeURI(body.rules));
                    } else {
                        rules = null;
                    }
                    updCustom(userid, tileid, swid, swval, subid, subid, swtype, rules);
                    return rules;
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            // this api call invokes the rules manually
            // it is only used for duplicate variable entries for now
            case "dorules":
                result = mydb.getRow("devices","*", `userid = ${userid} AND deviceid = '${swid}'`)
                .then(device => {
                    var pvalue = decodeURI2(device.pvalue);
                    processRules(userid, device.uid, swid, swtype, subid, pvalue, false, "apiCall");
                    return pvalue;
                })
                .catch(reason => {
                    console.warn( (ddbg()), "warning: something went wrong with dorules: ", reason );
                    return "Something went wrong with dorules.";
                });
                break;

            // this clears the list without adding the current value
            // that must be done manually or through a smart home action
            case "resetlist":
                if ( protocol==="POST" ) {
                    result = mydb.deleteRow("lists",`userid = ${userid} AND deviceid = '${swid}' AND subid = '${subid}'`)
                    .then(res => {
                        var numListDel = res.getAffectedItemsCount();
                        return `Deleted ${numListDel} LIST rows for deviceid=${swid} and subid=${subid}`;
                    })
                    .catch(reason => {
                        console.error((ddbg()), "error attempting to reset list: ", reason);
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "geticons":
                result = getIcons(userid, pname, skin, swval, swattr);
                break;

            case "delimages":
                result = delImages(userid, pname, swval);
                break;

            case "setdefhub":
                // this sets the default hub in the users table
                // and sets the hubtimer in the hubs table
                // so that value can be updated without running OAUTH flow
                var usrobj = {defhub: swval};
                result = mydb.updateRow("users", usrobj, "id = "+userid)
                .then( ()=> {
                    var msg = `successfully set default hub to ${swval}`;
                    return msg;
                })
                .catch(reason => {
                    var msg = `Unable to set default hub to ${swval}`;
                    console.warn((ddbg()), msg, " reason: ", reason);
                    return msg;
                });
                break;

            // this api call starts the hub authorization process
            // the actual redirection to the first auth site is done in js file
            case "hubauth":

                if ( protocol==="POST" ) {

                    // now load the new data
                    // set result to blank for no errors to proceed with auth steps
                    result = "";
                    var hub = {};
                    hub["userid"] = userid;
                    hub["hubhost"] = body.hubhost;
                    hub["hubtype"] = body.hubtype;
                    hub["hubname"] = body.hubname;
                    hub["hubtimer"] = body.hubtimer;

                    // useraccess is always used for the access token now
                    // userendpt is the password for ISY hubs and the AppID for Hubitat
                    // the actual endpt is determined from these values
                    const appID = body.userendpt;
                    hub["useraccess"] = body.useraccess;
                    hub["userendpt"] = appID;
                    hub["hubrefresh"] = "";

                    // make a random hubid if this hub doesn't exist - this will be replaced if a Hubitat hub
                    var hubid = body.hubid;
                    if ( hubid==="" || hubid==="new" ) {
                        // var rstr = getRandomInt(1001, 9999);
                        // hubid = hub.hubtype + rstr.toString();
                        hubid = hub.hubtype + "_new";
                    }
                    hub["hubid"] = hubid;

                    // if no name given, give it one but know that it will be overwritten if OAUTH flow occurs
                    if ( hub.hubname.trim()==="" ) {
                        hub.hubname = hub.hubtype + " Home";
                    }

                    // if ISY hub, clean up host info
                    if ( hub.hubtype==="ISY" ) {

                        // make sure we start with http
                        if ( !hub.hubhost.toLowerCase().startsWith("http") ) {
                            hub.hubhost = "https://" + hub.hubhost;
                        }
                        // check for a user port and if missing use default 8443 port
                        if (hub.hubhost.indexOf(":", 8) === -1 ) {
                            hub.hubhost = hub.hubhost + ":8443";
                        }

                        // set the hub access info
                        hub.hubaccess = hub.useraccess + ":" + hub.userendpt;
                        hub.hubendpt = hub.hubhost + "/rest";

                    } else if ( hub.hubtype==="Hubitat") {
                        // fix up host if http wasn't given
                        // handle case for server vs local device
                        if ( hub.hubhost && typeof hub.hubhost === "string" && !hub["hubhost"].toLowerCase().startsWith("http") ) {
                            if ( hub["hubhost"].startsWith("housepanel.net") ) {
                                hub.hubhost = "https://" + hub["hubhost"];
                            } else {
                                hub.hubhost = "http://" + hub["hubhost"];
                            }
                        }

                        // now set the endpoint based on the AppID provided
                        hub.hubaccess = hub.useraccess;
                        if (hub["hubhost"].startsWith("https://cloud")) {
                            hub.hubendpt = hub.hubhost + "/apps/" + appID;
                        } else {
                            hub.hubendpt = hub.hubhost + "/apps/api/" + appID;
                        }

                    } else {
                        // set an error result to skip auth steps
                        result = "error - invalide hub type: " + hub.hubtype + " in hubauth. Only ISY and Hubitat hubs are supported.";
                        console.error((ddbg()), "Invalid hub: ", hub);
                    }

                    if ( result==="" ) {
                        // check if hub exists
                        const cond2 = `userid = ${userid} AND hubid = '${hubid}'`;
                        result = mydb.getRow("hubs", "*", cond2)
                        .then(row => {
                            if ( row ) {
                                hub.id = row.id;
                                hub.hubid = row.hubid;
                                hub.hubname = row.hubname;
                                return hub;
                            } else {
                                // add a placeholder hub that we update later in updateHub function
                                return mydb.addRow("hubs", hub, "userid = " + userid)
                                .then(res => {
                                    hub.id = res.getImpactedId();
                                    return hub;
                                })
                            }
                        })
                        .then(ahub => {
                            if ( DEBUG2 ) {
                                console.log((ddbg()), "authhub: ", ahub );
                            }
                            // update the hub that was added above
                            return getHubObj(ahub);
                        })
                        .catch(reason => {
                            console.error((ddbg()), "error attempting to authorize a hub: ", reason);
                            return "error - something went wrong when attempting to authorize a hub. Please try again.";
                        });
                    }
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;
        
            case "hubdelete":
                if ( protocol === "POST" ) {
                    result = Promise.all([
                        mydb.deleteRow("hubs", "userid = "+userid+" AND id = " + hubindex),
                        mydb.deleteRow("devices", "userid = "+userid+" AND hubid = " + hubindex),
                        mydb.updateRow("users", {defhub: "-1"}, "id = " + userid)
                    ])
                    .then(results => {
                        var numHubDel = results[0].getAffectedItemsCount();
                        var numDevDel = results[1].getAffectedItemsCount();
                        if ( numDevDel > 0 ) {
                            removeDeadThings(userid);
                        }
                        return "Removed " + numHubDel + " hubs and " + numDevDel + " devices";
                    })
                    .catch( reason => {
                        console.error((ddbg()), "error attempting to remove hub: ", reason);
                        return "error - could not remove hub with hubindex = " + hubindex;
                    });
                } else {
                    result = "error - api call [" + api + "] is not supported in " + protocol + " mode.";
                }
                break;

            case "getclock":
                var conditions = `userid=${userid} AND deviceid='${swid}'`;
                var clock;
                // result = mydb.getRow("devices", "*", conditions)
                result = Promise.all([
                    mydb.getRow("devices","*", conditions),
                    mydb.getRows("configs","*", "userid = " + userid + " AND configtype=1")
                ])
                .then(rows => {
                    const device = rows[0];
                    const configoptions = rows[1];
                    if ( !device ) throw "Clock device not found for deviceid = " + swid;
                    clock = getClock(swid);
                    clock = getCustomTile(userid, configoptions, clock, swid);
                    clock = getFileName(userid, pname, clock, device.devicetype, configoptions);
                    
                    // handle rules and time format user fields
                    processRules(userid, device.uid, swid, "clock", "time", clock, false, "apiCall" );
                    device.pvalue = encodeURI2(clock);
                    return mydb.updateRow("devices", device, conditions, true);
                })
                .then(res => {
                    // this is where we do things that happen on the hour, day, week, month, or year
                    // note that everything is 0 based except for getDate() which is 1 ... 31
                    // trigger the hourly if the minute is anywhere in the first 1 minute of the hour
                    // this could cause some events to be zeroed out but it ensures we don't miss an hour
                    if ( swid === "clockdigital" ) {
                        var d = new Date();
                        var minute = d.getMinutes();
                        var hour = d.getHours();
                        var day = d.getDate();
                        var dayofweek = d.getDay();
                        var month = d.getMonth();
                        if ( month === 0 && day === 1 && hour === 0 && minute <= 1 ) {
                            resetList(userid, "y");
                        } else if ( day === 1 && hour === 0 && minute <= 1 ) {
                            resetList(userid, "m");
                        } else if ( dayofweek === 0 && hour === 0 && minute <= 1 ) {
                            resetList(userid, "w");
                        } else if ( hour === 0 && minute <= 1 ) {
                            resetList(userid, "d");
                        } else if ( minute <= 1 ) {
                            resetList(userid, "h");
                        }
                    }
                    if ( DEBUG2 ) {
                        console.log((ddbg()), clock);
                    }
                    return clock;
                })
                .catch(reason => {
                    console.warn((ddbg()), "Problem encountered attempting to update the clock: ", reason);
                    return null;
                });
                break;

            case "cancelauth":
            case "showoptions":
            case "showid":
            case "reauth":
            case "logout":
            case "trackupdate":
                    var result = "error - [" + api + "] API call is no longer supported";
                    console.warn((ddbg()), result);
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

// do reset on LIST based on timing type
function resetList(userid, timing) {
    mydb.getRows("configs","*",`userid=${userid} AND configtype=1 AND configval LIKE '%["LIST",%'`)
    .then(rows => {
        if ( rows ) {
            rows.forEach(row => {
                var configkey = row.configkey;
                var deviceid = configkey.substring(5);
                var thelists = decodeURI2(row.configval);
                thelists.forEach(alist => {
                    if ( alist[0] === "LIST" ) {
                        var content = alist[1];
                        var subid = alist[2];
                        var arr = parseCustomizeContent(0, content);
                        var targettype = arr[2];
                        if ( timing === targettype ) {
                            mydb.deleteRow("lists",`userid = ${userid} AND deviceid = '${deviceid}' AND subid = '${subid}'`)
                            .then( res2=> {
                                var numListDel = res2.getAffectedItemsCount();
                            })
                            .catch(reason => {
                                console.error( (ddbg()), "error attempting to reset list: ", reason );
                            });
                        }
                    }
                });
            });
        }
    })
    .catch(reason => {
        console.warn( (ddbg()), "Could not reset list for user: ", userid, " reason: ", reason );
    })
}

// hpserver to client communication
var clients = {};
const freeConnIds = [];
let nextConnId = 1; 

function allocConnId() {
  return freeConnIds.length ? freeConnIds.pop() : nextConnId++;
}

function freeConnId(id) {
    // guard against invalid ids and duplicates
    // only add back to free list if it's a positive integer and not already in the free list
    if (Number.isInteger(id) && id > 0 && !freeConnIds.includes(id)) {
        freeConnIds.push(id);
    }
}

// setup socket between server and all user browsers
function setupBrowserSocket() {
    // var wsServer;
    var wsServer;
    const wsport = GLB.webSocketServerPort;

    // create the HTTP server for handling sockets
    // support insecure and secure sockets to deal with ISY which is insecure
    if ( fs.existsSync("housepanel_server.key") && fs.existsSync("housepanel_server.crt") && fs.existsSync("housepanel_server.ca") ) {
        var key = fs.readFileSync("housepanel_server.key");
        var crt = fs.readFileSync("housepanel_server.crt");
        var cabundle = fs.readFileSync("housepanel_server.ca");
        var credentials = {key: key, cert: crt, ca: cabundle};
        GLB.insecure = false;
        const server = https.createServer(credentials, function() {});
        wsServer = new webSocketServer({httpServer: server});
        console.log( (ddbg()), "Secure webSocket Server is listening on port: ", wsport);
        server.listen(wsport, "0.0.0.0", function() {} );
    } else {
        GLB.insecure = true;
        const server = http.createServer(function() {});
        wsServer = new webSocketServer({httpServer: server});
        console.log( (ddbg()), "Insecure webSocket Server is listening on port: ", wsport);
        server.listen(wsport, "0.0.0.0", function() {} );
    }

    // This function handles new connections, messages from connections, and closed connections
    // changed this logic to use multiple servers with only one client per server for any given user
    // for ( var i=0; i < wsServers.length; i++ ) {

        // var wsServer = wsServers[i];

        wsServer.on('request', function(wsrequest) {
            console.log( (ddbg()), 'Requesting websocket connection: ', wsrequest.requestedProtocols );
            if ( wsrequest.requestedProtocols[0] === "housepanel" ) {
                wsrequest.accept("housepanel", wsrequest.origin); 
            } else {
                console.warn( (ddbg()), "Websocket connection rejected due to invalid protocol. Requested protocols: ", wsrequest.requestedProtocols);
                wsrequest.reject(403, "Invalid protocol. Must use 'housepanel' protocol to connect.");
            }
        });

        wsServer.on('connect', function(connection) {
            console.log( (ddbg()), "Connecting websocket, protocol: ", connection.protocol, " Address: " , connection.socket.remoteAddress );

            // shut down any existing connections to same remote host
            var browserurl = connection.socket.remoteAddress;
            var wsport = connection.socket.server["_connectionKey"];

            const connId = allocConnId();
            connection.connId = connId;
            console.log( (ddbg()), "New connection from url: ", browserurl, " port: ", wsport, " assigned connId: ", connId );

            // add a timer to report no connection message after 5 seconds if we don't get a message from the browser with the userid
            const connectTimer = setTimeout(function() {
                console.warn( (ddbg()), "No message received from browser at ", browserurl, " port: ", wsport, " after 5 seconds. Closing connection.");
                connection.close();
            }, 5000);

            // wait for message from browser telling us what user id this is
            connection.on("message", function(msg) {
                if ( msg.type==="utf8" ) {
                    var userid = parseInt(msg.utf8Data, 10);

                    // add this connection to our clients object with the userid and browser info
                    // we will use this to send updates to the browser and also to identify which user is connected from which browser 
                    connection.userid = userid;
                    clients[connId] = {
                        id: connId, 
                        userid: userid,
                        conn: connection,
                        browserurl: browserurl,
                        wsport: wsport,
                        established: Date.now()
                    };

                    // renumber this user's clients from 1 to n where n is the number of clients for this user - this is used for logging and identifying old vs new connections
                    let userConnCount = Object.keys(clients).filter(key => clients[key].userid === userid).length;
                    console.log( (ddbg()), "Registered connection for user: ", userid," ConnId: ", connId, "of", userConnCount, "total connections for this user" );

                    // now send the connId for this connection back to the browser
                    pushClient(userid, "websocket", "opened", connId, {"connId": connId, "established": clients[connId].established} );

                    // clear the timer since we got a message from the browser and we know the userid now
                    clearTimeout(connectTimer);
                }
            });

            connection.on("error", function(err) {
                console.log( (ddbg()), "Connection dropped. Browser most likely closed or went away.");
                if ( DEBUG17) {
                    console.log( (ddbg()), "Connection drop details: ", err);
                }
            });
        
            // user disconnected - remove just one client that match this socket
            connection.on('close', function(reason, description) {
                const connId = connection.connId;
                const host = connection.socket.remoteAddress;
                const port = connection.socket.server["_connectionKey"];
                const userid = connection.userid;
                console.log( (ddbg()), "Client at url: ", host, " port: ", port, " user: ", userid, " disconnected. for reason: ", reason, " description: ", description);

                pushClient(userid, "websocket", "closed", connId );

                // remove the client from the clients object
                if ( connId ) {
                    freeConnId(connId);
                }
                if ( connId && clients[connId] ) {
                    console.log( (ddbg()), "Removed connection for user: ", userid, " client id: ", connId, " browserurl: ", clients[connId].browserurl, 
                                            " port: ", clients[connId].wsport, " established: ", new Date(clients[connId].established).toLocaleString() );
                    delete clients[connId];
                } else {
                    console.warn( (ddbg()), "Could not find client to remove for user: ", userid, " host: ", host, " port: ", port);
                }
            });
        });
    // }
}

function setupISYSocket() {
    
    // make websocket connection to any ISY hub
    // communication from ISY happens over a real webSocket
    var wshost;

    // close all existing connections
    for (var hubid in wsclient) {
        if ( wsclient[hubid] && typeof wsclient[hubid].close === "function" ) {
            wsclient[hubid].close();
        }
    }
    wsclient = {};

    // get all the ISY hubs for every user - this assumes no two users use the same ISY hub
    mydb.getRows("hubs","*","hubtype = 'ISY'")
    .then(hubs => {
        hubs.forEach(hub => {

            var userid = hub.userid;
            var hubid = hub.hubid;
            wshost = false;
            if ( hub["hubtype"]==="ISY" && hub["hubhost"] && hub["hubaccess"] && hub["hubendpt"] ) { 

                var hubhost = hub["hubhost"];
                if ( hubhost.startsWith("https://") ) {
                    wshost = "wss://" + hubhost.substr(8);
                } else if ( hubhost.startsWith("http://") ) {
                    wshost = "ws://" + hubhost.substr(7);
                }
            }

            // set up socket for ISY hub if one is there
            if ( wshost ) {
                var access_token = hub.hubaccess;
                var buff = Buffer.from(access_token);
                var base64 = buff.toString('base64');
                var origin = "com.universal-devices.websockets.isy";
                var header = {"Authorization": "Basic " + base64, "Sec-WebSocket-Protocol": "ISYSUB",  
                                "Sec-WebSocket-Version": "13", "Origin": origin};
                wshost = wshost + "/rest/subscribe";
                var opts = {rejectUnauthorized: false};
                var wsconfigs = {tlsOptions: opts, closeTimeout: 2000};
                var wsone = new webSocketClient(wsconfigs);
                wsclient[hubid] = wsone;
                wsone["userid"] = userid;
                wsone["hubid"] = hubid;

                wsone.connect(wshost, "ISYSUB", origin, header, opts);
                wsone.on("connectFailed", function(err) {
                    console.warn( (ddbg()), "Connection failure to ISY socket: ", err.toString(), " wshost:", wshost, " header:", header);
                });
            
                wsone.on("connect", function(connection) {
                    var that = this;
                    console.log( (ddbg()), "Success connecting to ISY socket. Listening for messages from hub:", that.hubid);
            
                    // handle incoming state messages from ISY
                    connection.on("message", function(msg) {
                        if ( msg.type==="utf8" ) {
                            processIsyXMLMessage(that.userid, msg.utf8Data);
                        }
                    });
                
                    connection.on("error", function(err) {
                        console.warn( (ddbg()), "Connection dropped to ISY socket: ", err);
                    });
                
                    connection.on("close", function(reasonCode, description) {
                        console.log( (ddbg()), "ISY socket closed for hub: ", that.hubid," reason: ", reasonCode, description );
                    });
                
                });
            }
        });
    }).catch(reason => {
        console.error( (ddbg()), "ISY socket setup failure: ", reason);
    });
}

function buildDatabaseTable(tableindex) {
    const tableData = [
          `CREATE TABLE configs (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            configkey TEXT NULL,
            configval TEXT NULL,
            configtype INTEGER DEFAULT 1
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
          )`,
          
          `CREATE TABLE lists (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            userid INTEGER NOT NULL,
            deviceid TEXT NULL,
            subid TEXT NULL,
            ltime TEXT NULL,
            lvalue TEXT NULL
          )`

    ];
    mydb.query(tableData[tableindex])
    .then( reason => {
        console.log( (ddbg()), "HousePanel database tables created or verified successfully");
    })
    .catch(reason => {
        console.error( (ddbg()), "error building database tables: ", reason );
    })
}

// ***************************************************
// beginning of main routine
// ***************************************************

// get the home directory of the app
GLB.homedir = __dirname;

// default behavior is no new user validation
GLB.dbinfo = {
    "dbhost": "localhost",
    "dbname": GLB.homedir+"/housepanel.db",
    "dbuid": "housepanel",
    "dbpassword": "housepanel",
    "dbtype": "sqlite",
    "port": "8580",
    "websocketport": "10430",
    "allownewuser" : ["all"],
    "service": "none",
    "enablerules": true,
    "donate": true
};
GLB.dbinfo.hubs = { Hubitat: "Hubitat", ISY: "ISY" };

// this object will be used to replace anything with a user choice
GLB.dbinfo.subs = {};

// read config file if one exists
try {
    var configname = GLB.homedir + "/housepanel.cfg";
    var newinfo = JSON.parse(fs.readFileSync(configname,"utf8"));
    for (var key in newinfo) {
        GLB.dbinfo[key] = newinfo[key];
    }
} catch (e) {}

if ( GLB.dbinfo["twilio_sid"] && GLB.dbinfo["twilio_token"] && GLB.dbinfo["twilio_service"] ) {
    var twilioSid =  GLB.dbinfo["twilio_sid"];
    var twilioToken =  GLB.dbinfo["twilio_token"];
    var twilioService = GLB.dbinfo["twilio_service"];
    var twilioClient = require('twilio')(twilioSid, twilioToken); 
} else {
    twilioService = null;
    twilioClient = null;
}

GLB.port = parseInt(GLB.dbinfo["port"]);
GLB.webSocketServerPort = parseInt(GLB.dbinfo["websocketport"]);

var port = GLB.port;
GLB.newcss = {};

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
            console.warn( (ddbg()), "error attempting to start secure server. Falling back to using an insecure server. Warning msg: ", e);
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
    console.error( (ddbg()), "HousePanel server could not be started at location: ", dir, " on port: ", port);
    app = null;
    applistening = false;
}

// retrieve all nodes/things
// client pages are refreshed when each hub is done reading
// the dbtype parameter controls whether we use mySQL or SQLITE engines
// these are the only two choices - if something else given, sqlite is used
// *** warning *** mysql has not been tested with the most recent updates
if ( app && applistening ) {

    var mydb = new sqlclass.sqlDatabase(GLB.dbinfo.dbhost, GLB.dbinfo.dbname, GLB.dbinfo.dbuid, GLB.dbinfo.dbpassword, GLB.dbinfo.dbtype);
    
    // build the tables if they are not there
    // rewrote this using pragma which is better and faster than what I did previously
    const tables = ["configs", "devices","hubs", "panels", "rooms", "things", "users", "lists"];
    let addedtables = 0;

    // select name from pragma_table_list where schema = 'main' and  not name like 'sqlite%'
    mydb.getRows("pragma_table_list","name","schema = 'main' AND NOT name LIKE 'sqlite%'")
    .then(rows => {
        var dbtables = [];
        rows.forEach(row => {
            dbtables.push(row.name);
        });
            
        for (let i in tables) {
            if ( dbtables.includes(tables[i]) ) {
                // check configs for updating schema to include new configtype column
                if ( tables[i] === "configs" ) {
                    mydb.getRows("pragma_table_info('configs')")
                    .then(rows => {
                        var ctcol = false;
                        rows.forEach(row => {
                            ctcol = ctcol || (row.name === "configtype"); 
                        });
                        if ( ctcol===false ) {
                            addedtables++;
                            const qstr1 = "ALTER TABLE configs ADD COLUMN configtype INTEGER DEFAULT 1";
                            const qstr2 = "update configs set configtype = 0 where configkey = 'useroptions' OR configkey not like 'user%'";
                            mydb.query(qstr1)
                            .then(res => {
                                console.log( (ddbg()), "Added configtype column to configs table");
                                mydb.query(qstr2)
                                .then(res => {
                                    console.log( (ddbg()), "Updated types for configtype column to configs table");
                                });
                            })
                            .catch(reason => {
                                console.error( (ddbg()), "error updating the schema of the configs table: ", reason);
                            })
                        }
                    });
                }

                // update devices table if needed
                if ( tables[i] === "devices" ) {
                    mydb.getRows("pragma_table_info('devices')")
                    .then(rows => {
                        var ctcol = false;
                        rows.forEach(row => {
                            ctcol = ctcol || (row.name === "uid"); 
                        });
                        if ( ctcol===false ) {
                            mydb.query("ALTER TABLE devices ADD COLUMN uid INTEGER DEFAULT 0")
                            .then(res => {
                                addedtables++;
                                console.log( (ddbg()), "Updated the schema of the devices table by adding uid column");
                            })
                            .catch(reason => {
                                console.warn( (ddbg()), "error updating the schema of the devices table: ", reason);
                            })
                        }
                    });
                }

            } else {
                console.log( (ddbg()), "Table", tables[i], " not found. Building it now");
                addedtables++;
                buildDatabaseTable(i);
            }
        }
    })
    .then( () => {        
        // now replace useroptions with usroptions for legacy db's
        const qstr3 = "update configs set configkey = 'usroptions' where configkey = 'useroptions'";
        setTimeout(function() {
            mydb.query(qstr3)
            .then(res => {
                if ( res.getAffectedItemsCount() > 0 ) {
                    console.log( (ddbg()), "Updated useroption field to usroption for configtype column in configs table");
                }
            });
        }, addedtables * 3000);
    })
    .catch(reason => {
        console.error( (ddbg()), "error updating database: ", reason);
        exit(1);
    });

    if ( addedtables > 0 ) {
        setTimeout(function() {
            console.log( (ddbg()), "Updated the database after building or modifying ", addedtables, " tables...");
        }, addedtables * 3000);
    }
    
    // set up sockets
    setupBrowserSocket();
    if ( EMULATEHUB!==true ) {
        setupISYSocket();
    }

    // handler functions for HousePanel
    // this is where we render the baseline web page for the dashboard

    app.get('*', function (req, res) {

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
                    console.error( (ddbg()), "User activation failed: ", reason);
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

            if ( DEBUG20 ) {
                console.log( (ddbg()), "username results: ", results);
            }

            if ( !results || !results["users_id"] ) {
                console.warn( (ddbg()), "login rejected for user: ", results);
                var result = getLoginPage(req, 0, "", "", "", hostname);
                res.send(result);
                res.end();
        
            } else {

                var user = results;
                var userid = user["users_id"];
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

                        // if a GET API call is being made do it here
                        if ( isquery ) {
                            var result = apiCall(user, queryobj, "GET", res);
                            // if ( typeof result === "object" && result.then && typeof result.then === "function" ) {
                            if ( typeof result === "object" ) {
                                try {
                                    result.then(obj => {
                                        res.send(obj);
                                        res.end();
                                    });
                                } catch(e) {
                                    res.json(result);
                                    res.end();
                                }
                            } else if ( typeof result === "string" ) {
                                res.send(result);
                                res.end;
                            } else {
                                var reason = "Invalid API call or API returned an unrecognized data type";
                                res.send(reason);
                                res.end();
                            };

                        // this is what makes the main page
                        } else {
                            getMainPage(user, configoptions, hubs, req, res);
                        }

                    } else if ( req.path==="/showid" ) {
                        getInfoPage(user, configoptions, hubs, req)
                        .then(result => {
                            res.send(result);
                            res.end();
                        });

                    } else if ( req.path==="/showoptions") {
                        result = getParamsPage(user, configoptions, req)
                        res.send(result);
                        res.end();

                    } else if ( req.path==="/editdevices") {
                        getDevicesPage(user, configoptions, hubs, req)
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

                    } else if ( req.path==="/userauth") {
                        var defaultHub = getCookie(req, "defaultHub");
                        getAuthPage(user, configoptions, hubs, req.headers.host, defaultHub)
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
                            res.send(req.path + " is an invalid HousePanel API call");
                            res.end();
                            // res.status(404).end(req + ' Not found');
                        });
                    }

                });

            }

        }).catch(reason => {
            console.error( (ddbg()),"HousePanel startup error: ", reason);
            var result = getLoginPage(req, 0, "", "", "", hostname);
            res.send(result);
            res.end();
        });
    });
    
    app.put('*', function(req, res) {
        console.warn( (ddbg()), "PUT api calls are not supported. Use POST instead. Requested put: ", req.path);
        res.send("PUT api calls are not supported. Use POST instead.");
        res.end();
    });

    // *********************************************************************************************
    // POST api calls are handled here including those sent from HE hubs
    // to process changes made outside of HP
    // from Hubitat hubs this is done in the "changeHandler" function
    // body fields are in the HousePanel.groovy application with this Map
    // Map abody = [
    //     msgtype: msgtype,
    //     hubid: state.hubid,
    //     change_name: name,
    //     change_device: id,
    //     change_attribute: subid,
    //     change_type: type,
    //     change_value: value
    // ]
    // *********************************************************************************************
    app.post("/", function (req, res) {

        // get user name
        var hubid;
        var userid;
        var api = req.body["api"] || req.body["useajax"] || "";
        const logincalls = ["forgotpw", "createuser", "validateuser", "updatepassword", "dologin" ];

        // handle initialize events from Hubitat here
        if ( req.path==="/" && req.body['msgtype'] === "initialize" ) {
            hubid = req.body['hubid'] || null;
            if ( hubid ) {
                // update the devices of all hubs matching this hubid regardless of the user
                // each user's hub should have a unique hubid so this works fine
                // with the new groovy app we also can now update the AccessToken and hubEndpt values based on what was pushed back
                // if these values are not present then user has not updated to the latest version so we ignore
                // this update does not work for new hubs about to be authorized because they are not yet in the DB and they don't have a hubid
                 mydb.getRows("hubs","*", `hubid = '${hubid}'`)
                .then(hubs => {
                    if ( !hubs ) {
                        throw "Invalid hub returned from HousePanel groovy app";
                    }

                    hubs.forEach(hub => {

                        // handle Hubitat hub update pushes
                        userid = hub.userid;
                        var updhub = false;
                        if ( req.body['change_type'] === "Hubitat" && req.body['change_value'] && is_object(req.body['change_value']) ) {

                            // this is the mapping of valarray from the groovy app
                            // Map value = ["accesstoken": state.accessToken, "appid": app.id, "hubname": state.hubname, "hubid": state.hubid,
                            //              "cloudendpt": state.cloudendpt, "localendpt": state.endpt, "hubtimer": "0", "hpcode": hpcode, "usecloud": usecloud]
                            const valarray = req.body['change_value'];

                            // init sends hub name in the change_name field
                            if ( valarray.hubname ) {
                                updhub = updhub || (hub.hubname !== valarray.hubname);
                                hub.hubname = valarray.hubname;
                            }

                            // init sends the AppID as the id in change_device field
                            // note - the userendpt field is now used to store the App ID only
                            if ( valarray.appid  ) {
                                updhub = updhub || (hub.userendpt !== valarray.appid);
                                hub.userendpt = valarray.appid.toString();
                            }

                            // update access token
                            updhub = updhub || (hub.hubaccess !== valarray.accesstoken);
                            hub.hubaccess = valarray.accesstoken;

                            // set default endpt based on usecloud boolean
                            if ( valarray.usecloud === true || valarray.cloudendpt === "true" ) {
                                updhub = updhub || (hub.hubendpt !== valarray.cloudendpt);
                                hub.hubendpt = valarray.cloudendpt;
                            } else {
                                updhub = updhub || (hub.hubendpt !== valarray.localendpt);
                                hub.hubendpt = valarray.localendpt;
                            }

                            // determine the hostname from the endpt
                            var iloc = hub.hubendpt.indexOf("/apps");
                            var newhost = hub.hubendpt.substring(0, iloc);

                            updhub = updhub || (hub.hubhost !== newhost);
                            hub.hubhost = newhost;
                        }

                        // update the hub and push data to the auth page using a forced reload
                        if ( updhub ) {
                            mydb.updateRow("hubs", hub, "id = " + hub.id)
                            .then( ()=> {
                                return removeHublessDevices(userid)
                            })
                            .then(numremoved => {
                                if ( DEBUG1 ) {
                                    console.log( (ddbg()), "Removed ", numremoved," devices");
                                }
                                if ( numremoved > 0 ) {
                                    pushClient(userid, "reload", "all", "/");
                                }
                            })
                            .catch(reason => {
                                console.error( (ddbg()), reason);
                            });
                        } else if (hub) {
                            removeHublessDevices(userid)
                            .then(numremoved => {
                                if ( DEBUG1 ) {
                                    console.log( (ddbg()), "Removed ", numremoved," devices");
                                }
                                return getDevices(hub)
                            })
                            .then(mydevices => {
                                var numdevices = Object.keys(mydevices).length;
                                var devices = Object.values(mydevices);
                                if ( DEBUG1 ) {
                                    console.log( (ddbg()), "initialized ", numdevices," devices. devices: ", jsonshow(devices));
                                }
                                return removeDeadThings(userid)
                            })
                            .then(numdelthings => {
                                if ( DEBUG1 ) {
                                    console.log( (ddbg()), "Removed ", numdelthings," things");
                                }
                                pushClient(userid, "reload", "all", "/");
                            })
                            .catch(reason => {
                                console.error( (ddbg()), reason);
                            });
                        }                                
                    });
                })
                .catch(reason => {
                    console.error( (ddbg()), "initialize hub error: ", reason);
                });

                res.send("hubid processed successfully");
            } else {
                res.send("Invalid hubid not processed");
            }
            res.end();

        // handle config events from Hubitat here
        } else if ( req.body['msgtype'] === "config" ) {
            // use this to push new data to the config page
            const userid = req.body["change_device"];
            const configvals = req.body["change_value"];
            let configupdated = false;
            for (var key in configvals) {
                configupdated = configupdated || (GLB.dbinfo[key] !== configvals[key]);
                GLB.dbinfo[key] = configvals[key];
            }

            // now write the updated config values to the housepanel.cfg file
            if ( configupdated ) {
                try {
                    var configname = GLB.homedir + "/housepanel.cfg";
                    fs.writeFileSync(configname, JSON.stringify(GLB.dbinfo, null, 4), "utf8");
                } catch (e) {
                    console.error( (ddbg()), "error writing housepanel.cfg file: ", e);
                }
            }

            if ( DEBUG17 ) {
                console.log( (ddbg()), "Received hub configuration data for user ", userid, ": ", jsonshow(configvals) );
            }
            res.send("New hub configuration received and processed");
            res.end();

        // this is where we receive the push from groovy to populate a new hub
        // we send it to the browser of the userid specified
        } else if ( req.body['msgtype'] === "authupd" ) {
            // use this to push new data to the auth page
            const userid = req.body["change_device"];
            const swtype = req.body["change_type"];
            const subid = req.body["change_attribute"];
            const pvalue = req.body["change_value"];
            pushClient(userid, "authupd", swtype, subid, pvalue);
            res.send("New hub auth information received and processed");
            res.end();

        // handle msg events from Hubitat here
        // these message can now only come from Hubitat since ST groovy is gone
        } else if ( req.body['msgtype'] === "update" ) {
            if ( DEBUG12 ) {
                console.log( (ddbg()), "Received update msg from hub: ", req.body["hubid"], " msg: ", jsonshow(req.body));
            }
            hubid = req.body['hubid'];
            if ( hubid && hubid!=="-1" ) {
                mydb.getRows("hubs","*","hubid = '" + hubid + "'")
                .then(hubs => {
                    if ( hubs ) {
                        hubs.forEach(hub => {
                            processHubMessage(hub.userid, req.body, false);
                        });
                    }
                }).catch(reason => {
                    console.warn( (ddbg()), "Hubitat hub retrieval error: ", reason);
                });
            }
            res.send("Hub msg received and processed");
            res.end();       

        // handle the login api function calls
        // handle them differently than others because there is no user to validate
        // however we skip validateuser because that will have the proper userid and hpcode included
        // note that dologin and forgotpw use the same form tagged to id = loginform
        // th 
        } else if ( logincalls.includes(api) && req.body["apiSecret"]===GLB.apiSecret ) {
            var result = null;
            switch (api) {
                case "dologin":
                    result = doLogin(req.body, res);
                    break;
                case "forgotpw":
                    result = forgotPassword(req.body);
                    break;
                case "createuser":
                    result = createUser(req.body);
                    break;
                case "validateuser":
                    result = validateUser(req.body);
                    break;
                case "updatepassword":
                    result = updatePassword(req.body);
                    break;
            }
            try{
                if ( result && typeof result === "object" && result.then && typeof result.then === "function" ) {
                    result.then(obj => {
                        if ( DEBUG1 ) {
                            console.log( (ddbg()), "login function promise returned for api: ", req.body["api"] );
                        }
                        res.json(obj);
                        res.end();
                    });
                } else if ( typeof result === "string" ) {
                    if ( DEBUG1 ) {
                        console.log( (ddbg()), "login function string returned: ", api, " = ", result );
                    }
                    res.send(result);
                    res.end;
                } else if ( typeof result === "object") {
                    if ( DEBUG1 ) {
                        console.log( (ddbg()), "login function object returned: ", api, " = ", result );
                    }
                    res.json(result);
                    res.end();
                } else {
                    console.error( (ddbg()), "Invalid login request: ", result);
                    res.send("Invalid HousePanel login-related request");
                    res.end();
                };
            } catch(e) {
                console.error("error processing reset password: ", e);
                res.send("Fatal error in password reset");
                res.end();
            }
            
        // handle all api calls upon the server from js client and external api calls here
        // note - if user calls this externally then the userid and tileid values must be provided
        // most users won't know these values but they are shown on the showid page or when in edit mode
        // GET calls from a browser are easier because the cookie will be set
        // this means that user GET API calls can only be made from a device that has HP running on it
        // POST calls can be made from any platform as long as hpcode, the userid and tileid values are known
        } else if ( req.body["userid"] && api ) {

            // perform security check to prevent random POST calls
            // we do this by checking for valid user and hpcode matching what we have in the DB for this user
            // the advantage of this is we can get the user object for making api calls much easier
            // assuming the caller knows the userid and hpcode values
            userid = req.body["userid"];
            if ( req.body["pname"] ) {
               var pname = req.body["pname"] || "default";
            } else {
                pname = "default";
            }
            if ( isNaN(parseInt(userid)) ) {
                userid = -1;
            }
            var hpcode = req.body["hpcode"] || "";
            var joinstr = mydb.getJoinStr("panels", "userid", "users", "usertype");
            var fields = "users.id as users_id, users.email as users_email, users.uname as users_uname, users.mobile as users_mobile, users.password as users_password, " +
                         "users.usertype as users_usertype, users.defhub as users_defhub, users.hpcode as users_hpcode, " + 
                         "panels.id as panels_id, panels.userid as panels_userid, panels.pname as panels_pname, panels.password as panels_password, panels.skin as panels_skin";
            var conditions = `users.id = ${userid} AND panels.pname = '${pname}' AND users.hpcode = '${hpcode}'`;
            mydb.getRow("panels", fields, conditions, joinstr)
            .then( user => {
                if ( user ) {

                    // if api call returns a promise then handle it and return the promise result
                    // otherwise we have a direct result that we can return to the browser
                    // we don't pass the user here because it isn't in the proper format and we don't need it
                    var result = apiCall(user, req.body, "POST", res);
                    if ( typeof result === "object" && result.then && typeof result.then === "function" ) {
                        result.then(obj => {
                            if ( DEBUG1 ) {
                                console.log( (ddbg()), "apiCall promise returned: ", obj );
                            }
                            res.json(obj);
                            res.end();
                        });
                    } else if ( typeof result === "string" ) {
                        if ( DEBUG1 ) {
                            console.log( (ddbg()), "apiCall string returned: ", result );
                        }
                        res.send(result);
                        res.end;
                    } else if ( typeof result === "object") {
                        if ( DEBUG1 ) {
                            console.log( (ddbg()), "apiCall object returned: ", result );
                        }
                        res.json(result);
                        res.end();
                    } else {
                        console.warn( (ddbg()), "Invalid POST: ", result);
                        res.send("Invalid HousePanel POST request - check logs");
                        res.end();
                    };
        
                } else {
                    throw "User " + userid + " not found, or invalid hpcode = " + hpcode;
                }
            })
            .catch(reason => {
                console.warn( (ddbg()), "API Call [" + api + "] failed for User = " + userid + ". Security violation possible for hpcode = " + hpcode, " reason: ", reason );
                res.send("POST error on api call. Check Logs for detailed error messages");
                res.end();
            });

        // handle unknown requests
        } else {
            console.warn( (ddbg()), "HousePanel received an unknown POST with path: ", req.path, " body:", req.body);
            res.send("unknown message sent to HousePanel");
            res.end();
        }

    });

    // user multer to grab the file and the body sent to post
    var storage = multer.diskStorage({
        destination: function(req, file, callback) {
            var userid = req.query.userid;
            var pname = req.query.pname;
            var hpcode = req.query.hpcode;
            var category = req.query.category;
            var dest = "./user"+userid+"/"+pname;
            if ( category==="User_Icons" ) {
                dest += "/icons";
            } else if ( category==="User_Media" ) {
                dest += "/media";
            } else if ( category==="User_Photos" ) {
                dest += "/photos";
            } else {
                dest += "/media";
            }
            if ( DEBUG16 ) {
                console.log((ddbg()), "userid: ", userid, " pname: ", pname, " category: ", category, " hpcode: ", hpcode," dest: ", dest);
            }
            callback(null, dest);
        },
        filename: function(req, file, callback) {
            callback(null, file.originalname);
        }
    });

    const limitobj = {fileSize: 4096000};
    const upload = multer({storage: storage, limits: limitobj});
    app.post("/upload", upload.single("uploaded_file"), function(req, res){
        res.json(req.file);
        res.end();
    });

}
