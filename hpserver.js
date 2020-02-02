"use strict";
process.title = 'hpserver';

// debug options
var DEBUG1 = false;
var DEBUG2 = false;
var DEBUG3 = false;
var DEBUG4 = false;
var DEBUG5 = false;
var DEBUG6 = true;

// websocket and http servers
var webSocketServer = require('websocket').server;
var path = require('path');
var http = require('http');
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
// var parseString = require('xml2js').parseString;
var parser = require('fast-xml-parser');

var port = 3080;

// global variables are all part of GLB object plus clients and allthings
var GLB = {};
// list of currently connected clients (users)
var clients = [];
// array of all tiles in all hubs
var allthings = {};

// server variables
var server;
var wsServer;
var app;
var hpServer;
var applistening = false;
var serverlistening = false;

const devhistory = ` 
2.118      Fix bug that prevented user from changing custom tile count
2.117      Load jquery locally and include files in the distro
2.116      Tweaks to enable floor plan skins and bug fixes
2.115      Finalize audio track refresh feature and remove bugs
             - handle music tiles properly and remove test bug
2.114      Allow track to update on hub refresh for audio devices
             - updated modern skin to work with new Sonos DH
2.113      Remove bogus line in groovy code
2.112      Added audioNotification capability for new Sonos DH (draft)
             - fixed up login again and added feature to disable pws
2.111      Minor bugfixes to 2.110 hub auth separation
2.110      Major rewrite of auth flow to move options to options page
             - username and password are now on the options page
             - bug fixes in timer refresh logic
             - bug fix to tile width to include slider for bulbs and switches
             - add hub filter to options and tile catalog drag pages
2.109      Add options parameter to enable or disable rules since it can be slow
2.108      Modify Rule to enable multiple actions and require 'if: ' to flag if
2.107      New Rule feature that allows non-visual triggers to be added to any tile
2.106      Macro feature tested and fine tuned to return results in console log
             - tile editor name update fixed to prevent spurious page reloads
             - returns name on switches now for viewing with API; GUI still ignores
             - protect from returning password and name in the GUI everywhere
2.105      Minor bugfix for leak sensors that dont support wet & dry commands
2.104      Bug Fixes and API improvements
             - enable auto search for correct hub if omitted in API calls
             - fix spurious hub creation when reauthorization performed
             - enable blink properly when waiting for authorization
             - fix tile editor list and tile customizer for weather tiles
2.103      link tile query fix and media art fine tune
             - add default icons for water sensors and enable water actions
2.100      User specific skin support
             - add custom tiles to user account
             - now save user account files in true json format
             - fix query to linked items
             - improve album art search and support tunein items
2.092      Major update to documentation on housepanel.net
             - tweak info window when inspected near right edge
             - enable album art upon first change in song
2.091      Fix LINK for custom tile actions; bugfix album art for grouped speakers
2.090      Add curl call to gather usage statistics on central server
2.087      Minor formatting cleanup in show info routine
2.086      Update install script to support user skins and updates easily
            - remove hubtype from main array to save load time as it wasn't used
2.085      Clean up handling of custom names
2.084      Bugfix auth code to handle PHP installs without builtin functions
            - change minimum username length to 3 and look for admin name
            - drag drop name fix
2.083      Properly load things and options for use in GUI and other bug fixes
2.082      Fixed snarky bug in auth that reset hubpush ports and other things
            - did more cleanup and robusting of auth flow
2.081      Security lock down - no longer accept blanks to make new bogus user
            - reauth request via api if not logged in will return to login page
            - default user name not set to admin rather set to blank now
            - reauth page still available if options file is missing
            - reset code will also launch to auth page all the time if enabled
2.080      Remove blank customtile.css files to avoid overwriting user version
            - LINK customizer bugfix
            - minor bug fix of weather tile name
            - custom field image default CSS fix, misc code cleanup
            - show status when click on tiles that typically have no actions
            - speed up initial load after refresh page
2.078      Bugfixes to 2.076 and 2.077 - skin missing from tileeditor
            - fix long standing bug of duplicate Node.js clients
            - properly close sockets upon disconnect and remove dups
2.077      Remove http requirement for URL entries to enable intent links
2.076      Various password updates and fixes
            - add password support for tiles using the custom field feature
            - change main password from simple hash to strong algorithm
            - fix bug in the action buttons and links in clock tiles
            - remove reserved fields from hub push results
            - enabled return and cancel keys in popup dialog boxes
2.075      js Time bugfixes
            - finish implementing the sorting feature for user fields
            - speedup by avoiding reading options on each tile make
2.073      Major speedup in Tile Customizer (customize.js)
            - prep work for sorting feature - not yet implemented
            - minor bug fixes
2.072      Honor time format in js updates every second
            - merge in README clean up pull request
            - enable multiple things in a query request
            - minor bugfix for auto of non-groovy tiles
            - update hpapi.py demo to work with current version
2.071      Bypass cache for updated frames and other special tiles
            - minor bug fix to tile editor for tile name setting
            - fix bug where special tile count was not being saved
            - fix bug that screwed up max number of custom tiles
            - fix bug for page changes not sticking
2.070      Bugfixes to beta 2.065, code cleanup, ignore DeviceWatch-Enroll
            - includes error checking for bogus hub calls
            - also fixed hidden check in tile editor for fields that match type
            - handled obscure cases for refreshing special tiles properly
2.065      Migrate image and blank tiles over to php server side
            - provide user way to select city in AccuWeather
            - but user must find the Location Code first
2.064      Fix music control siblings and improve Album Art reliability
2.063      Implement music icons for native Echo Speaks and Generic music
2.062      Retain edit and custom names upon refresh; minor bug fixes
2.061      Custom frame and video tile name bugfix
2.060      Auto detect and grab artist, album title, and album art image
2.057      Minor cleanup including proper detection of hidden status in editor
2.056      Groovy file update only to specify event date format
2.055      Update version number in Groovy file and more error checking
2.054      Clean up groovy file; add direct mode action buttons
2.053      Misc bug fixes: LINK on/off; tile editor tweaks
           - new feature in Tile Editor to pick inline/blcok & absolute/relative
2.052      Really fixed clobber this time (in hubpush). Added portrait CSS support
2.051      Another run at fixing name clobber; update modern skin for flash
2.050      Fix cloberred custom names; fix Hubitat event reporting; add timezone
2.049      Time zone fix for real time javascript digital clock
           - add version number to main screen
2.048      Visual cue for clicking on any tile for 3/4 of a second
2.047      Clean up SHM and HSM to deliver similar display fields and bug fixes
2.046      Avoid fatal error if prefix not given, fix Routine bug in groovy, etc
2.045      Merge groovy files into one with conditional hub detector
2.042      Minor tweak to CSS default for showing history only on some things
           - add dev history to show info and auto create version info from this
           - add on and off toggle icons from modern to the default skin
           - doc images update
2.040      Four event fields added to most tiles for reporting (ST only for now)
2.031      Use custom name for head title and name field
2.030      Fix HSM and SHM bugs and piston styling for modern skin
2.020      Macro rule graduate from beta to tested feature - still no gui
2.010      Grid snap feature and fix catalog for modern skin
2.000      Release of rule feature as non beta. Fixed level and other tweaks
1.998      Macro rules implemented as beta feature. No easy GUI provided yet
1.997      Improve crude rule feature to only do push from last client
           minor performance and aesthetic improvements in push Node code
1.996      Fix hubId bug in push file
           implement crude rule capability triggered by custom tile use
           - if a motion sensor is added to a light it will trigger it on
           - if a contact is added to a light, open will turn on, close off
           - if another switch is added to a light, it will trigger it too
1.995      Update install script to properly implement push service setup
           remove .service file because install script makes this
           clean up hubid usage to use the real id for each hub consistently
           refresh screen automatically after user reorders tiles
1.992      Bugfix for swapping skins to enable new skin's customtiles
           this also changes the custom tiles comments to avoid dups
           minor tweaks to the modern skin and controller look
1.991      New modern skin and include door in classes from tile names
1.990      Final cleanup before public release of hubpush bugfixes
           move housepanel-push to subfolder beneath main files
           update housepanel-push to include more robust error checking
           Fixed bug in housepanel-push service causing it to crash
           Corrected and cleaned up install.sh script to work with hubpush
1.989      Continued bug fixing hubpush and auth flow stuff
1.988      Major bugfix to auth flow for new users without a cfg file
1.987      Bugfix for broken hubpush after implementing hubId indexing
           publish updated housepanel-push.js Node.js program
1.986      Minor fix to use proper hub name and type in info tables
1.985      Finish implementing hub removal feature
           - added messages to inform user during long hub processes in auth
           - position delete confirm box near the tile
           - minor bug fixes
1.983      2019-02-14
             bugfix in auth page where default hub was messed up
1.982      2019-02-14
             change hubnum to use hubId so we can remove hubs without damage
1.981      Upgrade to install.sh script and enable hub removal
1.980      Update tiles using direct push from hub using Node.js middleman
1.972      Add ability to tailor fast polling to include any tile
           by adding a refresh user field with name fast, slow, or never
           - also added built-in second refresh for clock tiles
           - two new floor lamp icons added to main skin
           - fix bug so that hidden items in editor now indicate hidden initially
1.971      Fix clicking on linked tiles so it updates the linked to tile
           - also fixes an obscure bug with user linked query tiles
1.970      Tidy up customizer dialog to give existing info
1.966      Enable duplicate LINK items and add power meter things
1.965      Restored weather icons using new mapping info
1.964      Updated documentation and tweak CSS for Edge browser
1.963      Improved user guidance for Hubitat installations
1.962      Bring Hubitat and SmartThigns groovy files into sync with each other
           and in the process found a few minor bugs and fixed them
1.961      Important bug fixes to groovy code for switches, locks, valves
1.960      New username feature and change how auth dialog box works
           - fixed error in door controller
1.953      Fix room delete bug - thanks to @hefman for flagging this
1.952      Finalize GUI for tile customization (wicked cool)
           - fix bug in Music player for controls
           - revert to old light treatment in Hubitat
1.951      Bug fixes while testing major 1.950 update
           - fix bug that made kiosk mode setting not work in the Options page
           - fix bug that broke skin media in tile edit while in kiosk mode
           - use the user config date formats before setting up clock in a refresh
1.950      Major new update with general customizations for any tile
           - this is a major new feature that gives any tile the ability to
             add any element from any other tile or any user provided text
             so basically all tiles now behave like custom tiles in addition
             to their native behavior. You can even replace existing elements
             For example, the analog clock skin can be changed now by user
             User provided URL links and web service POST calls also supported
             Any URL link provided when clicked will open in a new tab/window
           - fix weird bug in processing names for class types
           - added ability to customize time formats leveraging custom feature
           - now refresh frames so their content stays current
           - include blanks, clocks, and custom tiles in fast non-hub refresh
           - enable frame html file names to be specified as name in TileEdit
           - lots of other cleanups and bug fixes
1.941      Added config tile for performing various options from a tile
           - also fixed a bug in cache file reload for customtiles
1.940      Fix bug in Tile Editor for rotating icon setting and slower timers
1.930      Fix thermostat and video tag obscure bugs and more
           - chnage video to inherit size
           - change tile editor to append instead of prepend to avoid overlaps
           - increase default polling speed
           - first release of install script install.sh
1.928      Disallow hidden whole tiles and code cleanup
1.927      Added flourescent graphic to default skin, fix edit of active tile
1.926      Doc update to describe video tiles and minor tweaks, added help button
1.925      Various patches and hub tweaks
           - Hub name retrieval from hub
           - Show user auth activation data
           - Hack to address Hubitat bug for Zwave generic dimmers
           - Added border styling to TileEditor
1.924      Update custom tile status to match linked tiles
           Added option to select number of custom tiles to use (beta)
1.923      TileEditor updates
           - new option to align icons left, center or right
           - added images of Sonos speakers to media library
           - fixed bug where header invert option was always clicked
           - renamed Text Width/Height to Item Width/Height
1.922      Updated default skin to make custom reflect originals in more places
1.921      Hybrid custom tile support using hmoptions user provided input
1.920      CSS cleanup and multiple new features
           - enable skin editing on the main page
           - connect customtiles to each skin to each one has its own
             this means all customizations are saved in the skin directory too
           - migrated fixed portions of skin to tileedit.css
           - fix plain skin to use as skin swapping demo
           - various bug fixes and performance improvements
1.910      Clean up CSS files to prepare for new skin creation
1.900      Refresh when done auth and update documentation to ccurrent version
1.809      Fix disappearing things in Hubitat bug - really this time...
1.808      Clean up page tile editing and thermostat bug fix
1.807      Fix brain fart mistake with 1.806 update
1.806      Multi-tile editing and major upgrade to page editing
1.805      Updates to tile editor and change outside image; other bug fixes
1.804      Fix invert icon in TileEditor, update plain skin to work
1.803      Fix http missing bug on hubHost, add custom POST, and other cleanup
1.802      Password option implemented - leave blank to bypass
1.801      Squashed a bug when tile instead of id was used to invoke the API
1.80       Merged multihub with master that included multi-tile api calls
1.793      Cleaned up auth page GUI, bug fixes, added hub num & type to tiles 
1.792      Updated but still beta update to multiple ST and HE hub support
1.791      Multiple ST hub support and Analog Clock
1.79       More bug fixes
           - fix icon setting on some servers by removing backslashes
           - added separate option for timers and action disable
1.78       Activate multiple things for API calls using comma separated lists
           to use this you mugit stst have useajax=doaction or useajax=dohubitat
           and list all the things to control in the API call with commas separating
1.77       More bug fixes
            - fix accidental delete of icons in hubitat version
            - incorporate initial width and height values in tile editor
1.76       Misc cleanup for first production release
            - fixed piston graphic in tileeditor
            - fix music tile status to include stop state in tileeditor
            - added ?v=hash to js and css files to force reload upon change
            - removed old comments and dead code

1.75       Page name editing, addition, and removal function and reorder bug fixes
1.74       Add 8 custom tiles, zindex bugfix, and more tile editor updates
1.73       Updated tile editor to include whole tile backgrounds, custom names, and more
1.72       Timezone bug fix and merge into master
1.71       Bug fixes and draft page edit commented out until fixed
1.7        New authentication approach for easier setup and major code cleanup
1.622      Updated info dump to include json dump of variables
1.621      ***IMPT**bugfix to prior 1.62 update resolving corrupt config files
1.62       New ability to use only a Hubitat hubg
1.61       Bugfixes to TileEditor
1.60       Major rewrite of TileEditor
1.53       Drag and drop tile addition and removal and bug fixes
1.52       Bugfix for disappearing rooms, add Cancel in options, SmartHomeMonitor add
1.51       Integrate skin-material from @vervallsweg to v1.0.0 to work with sliders
1.50       Enable Hubitat devices when on same local network as HP
1.49       sliderhue branch to implement slider and draft color picker
1.48       Integrate @nitwitgit (Nick) TileEdit V3.2
1.47       Integrate Nick's color picker and custom dialog
1.46       Free form drag and drop of tiles
1.45       Merge in custom tile editing from Nick ngredient-master branch
1.44       Tab row hide/show capabilty in kiosk and regular modes
           Added 4 generally customizable tiles to each page for styling
           Fix 1 for bugs in hue lights based on testing thanks to @cwwilson08
1.43       Added colorTemperature, hue, and saturation support - not fully tested
           Fixed bug in thermostat that caused fan and mode to fail
           Squashed more bugs
1.42       Clean up CSS file to show presence and other things correctly
           Change blank and image logic to read from Groovy code
           Keep session updated for similar things when they change
             -- this was done in the js file by calling refreshTile
           Fix default size for switch tiles with power meter and level
             -- by default will be larger but power can be disabled in CSS
1.41       Added filters on the Options page
           Numerous bug fixes including default Kiosk set to false
           Automatically add newly identified things to rooms per base logic
           Fix tablet alignment of room tabs
           Add hack to force background to show on near empty pages
1.4        Official merge with Open-Dash
           Misc bug fixes in CSS and javascript files
           Added kiosk mode flag to options file for hiding options button
1.32       Added routines capabilities and cleaned up default icons
1.31       Minor bug fixes - fixed switchlevel to include switch class
1.3        Intelligent class filters and force feature
           user can add any class to a thing using <<custom>>
           or <<!custom>> the only difference being ! signals
           to avoid putting custom in the name of the tile
           Note - it will still look really ugly in the ST app
           Also adds first three words of the thing name to class
           this is the preferred customizing approach
1.2        Cleaned up the Groovy file and streamlined a few things
           Added smoke, illuminance, and doors (for Garages)
           Reorganized categories to be more logical when selecting things
1.1 beta   Added cool piston graph for Webcore tiles 
           Added png icons for browser and Apple products
           Show all fields supported - some hidden via CSS
           Battery display on battery powered sensors
           Support Valves - only tested with Rachio sprinklers
           Weather tile changed to show actual and feels like side by side
           Power and Energy show up now in metered plugs
           Fix name of web page in title
           Changed backgrounds to jpg to make them smaller and load faster
           Motion sensor with temperature readings now show temperature too
0.8 beta   Many fixes based on alpha user feedback - first beta release
           Includes webCoRE integration, Modes, and Weather tile reformatting
           Also includes a large time tile in the default skin file
           Squashed a few bugs including a typo in file usage
0.7-alpha  Enable a skinning feature by moving all CSS and graphics into a 
           directory. Added parameter for API calls to support EU
0.6-alpha  Minor tweaks to above - this is the actual first public version
0.5-alpha  First public test version
0.2        Cleanup including fixing unsafe GET and POST calls
           Removed history call and moved to javascript side
           put reading and writing of options into function calls
           replaced main page bracket from table to div
0.1        Implement new architecture for files to support sortable jQuery
0.0        Initial release
`;

var version = devhistory.substr(1,10).trim();
var HPVERSION = version;
var APPNAME = 'HousePanel V' + HPVERSION;
var CRYPTSALT ='HP$by%KW';
var BYPASSPW = false;

function getUserName() {
    if ( !GLB.uname ) { GLB.uname = "default"; }
    return GLB.uname;
}

// get the active user and skin
function getSkin() {
    var uname = getUserName();
    var pwords = GLB.options["config"]["pword"];
    var skin;
    if ( !pwords || !is_array(pwords) || count(pwords)===0 ) {
        skin = "skin-housepanel";
    } else if ( uname && array_key_exists(uname, pwords) ) {
        pword = pwords[uname];
        if ( is_array(pword) ) {
            skin = pword[1];
        } else {
            skin = GLB.options["config"]["skin"];
        }
    } else {
        skin = "skin-housepanel";
    }
    return skin;
}

// read in customtiles ignoring the comments
// updated this to properly treat /*   */ comment blocks
function readCustomCss(skin) {
    var fname = "skin/customtiles.css";
    var contents = fs.readFileSync(fname, 'utf8');
    return contents;
}

// call to write Custom Css Back to customtiles.css
function writeCustomCss(skin, str) {
    // proceed only if there is a main css file in this skin folder
    if ( skin && file_exists(skin + "/housepanel.css") ) {
        var d = new Date();
        var today = d.toLocaleString();
        var fixstr = "";
        var ipos = str.indexOf("*---*/");

        // preserve the header info and update it with date
        if ( !str || ipos=== -1 ) {
            fixstr += "/* HousePanel Generated Tile Customization File */\n";
            if ( str ) {
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
        // also, old custom skins used the directory of the skin in URL references
        // but this no longer works because the css file is now left in the skin folder
        // so we remove all references to rewrite the file
        if ( str && str.length ) {
            var str3 = str.replace("\\\"","\"");
            var str4 = str3.replace(skin + "/", "");
            fixstr += str4;
        }
    
        // write to specific skin folder if the location is valid
        fs.writeFile(skin + "/customtiles.css", fixstr, 'utf8', function(err) {
            if (err) {
                console.log("Error attempting to save custom CSS file in skin folder: ", skin);
            } else {
                console.log("custom CSS file saved in skin folder: ", skin, " of size: ", fixstr.length);
            }
        });
    }
}

function readOptions(reset) {

    // read options file here since it could have changed
    var fname = "hmoptions.cfg";
    try {
        if ( !fs.existsSync(fname) ) {
            console.log((new Date()) + ' hmoptions.cfg file not found.');
            return null;
        }
        GLB.options = JSON.parse(fs.readFileSync(fname, 'utf8'));
        GLB.config = GLB.options.config;
        GLB.hubs = GLB.config.hubs;
    } catch(e) {
        console.log((new Date()) + ' hmoptions.cfg file found but could not be processed.');
        GLB.options = null;
        GLB.config = null;
        GLB.hubs = null;
    }

    if ( GLB.options ) {
        var options = GLB.options;
        var timeval = GLB.options["time"];
        var info = timeval.split(" @ ");
        var version = info[0];

        console.log((new Date()) + ' Config file found. Running HP Version ', version);
        if ( GLB.hubs && GLB.hubs.length > 0 ) {
            console.log((new Date()) + ' Loaded ', GLB.hubs.length,' hubs.');
            if ( DEBUG5 ) {
                console.log(GLB.hubs);
            }
        } else {
            console.log((new Date()) + ' No hubs found. HousePanel is not available.');
        }
        
        // make the room config file to support custom users
        var uname = getUserName();
        if ( uname ) {
            
            // $uname = trim($_COOKIE["uname"]);
            var customfname = "hm_" + uname + ".cfg";
            var key;
            if ( reset || !fs.existsSync(customfname) ) {
                // this format is now in real json format and includes user_ tiles
                // add a signature key to flag this format
                var customopt = [];
                customopt["::CUSTOM::"] = [uname, HPVERSION, timeval];
                for (key in options) {
                    if ( key==="rooms" || key==="things" || key.substr(0,5)==="user_" ) {
                        customopt[key] = options[key];
                    }
                }
                var str_customopt = JSON.stringify(customopt);
                fs.writeFileSync(customfname, cleanupStr(str_customopt));
            } else {

                // read this assuming new method only
                var str = fs.readFileSync(customfname, 'utf8');
                var str1 = str.replace("\r","");
                var str2 = str1.replace("\n","");
                var str3 = str2.replace("\t","");
                var opts = JSON.parse(str3);

                var opt_rooms = null;
                var opt_things = null;
                if ( opts["rooms"] ) {
                    opt_rooms = opts["rooms"];
                }
                if ( opts["things"] ) {
                    opt_things = opts["things"];
                }
                for (key in opts) {
                    if ( key.substr(0,5)==="user_" ) {
                        GLB.options[key] = opts[key];
                    }
                }
                    
                // protect against having a custom name and an empty custom user name
                if ( opt_rooms && opt_things ) {
                    GLB.options["rooms"] = opt_rooms;
                    GLB.options["things"] = [];
                    for (var room in opt_rooms) {
                        if ( array_key_exists(room, opt_things) ) {
                            GLB.options["things"][room] = opt_things[room];
                        }
                    }
                }
            }
        }
    }
    return GLB.options;
}

function writeOptions(options) {
    return;
    
    if ( !options ) {
        return;
    }

    GLB.options = options;
    var d = new Date();
    var timeval = d.getTime();
    options["time"] = HPVERSION + " @ " + timeval;
    
    // write the main options file
    var str =  JSON.stringify(options);
    fs.writeFileSync("hmoptions.cfg", cleanupStr(str));
    
    // write the user specific options file
    var uname = getUserName();
    if ( uname ) {
        var customfname = "hm_" + uname + ".cfg";

        // this format is now in real json format and includes user_ tiles
        // add a signature key to flag this format
        var customopt = {};
        customopt["::CUSTOM::"] = [uname, HPVERSION, timeval];
        for (var key in GLB.options) {
            if ( key==="rooms" || key==="things" || key.substr(0,5)==="user_" ) {
                customopt[key] = GLB.options[key];
            }
        }
        var str_customopt = JSON.stringify(customopt);
        fs.writeFileSync(customfname, cleanupStr(str_customopt));
    }
}

// make the string easier to look at
function cleanupStr(str) {
    // var str1 = str.replace(/,\\"/g,",\r\n\"");
    // var str2 = str1.replace(/:{\\"/g,":{\r\n\"");
    // str3 = str2.replace("\"],","\"],\r\n");
    return str;
}

function curl_call(host, headertype, nvpstr, formdata, calltype, callback) {
    var request = require('request');
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

function getDevices(hubnum, hubAccess, hubEndpt, clientId, clientSecret, hubName, hubType) {

    // retrieve all things from ST
    if ( hubType==="SmartThings" || hubType==="Hubitat" ) {
        var stheader = {"Authorization": "Bearer " + hubAccess};
        var params = {client_secret: clientId,
                      scope: "app",
                      client_id: clientSecret};
        curl_call(hubEndpt + "/getallthings", stheader, params, false, "POST", getAllDevices);
    } else if ( hubType==="ISY" ) {
        var buff = Buffer.from(hubAccess);
        var base64 = buff.toString('base64');
        stheader = {"Authorization": "Basic " + base64};
        // console.log(stheader);
        curl_call(hubEndpt + "/nodes", stheader, false, false, "GET", getNodes);
        
    } else {
        console.log("Error: attempt to read an unknown hub type= ", hubType);
        return;
    }
    
    function getNodes(err, res, body) {
        var id;
        if ( err ) {
            console.log("Error retrieving ISY nodes: ", err);
        } else {
            var result = parser.parse(body);
            var thenodes = result.nodes["node"];
            if (DEBUG6) {
                console.log((new Date()) + " Retrieved ", thenodes.length, " things from hub: ", hubName);
            }    
            for ( var obj in thenodes ) {
                var node = thenodes[obj];
                id = node["address"];
                var thetype = "isy";
                var idx = thetype + "|" + id;
                var hint = node["type"].toString();
                var name = node["name"];
                var thevalue = "DOF";   // JSON.stringify(node);
                if (DEBUG5) {
                    console.log("idx= ", idx," hint= ", hint, " thing= ", thevalue);
                }
                allthings[idx] = {
                    "id": id,
                    "name": name, 
                    "hubnum": hubnum,
                    "type": thetype, 
                    "refresh": "normal",
                    "value": thevalue
                };
                if (DEBUG4) {
                    console.log("ISY thing: ", allthings[idx]);
                }
            }
            // updateOptions();
        }
    }
    
    function getAllDevices(err, res, body) {
        if ( err ) {
            console.log("Error retrieving devices: ", err);
        } else {
            try {
                var jsonbody = JSON.parse(body);
            } catch (e) {
                console.log("Error translating devices: ", e);
                return;
            }
            if (DEBUG6) {
                console.log((new Date()) + " Retrieved ", jsonbody.length, " things from hub: ", hubName);
            }    

            // configure returned array with the "id"
            if (jsonbody && typeof jsonbody === "object") {
                jsonbody.forEach(function(content) {
                    var thetype = content["type"];
                    var id = content["id"];
                    var idx = thetype + "|" + id;
                    allthings[idx] = {
                        "id": id,
                        "name": content["name"], 
                        "hubnum": hubnum,
                        "type": thetype, 
                        "refresh": "normal",
                        "value": content["value"]
                    };
                });
            }
            // updateOptions();
        }
    }
}

// returns the maximum index from the options
function getMaxIndex() {
    var maxindex = 0;
    for ( var key in GLB.options["index"] ) {
        var value = parseInt(GLB.options["index"][key]);
        maxindex = ( value > maxindex ) ? value : maxindex;
    }
    return maxindex;
}

// updates the global options array with new things found on hub
function updateOptions() {

    if ( ! GLB.options ) {
        return;
    }
   
    // get list of supported types
    var thingtypes = getTypes();
    
    // make all the user options visible by default
    if ( !array_key_exists("useroptions", GLB.options )) {
        GLB.options["useroptions"] = thingtypes;
    }

    // find the largest index number for a sensor in our index
    // and undo the old flawed absolute positioning
    var cnt = getMaxIndex() + 1;

    // set zindex and custom names if not there
    // for (var roomname in GLB.options["things"]) {
    //     var thinglist = GLB.options["things"][roomname];
    //     thinglist.forEach(function(idxarray, n) {
    //         if ( !is_array(idxarray) ) {
    //             idxarray = [idxarray, 0, 0, 1, ""];
    //         } else if ( is_array(idxarray) && idxarray.length===3 ) {
    //             idxarray = [idxarray[0], idxarray[1], idxarray[2], 1, ""];
    //         }
    //         thinglist[n] = idxarray;
    //     });
    //     GLB.options["things"][roomname] = thinglist;
    // }

    // update the index with latest sensor information
    for (var thingid in allthings) {
        var thesensor = allthings[thingid];
        if ( !array_key_exists(thingid, GLB.options["index"]) ||
             parseInt(GLB.options["index"][thingid])===0 ) {
            GLB.options["index"][thingid] = cnt;
            cnt++;
        }
    }
    
    // make exactly the right number of special tiles
    var specialtiles = getSpecials();
    // $oldindex = $options["index"];
    for (var stype in specialtiles) {
        var sid = specialtiles[stype];
        var customcnt = getCustomCount(stype);
        createSpecialIndex(customcnt, stype, sid[0]);
    }

    // save the options file
    writeOptions(GLB.options);

}

function createSpecialIndex(customcnt, stype, spid) {
    var oldindex = GLB.options["index"];
    var maxindex = getMaxIndex();

    if ( !array_key_exists("specialtiles", GLB.options["config"]) ) {
        GLB.options["config"]["specialtiles"] = {};
    }
    GLB.options["config"]["specialtiles"][stype] = customcnt;

    // remove all special types of this type
    var n = stype.length + 1;
    for (var idx in oldindex) {
        if ( idx.substr(0,n) === stype + "|" ) {
            delete GLB.options["index"][idx];
        }
    }

    // add back in the requested number
    var theindex;
    for ( var i=0; i<customcnt; i++) {
        var k = (i + 1).toString();
        var fid = spid + k;
        var sidnum = stype + "|" + fid;
        if ( array_key_exists(sidnum, oldindex) ) {
            theindex = parseInt(GLB.options["index"][sidnum]);
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

function hidden(pname, pvalue, id) {
    var inpstr = "<input type='hidden' name='" + pname + "'  value='" + pvalue + "'";
    if (id) { inpstr += " id='" + id + "'"; }
    inpstr += " />";
    return inpstr;
}

function getTypes() {
    var thingtypes = [
        "routine","switch", "light", "switchlevel", "bulb", "momentary","contact",
        "motion", "lock", "thermostat", "temperature", "music", "audio", "valve",
        "door", "illuminance", "smoke", "water",
        "weather", "presence", "mode", "shm", "hsm", "piston", "other",
        "clock", "blank", "image", "frame", "video", "custom", "control", "power"
    ];
    return thingtypes;
}

// routine that renumbers all the things in your options file from 1
function refactorOptions() {

    // load in custom css strings
    var updatecss = false;
    var cnt = 0;
    var options = readOptions(true);
    var oldoptions = options;
    options["useroptions"] = getTypes();
    options["things"] = [];
    options["index"] = [];
    skin = getSkin();
    customcss = readCustomCss(skin);

    // foreach ($oldoptions["index"] as $thingid => $idxarr) {
    for (var thingid in oldoptions["index"]) {
        var idxarr = oldoptions["index"][thingid];
        
        // only keep items that are in our current set of hubs
        if ( array_key_exists(thingid, allthings) ) {
        
            cnt++;
            var idx;
            // fix the old system that could have an array for idx
            // discard any position that was saved under that system
            if ( typeof idxarr === "object" ) {
                idx = parseInt(idxarr[0]);
            } else {
                if ( typeof idxarr === "string") {
                    idx = parseInt(idxarr);
                } else {
                    idx = idxarr;
                }
            }

            // replace all instances of the old "idx" with the new "cnt" in customtiles
            if ( customcss && idx!==cnt ) {
                $customcss = customcss.replace(".p_" + idx + ".", ".p_" + cnt + ".");
                $customcss = customcss.replace(".p_" + idx + " ", ".p_" + cnt + " ");

                $customcss = customcss.replace(".v_" + idx + ".", ".v_" + cnt + ".");
                $customcss = customcss.replace(".v_" + idx + " ", ".v_" + cnt + " ");

                $customcss = customcss.replace(".t_" + idx + ".", ".t_" + cnt + ".");
                $customcss = customcss.replace(".t_" + idx + " ", ".t_" + cnt + " ");

                $customcss = customcss.replace(".n_" + idx + ".", ".n_" + cnt + ".");
                $customcss = customcss.replace(".n_" + idx + " ", ".n_" + cnt + " ");

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
        thinglist.forEach( function(pidpos, key) {    
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
                var newid = $options["index"][thingid];
                // use the commented code below if you want to preserve any user movement
                // otherwise a refactor call resets all tiles to their baseeline position  
                // options["things"][room].push([newid,postop,posleft,zindex,customname]);
                options["things"][room].push([newid,0,0,1,customname]);
            }
        });
    }
    
    // now adjust all custom configurations
    // foreach ($oldoptions as $key => $lines) {
    for (key in oldoptions) {
        
        var lines = oldoptions[key];
        var newlines;
        var calltype;
    
        if ( ( key.substr(0,5)==="user_" || key.substr(0,7)==="custom_" ) && is_array(lines) ) {
            
            // allow user to skip wrapping single entry in an array
            if ( !is_array(lines[0] ) ) {
                msgs = lines;
                calltype = msgs[0].toUpperCase().trim();
                if ( calltype==="LINK" ) {
                    var linkid = parseInt(msgs[1].trim());
                    var thingid = array_search(linkid, oldoptions["index"]);
                    if ( thingid!==false && array_key_exists(thingid, options["index"]) ) {
                        msgs[1] = options["index"][thingid];
                    }
                }
                newlines = msgs;
            } else {
                newlines = [];
                for (msgs in lines) {
                    calltype = msgs[0].toUpperCase().trim();

                    // switch to new index for links
                    // otherwise we just copy the info over to options
                    if ( calltype==="LINK" ) {
                        var linkid = parseInt(msgs[1].trim());
                        var thingid = array_search(linkid, oldoptions["index"]);
                        if ( thingid!==false && array_key_exists(thingid, options["index"]) ) {
                            msgs[1] = options["index"][thingid];
                        }
                    }
                    newlines.push(msgs);
                }
            }
            options[key] = newlines;
        }
    }
    
    // save our updated options and our custom style sheet file
    GLB.options = options;
    writeOptions(options);
    // writeCustomCss(skin, customcss);
    
}

// emulates the PHP function for javascript objects or arrays
function array_search(needle, arr) {
    var key = false;
    try {
        for (var t in arr) {
            if ( arr[t] === needle ) {
                return t;
            }
        } 
    }
    catch(e) {}
    return key;
}

function is_array(obj) {
    if ( typeof obj === "object" ) {
        return Array.isArray(obj);
    } else {
        return false;
    }
}

function is_object(obj) {
    if ( typeof obj === "object" && !is_array(obj) ) {
        return true;
    } else {
        return false;
    }
}

// create page to display in a submit form to set options
//function getOptionsPage() {
//    var returl = GLB.returnURL;
//    $thingtypes = getTypes();
//    $specialtiles = getSpecials();
//    sort($thingtypes);
//    $roomoptions = $options["rooms"];
//    $thingoptions = $options["things"];
//    $indexoptions = $options["index"];
//    $useroptions = $options["useroptions"];
//    $configoptions = $options["config"];
//    $hubs = $configoptions["hubs"];
//    $uname = getUserName();
//    $skin = getSkin($options, $uname);
//    if ( !array_key_exists("port", $configoptions) ) {
//        $configoptions = setDefaultOptions($configoptions);
//    }
//    $port = $configoptions["port"];
//    $webSocketServerPort = $configoptions["webSocketServerPort"];
//    $fast_timer = $configoptions["fast_timer"];
//    $slow_timer = $configoptions["slow_timer"];
//    $kioskoptions = $configoptions["kiosk"];
//    $ruleoptions = $configoptions["rules"];
//    $timezone = $configoptions["timezone"];
//    
//    $tc = "";
//    $tc.= "<h3>" + APPNAME + " Options</h3>";
//    $tc.= "<div class=\"formbutton formauto\"><a href=\"" + GLB.returnURL + "\">Cancel and Return to HousePanel</a></div>";
//    
//    $tc.= "<div id=\"optionstable\" class=\"optionstable\">";
//    $tc.= "<form id=\"optionspage\" class=\"options\" name=\"options\" action=\"" + GLB.returnURL +"\"  method=\"POST\">";
//    $tc.= hidden("pagename", "options");
//    $tc.= hidden("useajax", "saveoptions");
//    $tc.= hidden("id", "none");
//    $tc.= hidden("type", "none");
//    
//    // $tc.= "<div class=\"filteroption\">Skin directory name: <input id=\"skinid\" width=\"240\" type=\"text\" name=\"skin\"  value=\"$skin\"/>";
//    $tc.= "<div class=\"filteroption\">";
//    $tc.= tsk($timezone, $skin, $uname, $port, $webSocketServerPort, $fast_timer, $slow_timer);
//    $tc.= "</div>";
//    
//    $tc.= "<div class=\"filteroption\">";
//    $tc.= "<label for=\"kioskid\" class=\"kioskoption\">Kiosk Mode: </label>";    
//    $kstr = ($kioskoptions===true || $kioskoptions==="true" || $kioskoptions==="1" || $kioskoptions==="yes") ? "checked" : "";
//    $tc.= "<input id=\"kioskid\" width=\"24\" type=\"checkbox\" name=\"kiosk\"  value=\"$kioskoptions\" $kstr/>";
//    
//    $tc.= "<label for=\"ruleid\" class=\"kioskoption\">Enable Rules? </label>";
//    $rstr = ($ruleoptions===true || $ruleoptions==="true" || $ruleoptions==="1" || $ruleoptions==="yes") ? "checked" : "";
//    $tc.= "<input id=\"ruleid\" width=\"24\" type=\"checkbox\" name=\"rules\"  value=\"$ruleoptions\" $rstr/>";
//    $tc.= "</div>";
//
//    $accucity = $configoptions["accucity"];
//    $accuregion = $configoptions["accuregion"];
//    $accucode = $configoptions["accucode"];      // ann-arbor-mi code is 329380
//    $tc.= "<div class=\"filteroption\"><label for=\"accucityid\" class=\"kioskoption\">Accuweather City: <input id=\"accucityid\" width=\"180\" ";
//    $tc.= "type=\"text\" name=\"accucity\"  value=\"$accucity\" />";
//    $tc.= "<label for=\"accuregionid\" class=\"kioskoption\">Region: <input id=\"accuregionid\" width=\"6\" type=\"text\" name=\"accuregion\"  value=\"$accuregion\"/>";
//    $tc.= "<label for=\"accucodeid\" class=\"kioskoption\">Code: <input id=\"accucodeid\" width=\"40\" type=\"text\" name=\"accucode\"  value=\"$accucode\"/>";
//    // $tc.= "<br><span class='typeopt'>(You must find your city and code to use this feature.)</span>";
//    $tc.= "</div>";
//    
//    $tc.= "<div class=\"filteroption\">";
//    foreach ($specialtiles as $stype => $sid) {
//        $customcnt = getCustomCount($stype, $options);
//        $stypeid = "cnt_" . $stype;
//        $tc.= "<br /><label for=\"$stypeid\" class=\"kioskoption\">Number of $stype tiles: </label>";
//        $tc.= "<input class=\"specialtile\" id=\"$stypeid\" name=\"$stypeid\" width=\"10\" type=\"number\"  min='0' max='99' step='1' value=\"$customcnt\" />";
//    }
//    $tc.= "</div>";
//    
//    // if more than one hub then let user pick which one to show
//    if ( count($hubs) > 1 ) {
//        $tc.= "<div class=\"filteroption\">Hub Filters: ";
//        $hid = "hopt_all";
//        $tc.= "<div class='radiobutton'><input id='$hid' type='radio' name='huboptpick' value='all' checked='1'><label for='$hid'>All Hubs</label></div>";
//        $hid = "hopt_none";
//        $tc.= "<div class='radiobutton'><input id='$hid' type='radio' name='huboptpick' value='none'><label for='$hid'>No Hub</label></div>";
//        $hubcount = 0;
//        foreach ($hubs as $hub) {
//            $hubName = $hub["hubName"];
//            $hubType = $hub["hubType"];
//            $hubId = $hub["hubId"];
//            $hid = "hopt_" . $hubcount;
//            $tc.= "<div class='radiobutton'><input id='$hid' type='radio' name='huboptpick' value='$hubId'><label for='$hid'>$hubName ($hubType)</label></div>";
//            $hubcount++;
//        }
//        $tc.= "</div>";
//    }
//    
//    
//    $tc.= "<br /><div class=\"filteroption\">Thing Filters: ";
//    $tc.= "<div id=\"allid\" class=\"smallbutton\">All</div>";
//    $tc.= "<div id=\"noneid\" class=\"smallbutton\">None</div>";
//    $tc.= "</div>";
//    
//    $tc.= "<div class='filteroption'>Select Things to Display</div>";
//    $tc.= "<table class=\"useroptions\"><tr>";
//    $i= 0;
//    foreach ($thingtypes as $opt) {
//        $i++;
//        if ( in_array($opt,$useroptions ) ) {
//            $tc.= "<td><input id=\"cbx_$i\" type=\"checkbox\" name=\"useroptions[]\" value=\"" . $opt . "\" checked=\"1\">";
//        } else {
//            $tc.= "<td><input id=\"cbx_$i\" type=\"checkbox\" name=\"useroptions[]\" value=\"" . $opt . "\">";
//        }
//        $tc.= "<label for=\"cbx_$i\" class=\"optname\">$opt</label></td>";
//        if ( $i % 5 == 0 && $i < count($thingtypes) ) {
//            $tc.= "</tr><tr>";
//        }
//    }
//    $tc.= "</tr></table>";
//    
//    $tc.= "<br /><br />";
//    $tc.= "<table class=\"headoptions\"><thead>";
//    $tc.= "<tr><th class=\"thingname\">" . "Thing Name (type)" . "</th>";
//    $tc.= "<th class=\"hubname\">Hub</th>";
//   
//    // list the room names in the proper order
//    // for ($k=0; $k < count($roomoptions); $k++) {
//    foreach ($roomoptions as $roomname => $k) {
//        // search for a room name index for this column
//        // $roomname = array_search($k, $roomoptions);
//        if ( $roomname ) {
//            $tc.= "<th class=\"roomname\">$roomname";
//            $tc.= "</th>";
//        }
//    }
//    $tc.= "</tr></thead>";
//    $tc.= "</table>";
//    $tc.= "<div class='scrollvtable'>";
//    $tc.= "<table class=\"roomoptions\">";
//    $tc.= "<tbody>";
//
//    // sort the things
//    uasort($allthings, "mysortfunc");
//    
//    // now print our options matrix
//    // $rowcnt = 0;
//    $evenodd = true;
//    foreach ($allthings as $thingid => $thesensor) {
//        // if this sensor type and id mix is gone, skip this row
//        
//        $thingname = $thesensor["name"];
//        $thetype = $thesensor["type"];
//        $hubnum = $thesensor["hubnum"];
//        $hub = $hubs[findHub($hubnum, $hubs)];
//        if ( $hubnum === -1 || $hubnum==="-1" ) {
//            $hubType = "None";
//            $hubStr = "None";
//            $hubId = "none";
//        } else {
//            $hubType = $hub["hubType"];
//            $hubStr = $hub["hubName"];
//            $hubId = $hub["hubId"];
//        }
//
//        // get the tile index number
//        $arr = $indexoptions[$thingid];
//        if ( is_array($arr) ) {
//            $thingindex = $arr[0];
//        } else {
//            $thingindex = $arr;
//        }
//        
//        // write the table row
//        if ( array_key_exists($thetype, $specialtiles) ) {
//            $special = " special";
//        } else {
//            $special = "";
//        }
//        if (in_array($thetype, $useroptions)) {
//            $evenodd = !$evenodd;
//            $evenodd ? $odd = " odd" : $odd = "";
//            $tc.= "<tr type=\"$thetype\" tile=\"$thingindex\" class=\"showrow" . $odd . $special . "\">";
//        } else {
//            $tc.= "<tr type=\"$thetype\" tile=\"$thingindex\" class=\"hiderow" . $special . "\">";
//        }
//        
//        $tc.= "<td class=\"thingname\">";
//        $tc.= $thingname . "<span class=\"typeopt\"> (" . $thetype . ")</span>";
//        $tc.= "</td>";
//        
//        $tc.="<td class=\"hubname\" hubId=\"$hubId\">";
//        $tc.= $hubStr . " ($hubType)";
//        $tc.= "</td>";
//
//        // loop through all the rooms
//        // this addresses room bug
//        // for ($k=0; $k < count($roomoptions); $k++) {
//        foreach ($roomoptions as $roomname => $k) {
//            
//            // get the name of this room for this oclumn
//            // $roomname = array_search($k, $roomoptions);
//            // $roomlist = array_keys($roomoptions, $k);
//            // $roomname = $roomlist[0];
//            if ( array_key_exists($roomname, $thingoptions) ) {
//                $things = $thingoptions[$roomname];
//                                
//                // now check for whether this thing is in this room
//                $tc.= "<td>";
//                
//                $ischecked = false;
//                foreach( $things as $arr ) {
//                    if ( is_array($arr) ) {
//                        $idx = $arr[0];
//                    } else {
//                        $idx = $arr;
//                    }
//                    if ( $idx == $thingindex ) {
//                        $ischecked = true;
//                        break;
//                    }
//                }
//                
//                if ( $ischecked ) {
//                    $tc.= "<input type=\"checkbox\" name=\"" . $roomname . "[]\" value=\"" . $thingindex . "\" checked=\"1\" >";
//                } else {
//                    $tc.= "<input type=\"checkbox\" name=\"" . $roomname . "[]\" value=\"" . $thingindex . "\" >";
//                }
//                $tc.= "</td>";
//            }
//        }
//        $tc.= "</tr>";
//    }
//
//    $tc.= "</tbody></table>";
//    $tc.= "</div>";   // vertical scroll
//    $tc.= "<div id='optionspanel' class=\"processoptions\">";
//    $tc.= "<input id=\"submitoptions\" class=\"submitbutton\" value=\"Save\" name=\"submitoption\" type=\"button\" />";
//    $tc.= "<div class=\"formbutton resetbutton\"><a href=\"$retpage\">Cancel</a></div>";
//    $tc.= "<input class=\"resetbutton\" value=\"Reset\" name=\"canceloption\" type=\"reset\" />";
//    $tc.= "</div>";
//    $tc.= "</form>";
//    $tc.= "</div>";
//
//    return $tc;
//}

// this is the main page rendering function
// each HousePanel tab is generated by this function call
// each page is contained within its own form and tab division
// notice the call of $cnt by reference to keep running count
function getNewPage(cnt, roomtitle, kroom, things, kioskmode) {
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
        things.forEach(function(kindexarr) {
            
            // get the offsets and the tile id
            var kindex = kindexarr[0];
            var postop = kindexarr[1];
            var posleft = kindexarr[2];
            var zindex = 1;
            var customname = "";

            if ( kindexarr.length > 3 ) {
                zindex = kindexarr[3];
                customname = kindexarr[4];
            }
            
            // get the index into the main things list
            
            // thingid = array_search(kindex, GLB.indexoptions);
            var idx;
            var i = idxvals.findIndex(idx => idx === kindex);
            var thingid = idxkeys[i];
            
            // if our thing is still in the master list, show it
            if (thingid && allthings[thingid]) {
                var thesensor = allthings[thingid];

                // keep running count of things to use in javascript logic
                cnt++;
                $tc += makeThing(cnt, kindex, thesensor, roomtitle, postop, posleft, zindex, customname);
            }
        });

        // end the form and this panel
        $tc += "</div></form>";

    // end this tab which is a different type of panel
    $tc +="</div>";
    return {tc: $tc, cnt: cnt};
}

function array_key_exists(key, arr) {
    return ( typeof arr[key] !== "undefined" );
}


// function to search for triggers in the name to include as classes to style
function processName(thingname, thingtype) {

    // get rid of 's and split along white space
    // but only for tiles that are not weather
    var subtype = "";
    if ( thingtype!=="weather") {
        var ignores = ["'s","*","<",">","!","{","}","-",".",",",":","+","&","%"];
        var ignore2 = ["routine","switch", "light", "switchlevel", "bulb", "momentary","contact",
                    "motion", "lock", "thermostat", "temperature", "music", "valve",
                    "illuminance", "smoke", "water",
                    "weather", "presence", "mode", "shm", "hsm", "piston", "other",
                    "clock", "blank", "image", "frame", "video", "custom", "control", "power"];
        var lowname = thingname.toLowerCase();
        var pattern = /[,;:!-\'\*\<\>\{\}\+\&\%]/g;
        var s1 = lowname.replace(pattern,"");
        var subopts = s1.split(" ");
        var k = 0;
        subopts.forEach(function(str) {
            str= str.trim();
            var numcheck = +str;
            if ( str.length>1 && ignore2.indexOf(str)===-1 && str!==thingtype && isNaN(numcheck) ) {
                if ( k < 3 ) {
                    subtype += " " + str;
                    k++;
                }
            }
        });
    }
    
    return [thingname, subtype];
}

function getWeatherIcon(num) {
    if ( isNaN(+num) ) {
        var iconstr = num;
    } else {
        num = num.toString();
        if ( num.length < 2 ) {
            num = "0" + num;
        }

        // uncomment this to use ST's copy. Default is to use local copy
        // so everything stays local
        // $iconimg = "https://smartthings-twc-icons.s3.amazonaws.com/" . $num . ".png";
        var iconimg = "media/weather/" + num + ".png";
        iconstr = "<img src=\"" + iconimg + "\" alt=\"" + num + "\" width=\"80\" height=\"80\">";
    }
    return iconstr;
}

function makeThing(cnt, kindex, thesensor, panelname, postop, posleft, zindex, customname, wysiwyg) {
    var $tc = "";
    
    var bid = thesensor["id"];
    var thingvalue = thesensor["value"];
    var thingtype = thesensor["type"];
    
    var hubnum = "-1";
    if ( array_key_exists("hubnum", thesensor) ) {
        hubnum = thesensor["hubnum"];
    }
    if ( array_key_exists("refresh", thesensor) ) {
        var refresh = thesensor["refresh"];
    } else {
        refresh = "normal";
    }

    var pnames = processName(thesensor["name"], thingtype);
    var thingname = pnames[0];
    var subtype = pnames[1];
//    if ( thingtype==="presence" ) {
//        console.log("name debug: ", thingname, " subtype= ", subtype, pnames);
//    }
    
    // if ( $thingtype==="control" ) { $subtype= " " . thesensor["name"]; }
    
    postop= parseInt(postop);
    posleft = parseInt(posleft);
    zindex = parseInt(zindex);;
    var idtag = "t-" + cnt;
    if ( wysiwyg ) {
        idtag = wysiwyg;
    }

    // set the custom name
    if ( customname ) { 
        thingvalue["name"] = customname;
    }

    // update fields with custom settings
    // TODO...
    // $thingvalue = getCustomTile($thingvalue, $thingtype, $bid, $options, $allthings);

    // set the custom name
    // limit to 132 visual columns but show all for special tiles and custom names
    // now we use custom name in both places
    thingname = thingvalue["name"];
    var thingpr = thingname;
    if ( !customname && thingname.length > 132 && !array_key_exists(thingtype, GLB.specialtiles) ) {
        thingpr = thingname.substring(0,132) + " ...";
    }
    
    // wrap thing in generic thing class and specific type for css handling
    // IMPORTANT - changed tile to the saved index in the master list
    //             so one must now use the id to get the value of "i" to find elements
    $tc=   "<div id=\""+idtag+"\" hub=\""+hubnum+"\" tile=\""+kindex+"\" bid=\""+bid+"\" type=\""+thingtype+"\" ";
    $tc += "panel=\""+panelname+"\" class=\"thing "+thingtype+"-thing" + subtype + " p_"+kindex+"\" "; 
    $tc += "refresh=\""+refresh+"\"";
    if ( (postop!==0 && posleft!==0) || zindex>1 ) {
        $tc += " style=\"position: relative; left: "+posleft+"px; top: "+postop+"px; z-index: "+zindex+";\"";
    }
    $tc += ">";

    // special handling for weather tiles
    // this allows for feels like and temperature to be side by side
    // and it also handles the inclusion of the icons for status
    if (thingtype==="weather") {
        var weathername;
        if ( customname ) {
            weathername = customname;
        } else {
            weathername = thingpr + "<br>" + thingvalue["city"];
        }
        $tc += "<div aid=\""+ cnt +"\" class=\"thingname " + thingtype + " t_" + kindex + "\" id=\"s-" + cnt + "\">";
        // $tc += "<span class=\"original n_kindex\">" . $weathername . "</span>";
        $tc += weathername;
        $tc += "</div>";
        $tc += putElement(kindex, cnt, 0, thingtype, thingvalue["name"], "name");
        $tc += putElement(kindex, cnt, 1, thingtype, thingvalue["city"], "city");
        $tc += "<div class=\"weather_temps\">";
        $tc += putElement(kindex, cnt, 2, thingtype, thingvalue["temperature"], "temperature");
        $tc += putElement(kindex, cnt, 3, thingtype, thingvalue["feelsLike"], "feelsLike");
        $tc += "</div>";
        
        // use new weather icon mapping
        $tc += "<div class=\"weather_icons\">";
        var wiconstr = getWeatherIcon(thingvalue["weatherIcon"]);
        var ficonstr = getWeatherIcon(thingvalue["forecastIcon"]);
        $tc += putElement(kindex, cnt, 4, thingtype, wiconstr, "weatherIcon");
        $tc += putElement(kindex, cnt, 5, thingtype, ficonstr, "forecastIcon");
        $tc += "</div>";
        $tc += putElement(kindex, cnt, 6, thingtype, "Sunrise: " + thingvalue["localSunrise"] + " Sunset: " + thingvalue["localSunset"], "sunriseset");
        $tc += putElement(kindex, cnt, 7, thingtype, thingvalue["localSunrise"], "localSunrise");
        $tc += putElement(kindex, cnt, 8, thingtype, thingvalue["localSunset"], "localSunset");
        
        var j = 9;
        for ( var tkey in thingvalue ) {
            if (tkey!=="temperature" &&
                tkey!=="feelsLike" &&
                tkey!=="city" &&
                tkey!=="weather" &&
                tkey!=="weatherIcon" &&
                tkey!=="forecastIcon" &&
                tkey!=="alertKeys" &&
                tkey!=="localSunrise" &&
                tkey!=="localSunset" ) 
            {
                var tval = thingvalue[tkey];
                $tc += putElement(kindex, cnt, j, thingtype, tval, tkey);
                j++;
            }
        };
        
    } else {

        // handle special tiles
        // TODO...
//        if ( array_key_exists(thingtype, specialtiles) ) 
//        {
//            $fn = $thingvalue["name"];
//            if ( array_key_exists("width", $thingvalue) ) {
//                $fw = $thingvalue["width"];
//            } else {
//                $fw = $specialtiles[$thingtype][1];
//            }
//            if ( array_key_exists("height", $thingvalue) ) {
//                $fh = $thingvalue["height"];
//            } else {
//                $fh = $specialtiles[$thingtype][2];
//            }
//            $thingvalue[$thingtype] = returnFile($fn, $fw, $fh, $thingtype );
//        }
//        if ( $thingtype==="music" ) {
//            $thingvalue = getMusicArt($thingvalue);
//        }
        
        $tc += "<div aid=\""+cnt+"\" type=\""+thingtype+"\" title=\""+thingpr+"\" class=\"thingname "+thingtype+" t_"+kindex+"\" id=\"s-"+cnt+"\">";
        $tc += thingpr;
        $tc += "</div>";
	
        // create a thing in a HTML page using special tags so javascript can manipulate it
        // multiple classes provided. One is the type of thing. "on" and "off" provided for state
        // for multiple attribute things we provide a separate item for each one
        // the first class tag is the type and a second class tag is for the state - either on/off or open/closed
        // ID is used to send over the groovy thing id number passed in as $bid
        // for multiple row ID's the prefix is a$j-$bid where $j is the jth row
        if (typeof thingvalue === "object") {
            var j = 0;
            var sibling = "";
            
            // check if there is a color key - use to set color
            // no longer print this first since we need to include in custom logic
            var bgcolor= "";
            if ( array_key_exists("color", thingvalue) ) {
                var cval = thingvalue["color"];
                if ( cval.match(/^#[abcdefABCDEF\d]{6}/) !== null ) {
                    bgcolor = " style=\"background-color:"+cval+";\"";
                }
            }
            
            // create on screen element for each key
            // this includes a check for helper items created by getCustomTile
            // foreach($thingvalue as $tkey => $tval) {
            for ( var tkey in thingvalue ) {
                var tval = thingvalue[tkey];
                
                // handle the new Sonos audio type which has a media type with details
                if ( thingtype==="audio" && tkey==="audioTrackData" ) {
                    var audiodata = JSON.parse(tval);
                    $tc += putElement(kindex, cnt, j,   thingtype, audiodata["title"], "trackDescription", "trackDescription", bgcolor);
                    $tc += putElement(kindex, cnt, j+1, thingtype, audiodata["artist"], "currentArtist", "currentArtist", bgcolor);
                    $tc += putElement(kindex, cnt, j+2, thingtype, audiodata["album"], "currentAlbum", "currentAlbum", bgcolor);
                    $tc += putElement(kindex, cnt, j+3, thingtype, audiodata["albumArtUrl"], "trackImage", "trackImage", bgcolor);
                    $tc += putElement(kindex, cnt, j+4, thingtype, audiodata["mediaSource"], "mediaSource", "mediaSource", bgcolor);
                    j = j+5;	
                }
                
                // print a hidden field for user web calls and links
                // this is what enables customization of any tile to happen
                // ::type::LINK::tval  or ::LINK::tval
                // this special element is not displayed and sits inside the overlay
                // we only process the non helpers and look for helpers in same list
                else if ( typeof tkey==="string" && tkey.substring(0,5)!=="user_" && (typeof tval==="string" || typeof tval==="number") && (typeof tval==="number" || tval.substr(0,2)!=="::") ) { 
                    
                    var helperkey = "user_" + tkey;
                    var helperval = thingvalue[helperkey];
                    if ( helperval && helperval.substr(0,2)==="::" ) {
                    
                        var ipos = helperval.indexOf("::",2);
                        var linktypeval = helperval.substring(0, ipos);
                        var jpos = linktypeval.indexOf("::",2);

                        // case with helperval = ::TEXT::val  &  linktypeval = ::val
                        var linktype;
                        var command;
                        var linkval;
                        if ( jpos===-1 ) { 
                            linktype = thingtype;
                            command = substr(helperval, 2, ipos-2);
                            linkval = substr(linktypeval,2);

                        // case with tval = ::type::LINK::val &  linktypeval = ::LINK::val
                        } else {
                            linktype = helperval.substring(2, ipos-2);
                            command = linktypeval.substring(2, jpos-2);
                            linkval = linktypeval.substring(jpos+2);
                        }
                        // use the original type here so we have it for later
                        // but in the actual target we use the linktype
                        sibling= "<div linktype=\""+linktype+"\" value=\""+tval+"\" linkval=\""+linkval+"\" command=\""+command+"\" subid=\""+tkey+"\" class=\"user_hidden\"></div>";
                    } else {
                        linktype = thingtype;
                        sibling = "";
                    }

                    $tc += putElement(kindex, cnt, j, linktype, tval, tkey, subtype, bgcolor, sibling);
                    j++;
                }
            }
				
        } else {
            $tc += putElement(kindex, cnt, 0, thingtype, thingvalue, thingtype, subtype);
        }
    }
    $tc += "</div>";
    
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

function putElement(kindex, i, j, thingtype, tval, tkey, subtype, bgcolor, sibling) {
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
        
    // fix thermostats to have proper consistent tags
    // this is supported by changes in the .js file and .css file
    if ( tkey==="heat" || tkey==="cool" || tkey==="hue" || tkey==="saturation" ||
         tkey==="heatingSetpoint" || tkey==="coolingSetpoint" ) {
        
        // fix thermostats to have proper consistent tags
        // this is supported by changes in the .js file and .css file
        $tc += "<div class=\"overlay " + tkey + " " + subtype + " v_" + kindex + "\">";
        if (sibling) { $tc += sibling; }
        $tc += aidi + " subid=\"" + tkey + "-dn\" title=\"" + thingtype + " down\" class=\"" + thingtype + " " + tkey + "-dn" + pkindex + "\"></div>";
        $tc += aidi + " subid=\"" + tkey + "\" title=\"" + thingtype + " " + tkey + "\" class=\"" + thingtype + " " + tkey + pkindex + "\"" + colorval + " id=\"" + aitkey + "\">" + tval + "</div>";
        $tc += aidi + " subid=\"" + tkey + "-up\" title=\"" + thingtype + " up\" class=\"" + thingtype + " " + tkey + "-up" + pkindex + "\"></div>";
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
        // also prevent dates and times from being added
        // also do not include any music album or artist names in the class
        // and finally if the value is complex with spaces or other characters, skip
        var extra;
        if ( tkey==="time" || tkey==="date" || tkey==="color" ||
                   (tkey.substr(0,6)==="event_") ||
                   tkey==="trackDescription" || tkey==="currentArtist" || 
                   tkey==="currentAlbum" || tkey==="trackImage" ||
                   tkey==="weatherIcon" || tkey==="forecastIcon" ||
                   !isNaN(+tval) || thingtype===tval || tval==="" || 
                   (tval.substr(0,5)==="track") || 
                   (tval.substr(0,7)==="number_") || 
                   (tval.substr(0,4)==="http") ||
                   (tval.indexOf(" ")!==-1) ) {
            extra = "";
        } else {
            extra = " " + tval;
        }
        
        // fix track names for groups, empty, and super long
        if (tkey==="trackDescription" || tkey==="track") {
            tval = fixTrack(tval);
        } else if (tkey==="trackImage") {
            if ( tval.substr(0,4) === "http" ) {
                tval = "<img width='120' height='120' src='" + tval + "'>";
            }
        } else if ( tkey === "battery") {
            var powmod = parseInt(tval);
            powmod = powmod - (powmod % 10);
            tval = "<div style=\"width: " + tval + "%\" class=\"ovbLevel L" + powmod.toString() + "\"></div>";
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
        // include class for main thing type, the subtype, a sub-key, and a state (extra)
        // also include a special hack for other tiles that return number_ to remove that
        // this allows KuKu Harmony to show actual numbers in the tiles
        // finally, adjust for level sliders that can't have values in the content
        $tc += "<div class=\"overlay "+tkey+" v_"+kindex+"\">";
        if (sibling) { $tc += sibling; }
        if ( tkey === "level" || tkey==="colorTemperature" || tkey==="volume" || tkey==="groupVolume" ) {
            $tc += aidi + ttype + " subid=\""+tkey+"\" value=\""+tval+"\" title=\""+tkey+"\" class=\"" + thingtype + tkeyshow + pkindex + "\" " + aitkey + "\"></div>";
        } else if ( thingtype==="other" && tval.substr(0,7)==="number_" ) {
            var numval = tkey.substring(8);
            $tc += aidi + ttype + " subid=\"" + tkey+"\" title=\""+tkey+"\" class=\"" + thingtype + subtype + tkeyshow + pkindex + "\" " + aitkey + "\">" + numval + "</div>";
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

// temp for now
function is_ssl() {
    return "http://";
}

function setSpecials() {
    GLB.specialtiles = 
        {
            "video":  ["vid",480,240], 
            "frame":  ["frame",480,212],
            "image":  ["img",480,240],
            "blank":  ["blank",120,150],
            "custom": ["custom_",120,150]
        };
    return GLB.specialtiles;
}

function getSpecials() {
    return GLB.specialtiles;
}

function getCustomCount(stype) {
    var customcnt = 0;
    if ( array_key_exists("specialtiles", GLB.config) ) {
        var specialarr = GLB.config["specialtiles"];
        if ( array_key_exists(stype, specialarr) ) {
            customcnt = parseInt(specialarr[stype]);
            if ( isNaN(customcnt) || customcnt < 1 ) { 
                customcnt = 0; 
            }
        }
    }
    return customcnt;
}

function getCustomName(defname, idx) {
    var rooms = GLB.options["rooms"];
    var thingoptions = GLB.options["things"];
    var tileid = GLB.options["index"][idx];
    for (var room in rooms) {
        if ( array_key_exists(room, thingoptions) ) {
           var things = thingoptions[room];
           for (var kindexarr in things) {
                 // if our tile matches and there is a custom name, use it
                if ( tileid===kindexarr[0] && kindexarr[4] ) {
                    return kindexarr[4];
                }
           }
        }
    }
    return defname;
}

function getClock(clockname, clockid, clockskin, fmtdate, fmttime) {
    var daynames = ["Sun", "Mon", "Tue", "Wed", "Thr", "Fri", "Sat", "Sun"];
    var clockname = getCustomName(clockname, "clock" + "|" + clockid);
    var d = new Date();
    var weekday = daynames[d.getDay()];
    var dateofmonth = d.toLocaleDateString();
    var timeofday = d.toLocaleTimeString();
    var timezone = d.getTimezoneOffset().toString();
    var dclock = {"name": clockname, "skin": clockskin, "weekday": weekday,
        "date": dateofmonth, "time": timeofday, "tzone": timezone,
        "fmt_date": fmtdate, "fmt_time": fmttime};
    // $dclock = getCustomTile($dclock, "clock", $clockid, $options, $allthings);
    return dclock;
}

function addSpecials() {
    // set hub number to nothing for manually created tiles
    var hubnum = "-1";

    // add digital clock tile
    // never refresh since clocks have their own refresh timer built into the javascript code
    // you will need to over-ride this with the tile customizer if you add custom fields
    var clockidd = "clockdigital";
    var dclock = getClock("Digital Clock", clockidd, "", "M d, Y", "h:i:s A");
    allthings["clock|"+clockidd] = {"id" :  clockidd, "name" :  dclock["name"], 
        "hubnum" :  hubnum, "type" :  "clock", "refresh": "never", "value" :  dclock};

    // add analog clock tile - no longer use dclock format settings by default
    var clockida = "clockanalog";
    var aclock = getClock("Analog Clock", clockida, "CoolClock:swissRail:72", "M d, Y", "h:i:s A");
    allthings["clock|"+clockida] = {"id" :  clockida, "name" :  aclock["name"], 
        "hubnum" :  hubnum, "type" :  "clock", "refresh": "never", "value" :  aclock};

    // add special tiles based on type and user provided count
    // this replaces the old code that handled only video and frame tiles
    // this also creates image and blank tiles here that used to be made in groovy
    // putting this here allows them to be handled just like other modifiable tiles
    // these tiles all refresh fast except first 4 frames that are reserved for weather
    // renamed accuweather to forecast2 for simplicity sake and to make sorting work
    var specialtiles = getSpecials();
    for (var stype in specialtiles) {
        var sid = specialtiles[stype];
        var speed = (stype==="frame") ? "slow" : "normal";
        var fcnt = getCustomCount(stype);
        for (var i=0; i<fcnt; i++) {

            var k = i + 1;
            k = k.toString();
            var fid = sid[0] + k;

            // the forecasts now must be in files frame1.html through frame4.html
            // or you can just change the name in the editor to a valid file
            var fw = sid[1];
            var fh = sid[2];
            var idx = stype + "|" + fid;
            var fn = getCustomName(stype + k, idx);
            var fval = fn;  // TODO... returnFile(fn, fw, fh, stype);
            var ftile = {"name": fn};
            ftile[stype] = fval;
            ftile["width"] = fw;
            ftile["height"] = fh;
            allthings[idx] = {"id":  fid, "name":  ftile["name"], "hubnum":  hubnum, 
                "type":stype, "refresh": speed, "value":  ftile};
        }
    }
    
    // create the controller tile
    // keys starting with c__ will get the confirm class added to it
    // this tile cannot be customized by the user due to its unique nature
    // but it can be visually styled just like any other tile
    var controlval = {"name": "Controller", "showoptions": "Options","refresh": "Refresh","c__refactor": "Reset",
                 "c__reauth": "Re-Auth","showid": "Show Info","toggletabs": "Toggle Tabs",
                 "showdoc": "Documentation",
                 "blackout": "Blackout","operate": "Operate","reorder": "Reorder","edit": "Edit"};
    allthings["control|control_1"] = {"id":  "control_1", "name":  controlval["name"], "hubnum":  hubnum, 
                "type":  "control", "refresh": "never", "value":  controlval};
}

function getAllThings(reset) {
    
    if ( reset ) {
        // get all things from all configured servers
        allthings = {};
        GLB.hubs.forEach(function(hub) {
            var hubnum = hub["hubId"];
            var accesstoken  = hub["hubAccess"];
            var hubEndpt = hub["hubEndpt"];
            var clientId = hub["clientId"];
            var clientSecret = hub["clientSecret"];
            var hubName = hub["hubName"];
            var hubType = hub["hubType"];
            getDevices(hubnum, accesstoken, hubEndpt, clientId, clientSecret, hubName, hubType);
        });
    }

    // add the special tiles
    addSpecials();

    // now update the options to match our things
    // updateOptions();
    // console.log(allthings);
}

function pushClient(swid, swtype, subid, body) {
    // send the new results to all clients
    var entry = {};
    entry["id"] = swid;
    entry["type"] = swtype;
    entry["clientcount"] = clients.length;
    entry["trigger"] = subid;
    entry["value"] = JSON.parse(body);
    var thevalue = entry["value"];

    if ( thevalue["password"] ) { delete thevalue["password"]; }
    if ( swtype==="music" ) {
        if ( thevalue["trackDescription"] ) { delete thevalue["trackDescription"]; }
        if ( thevalue["trackImage"] ) { delete thevalue["trackImage"]; }
        if ( thevalue["currentArtist"] ) { delete thevalue["currentArtist"]; }
        if ( thevalue["currentAlbum"] ) { delete thevalue["currentAlbum"]; }
    }
    entry["value"] = thevalue;


    for (var i=0; i < clients.length; i++) {
        // clients[i].sendUTF(JSON.stringify(elements));
        entry["client"] = i+1;
        clients[i].sendUTF(JSON.stringify(entry));
    }

}

function callHub(hub, swid, swtype, swval, swattr, subid) {
    if ( hub["hubType"]==="SmartThings" || hub["hubType"]==="Hubitat" ) {
        var access_token = hub["hubAccess"];
        var endpt = hub["hubEndpt"];
        var host = endpt + "/doaction";
        var header = {"Authorization": "Bearer " + access_token};
        var nvpreq = {"swid": swid,  
                    "swattr": swattr,
                    "swvalue": swval, 
                    "swtype": swtype};
        if ( subid ) { nvpreq["subid"] = subid; }
        curl_call(host, header, nvpreq, false, "POST", getActionResponse);
    } else if ( hub["hubType"]==="ISY" ) {
        var hubAccess = hub["hubAccess"];
        var buff = Buffer.from(hubAccess);
        var base64 = buff.toString('base64');
        stheader = {"Authorization": "Basic " + base64};
        var cmd;
        if ( subid==="level" ) {
            cmd = "/nodes/" + swid + "/cmd/DON/" + swval;
        } else {
            cmd = "/nodes/" + swid + "/cmd/" + swval;
            if ( subid ) {
                cmd = cmd + "/" + subid;
            }
        }
        curl_call(hubEndpt + cmd, stheader, false, false, "GET", getNodeResponse);

    }
    
    function getActionResponse(err, res, body) {
        // var response = body;
        if ( err ) {
            console.log("Error calling hub: ", err);
        } else {
            console.log("doAction: ", body);
            pushClient(swid, swtype, subid, body);
        }
    }

    function getNodeResponse(err, res, body) {
        if ( err ) {
            console.log("Error calling ISY node: ", err);
        } else {
            var result = parser.parse(body);
            console.log("ISY action: ", result);
        }

    }

}

function queryHub(hub, swid, swtype) {
    if ( hub["hubType"]==="SmartThings" || hub["hubType"]==="Hubitat" ) {
        var access_token = hub["hubAccess"];
        var endpt = hub["hubEndpt"];
        var host = endpt + "/doquery";
        var header = {"Authorization": "Bearer " + access_token};
        var nvpreq = {"swid": swid, "swtype": swtype};
        curl_call(host, header, nvpreq, false, "POST", getQueryResponse);
    } else if ( hub["hubType"]==="ISY" ) {
        var hubAccess = hub["hubAccess"];
        var buff = Buffer.from(hubAccess);
        var base64 = buff.toString('base64');
        stheader = {"Authorization": "Basic " + base64};
        var cmd = "/nodes/" + swid;
        curl_call(hubEndpt + cmd, stheader, false, false, "GET", getNodeQueryResponse);
    }
    
    function getQueryResponse(err, res, body) {
        if ( err ) {
            console.log("Error requesting hub query: ", err);
        } else {
            console.log("doQuery: ", body);
            pushClient(swid, swtype, "none", body);
        }
    }

    function getNodeQueryResponse(err, res, body) {
        if ( err ) {
            console.log("Error requesting ISY node query: ", err);
        } else {
            var result = parser.parse(body);
            console.log("ISY query: ", result);
        }

    }

}

function doAction(hubid, swid, swtype, swval, swattr, subid, command, content, macro) {

    // get the hub being acted upon
    var response = "";
    var hub = hubs[0];
    for (var h in hubs) {
        var ahub = hubs[h];
        if ( ahub["hubId"]===hubid ) { hub = ahub; }
    }
    // console.log(hubid, hub);


    // handle clocks
    if ( command==="" && swid==="clockdigital") {
        response = getClock("Digital Clock", "clockdigital", "", "M d, Y", "h:i:s A");
    } else if ( command==="" && swid==="clockanalog" ) {
        response = getClock("Analog Clock", "clockanalog", "CoolClock:swissRail:72", "M d, Y", "h:i:s A");
        
    // this logic is complex so let me explain. First we get the value if available
    // then we get any provided custom name from tile editor
    // then we process all tile customizer settings which can also change the name
    // next we check customizer to see if name and width and height changed
    // finally, we send name, width, height to returnFile routine to get the html tag
    } else if ( command==="" && array_key_exists(swtype, specialtiles) ) {
        var idx = swtype + "|" + swid;
        var thingvalue;
        if ( allthings ) {
            thingvalue = allthings[idx]["value"];
        } else {
            var fw = specialtiles[swtype][1];
            var fh = specialtiles[swtype][2];
            thingvalue = {"name": swtype + "1", "id": swid, "width": fw, "height": fh, "type": swtype};
        }
        
        // thingvalue["name"] = getCustomName(thingvalue["name"], idx);
        // thingvalue = getCustomTile(thingvalue, swtype, swid);
        if ( array_key_exists("width", thingvalue) ) {
            fw = thingvalue["width"];
        } else {
            fw = specialtiles[swtype][1];
        }
        if ( array_key_exists("height", thingvalue) ) {
            fh = thingvalue["height"];
        } else {
            fh = specialtiles[swtype][2];
        }
        thingvalue[swtype] = returnFile(thingvalue["name"], fw, fh, swtype );
        response = thingvalue;
    } else {
        callHub(hub, swid, swtype, swval, swattr, subid);
        response = "success";
    }

    // while (!finished) { }
    return response;
}

function doQuery(hubid, swid, swtype) {
    var result;
    if ( swid==="all" && swtype==="all" && allthings ) {
        // getAllThings(true);
        result = {};
        for (var idx in allthings) {
            var res = allthings[idx];
            var tileid = GLB.options["index"][idx];
            result[tileid] = res;
        }
    } else {
        var idx = swtype + "|" + swid;
        result = allthings[idx]["value"];
    }
    return result;
}

function getHeader(skin) {
    
    var $tc = '<!DOCTYPE html>';
    $tc += '<html><head><title>House Panel</title>';
    $tc += '<meta content="text/html; charset=iso-8859-1" http-equiv="Content-Type">';
    
    // specify icon and color for windows machines
    $tc += '<meta name="msapplication-TileColor" content="#2b5797">';
    $tc += '<meta name="msapplication-TileImage" content="media/mstile-144x144.png">';
    
    // specify icons for browsers and apple
    $tc += '<link rel="icon" type="image/png" href="media/favicon-16x16.png" sizes="16x16"> ';
    $tc += '<link rel="icon" type="image/png" href="media/favicon-32x32.png" sizes="32x32"> ';
    $tc += '<link rel="icon" type="image/png" href="media/favicon-96x96.png" sizes="96x96"> ';
    $tc += '<link rel="apple-touch-icon" href="media/apple-touch-icon.png">';
    $tc += '<link rel="shortcut icon" href="media/favicon.ico">';
    
    // load jQuery and themes
    $tc += '<link rel="stylesheet" type="text/css" href="jquery-ui.css">';
    $tc += '<script src="jquery-1.12.4.min.js"></script>';
    $tc += '<script src="jquery-ui.min.js"></script>';

    // include hack from touchpunch.furf.com to enable touch punch through for tablets
    $tc += '<script src="jquery.ui.touch-punch.min.js"></script>';
    
    // minicolors library
    $tc += '<script src="jquery.minicolors.min.js"></script>';
    $tc += '<link rel="stylesheet" href="jquery.minicolors.css">';

    // analog clock support
    $tc += '<!--[if IE]><script type="text/javascript" src="excanvas.js"></script><![endif]-->';
    $tc += '<script type="text/javascript" src="coolclock.js"></script>';
    
    // load main script file
    $tc += '<script type="text/javascript" src="housepanel.js"></script>';  
    
    // check for valid skin folder
    if (!skin) {
        skin = "skin-housepanel";
    }
    
    // load tile editor fixed css file with cutomization helpers
    $tc += "<script type='text/javascript' src='tileeditor.js'></script>";
    $tc += "<link id='tileeditor' rel='stylesheet' type='text/css' href='tileeditor.css'>";	

    // load tile customizer
    $tc += '<script type="text/javascript" src="customize.js"></script>';

    // load the main css file
    $tc += "<link rel=\"stylesheet\" type=\"text/css\" href=\"" + skin + "/housepanel.css\">";

    // load the custom tile sheet if it exists
    // replaced logic to make customizations skin specific
    $tc += "<link id=\"customtiles\" rel=\"stylesheet\" type=\"text/css\" href=\"" + skin + "/customtiles.css\">";
    
    // begin creating the main page
    $tc += '</head><body>';
    $tc += '<div class="maintable">';
    return $tc;
}

function getFooter() {
    return "</div></body></html>";
}

// renders the main page
function mainPage(proto, hostname) {
    var $tc = "";

    var thingoptions = GLB.options["things"];
    var roomoptions = GLB.options["rooms"];
    var indexoptions = GLB.options["index"];
    var skin = getSkin();
    var kioskmode = GLB.config["kiosk"];
    if ( kioskmode === "true" || kioskmode===1 || kioskmode==="yes" ) {
        kioskmode = true;
    } else {
        kioskmode = false;
    }
    GLB.returnURL = "hpserver.js";

    $tc += getHeader("skin-housepanel");

    if ( DEBUG2 ) {
        console.log(GLB.options);
    }
    // make sure our active skin has a custom file
    if ( !fs.existsSync(skin + "/customtiles.css") ) {
        writeCustomCss(skin, "");
    }
    
    // create our user options file
    // writeOptions(GLB.options);

    // console.log("in mainpage -- roomoptions = ", roomoptions);

    // new wrapper around catalog and things but excluding buttons
    $tc += '<div id="dragregion">';
    $tc += '<div id="tabs"><ul id="roomtabs">';

    // show all room with whatever index number assuming unique
    // foreach (roomoptions as $room => $k) {
    for (var room in roomoptions) {
        var k = roomoptions[room];
        if ( thingoptions[room] ) {
            var adder= "<li roomnum=\"" + k + "\" class=\"tab-" + room + "\"><a href=\"#" + room + "-tab\">" + room + "</a></li>";
            $tc += adder;
            if ( DEBUG3 ) {
                console.log("added: ", adder, "\r\n\r\n");
            }
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
            var pgobj = getNewPage(cnt, room, k, things, kioskmode);
            $tc += pgobj.tc;
            cnt = pgobj.cnt;
        }
    }

    // include doc button and username that is logged in
    $tc += '<div id="showversion" class="showversion">';
    // $tc += '<span id="infoname">' + uname + "</span><span> - V" + HPVERSION + '</span>';
    $tc += '<div id="showdocs"><a href="http://www.housepanel.net" target="_blank">?</a></div>';
    $tc += "</div>";

    // end of the tabs
    $tc += "</div>";

    // end drag region enclosing catalog and main things
    $tc += "</div>";

    // set the websock servername as same as hosted page but different port
    var webSocketUrl = "";
    if ( GLB.config.webSocketServerPort && !isNaN(parseInt(GLB.config.webSocketServerPort)) ) {
        var icolon = hostname.indexOf(":");
        if ( icolon >= 0 ) {
            webSocketUrl = "ws://" + hostname.substr(0, icolon);
        } else {
            webSocketUrl = "ws://" + hostname;
        }
        webSocketUrl = webSocketUrl + ":" + GLB.config.webSocketServerPort;
    }
    
    // include form with useful data for js operation
    $tc += "<form id='kioskform'>";
    $tc += hidden("pagename", "main");

    // save the socket address for use on js side
    // var webSocketUrl = GLB.config.webSocketServerPort ? ("ws://" + serverName + ":" + GLB.config.webSocketServerPort) : "";
    $tc += hidden("webSocketUrl", webSocketUrl);

    // save Node.js address for use on the js side
    // var nodejsUrl = GLB.config.port ? ( is_ssl() + serverName + ":" + GLB.config.port ) : "";
    var nodejsUrl = proto + "://" + hostname
    $tc += hidden("returnURL", nodejsUrl);

    // console.log("page = ", $tc);

//        var datetimezone = new DateTimeZone($timezone);
//        var datetime = new DateTime("now", $datetimezone);
//        var tzoffset = timezone_offset_get($datetimezone, $datetime);
//        $tc += hidden("tzoffset", $tzoffset);
//        $tc += hidden("skin", $skin, "skinid");

    // show user buttons if we are not in kiosk mode
    if ( !kioskmode ) {
        $tc += "<div id=\"controlpanel\">";
        $tc +='<div id="showoptions" class="formbutton">Options</div>';
        $tc +='<div id="refresh" class="formbutton">Refresh</div>';
        $tc +='<div id="refactor" class="formbutton confirm">Reset</div>';
        $tc +='<div id="reauth" class="formbutton confirm">Hub Auth</div>';
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

    $tc += getFooter();
        
    return $tc;
}

// ***************************************************
// beginning of main routine
// ***************************************************
GLB.uname = 'default';

// read the config file
setSpecials();
readOptions();
getAllThings(true);

// get array of hubs
var hubs = GLB.options["config"]["hubs"];

port = GLB.config.port;
if ( !port ) {
    port = 3080;
}

// start our main server
try {
    // the Node.js app loop - can be invoked by client or back end
    app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    var dir = path.join(__dirname, '');
    app.use(express.static(dir));

    // list on the port
    app.listen(port, function () {
        console.log((new Date()) + " HousePanel Server is running on port: ", port);
    });
    applistening = true;
    
} catch (e) {
    console.log((new Date()) + ' HousePanel Node.js server could not be started on port: ', port);
    app = null;
    applistening = false;
}

// create the HTTP server for handling sockets
server = http.createServer(function(req, res) {
});


if ( server && GLB.config.webSocketServerPort ) {
    // create the webSocket server
    wsServer = new webSocketServer({
        httpServer: server
    });
    server.listen(GLB.config.webSocketServerPort, function() {
        console.log((new Date()) + " webSocket Server is listening on port: ", GLB.config.webSocketServerPort);
    });
    serverlistening = true;
} else {
    serverlistening = false;
    console.log((new Date()) + " webSocket port not valid. webSocketServerPort= ", GLB.config.webSocketServerPort);
}
    
// handler functions for HousePanel
// this is where we render the baseline web page for the dashboard
if ( app && applistening ) {

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
        if ( req.path==="/") {
            var hostname = req.protocol + "://" + req.headers.host;
            console.log((new Date()) + " serving pages at: ", hostname);
            var $tc = mainPage(req.protocol, req.headers.host);
            // console.log(GLB.options);
            res.send($tc);
            res.end();
        } else {
            var file = path.join(dir, req.path.replace(/\/$/, '/index.html'));
            if (file.indexOf(dir + path.sep) !== 0) {
                return res.status(403).end('Forbidden');
            }
            console.log((new Date()) + " loading module: ", req.path, " as: ", file);
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
    
// ***************************************************
// these are server treatments for processing jQuery
// ***************************************************
    
    app.post("/", function (req, res) {

        // handle two types of messages posted from hub
        // the first initialize type tells Node.js to update elements
        if ( req.body['msgtype'] == "initialize" ) {
            res.json('hub info updated');
            console.log((new Date()) + "New hub authorized; updating things in hpserver.");
            readOptions();
            getAllThings(true);
        
        // handle api calls from the hubs here
        } else if ( req.body['msgtype'] == "update" ) {
            console.log((new Date()) + "Received update msg from hub.");

            // loop through all things for this hub
            // remove music trackData field that we don't know how to handle
            var cnt = 0;
            for (var num= 0; num< allthings.length; num++) {

                var entry = allthings[num];
                if ( entry.id == req.body['change_device'].toString() &&
                    req.body['change_attribute']!='trackData' &&
                    entry['value'][req.body['change_attribute']] != req.body['change_value'] )
                {
                    cnt = cnt + 1;
                    entry['value'][req.body['change_attribute']] = req.body['change_value'];
                    if ( entry['value']['trackData'] ) { delete entry['value']['trackData']; }
                    console.log((new Date()) + 'updating tile #',entry['id'],' from trigger:',
                                req.body['change_attribute'],' to ', clients.length,' hosts. value= ', JSON.stringify(entry['value']) );

                    pushClient(entry.id, entry.type, req.body['change_attribute'], entry['value'])
                }
            }
            res.json('pushed new status info to ' + cnt + ' tiles');

        // handle all api calls upon the server from js client here
        } else if ( typeof req.body['useajax']!=="undefined" || typeof req.body["api"]!=="undefined" ) {
            
            if ( req.body['useajax'] ) {
                var api = req.body['useajax'];
            } else {
                api = req.body['api'];
            }
            var swid = req.body["id"] || "0";
            var swtype = req.body["type"] || "none";
            var swval = req.body["value"] || "none";
            var swattr = req.body["attr"] || "none";
            var subid = req.body["subid"] || "";
            var tileid = req.body["tile"] || "";
            var hubid = req.body["hubid"] || hubs[0]["hubId"];
            var result;
            
            switch(api) {
                
                case "doaction":
                    result = doAction(hubid, swid, swtype, swval, swattr, subid);
                    res.json(result);
                    break;
                    
                case "doquery":
                    result = doQuery(hubid, swid, swtype, swval, swattr, subid);
                    res.json(result);
                    break;
                    
                case "getthings" :
                    var reload = ( req.body['swattr']==="reload" );
                    getAllThings(reload);
                    res.json(allthings);
                    break;
                    
                case "getoptions":
                    var reload = ( req.body['swattr']==="reload" );
                    if ( reload ) {
                        readOptions();
                    }
                    res.json(GLB.options);
                    break;
                    
                case "refresh":
                    getAllThings(true);
                    res.json("success");
                    break;
                    
                case "savetileedit":
                    console.log("savetileedit... TODO...");
                    res.json("success");
                    break;
        
                case "refactor":
                    // this user selectable option will renumber the index
                    $allthings = getAllThings(true);
                    refactorOptions();
                    break;
                    
                default:
                    res.json(req.body);
                    break;
            }
            
        } else {
            console.log((new Date()) + "hpserver received unknown message.", req.body);
            res.json('hpserver received unknown message.');
        }

    });
}

// This callback function handles new connections and closed connections
if ( wsServer && serverlistening ) {
    wsServer.on('request', function(request) {
        console.log((new Date()) + ' Connecting websocket to: ', request.origin);

        // accept connection - you should check 'request.origin' to make sure that
        // client is connecting from your website
        // (http://en.wikipedia.org/wiki/Same_origin_policy)
        var connection = request.accept(null, request.origin); 
        
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
        console.log((new Date()) + ' Connection accepted. Client #' + index + " host=" + host);

        // user disconnected - remove all clients that match this socket
        connection.on('close', function(reason, description) {
            var host = connection.socket.remoteAddress;
            console.log((new Date()) + " Peer: ", host, " disconnected. for: ", reason, " desc: ", description);

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
