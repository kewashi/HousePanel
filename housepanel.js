/* javascript file for HousePanel
 * 
 * Developed by Ken Washington @kewashi
 * Designed for use only with HousePanel for Hubitat and SmartThings
 * (c) Ken Washington 2017 - 2020
 * 
 */

// globals array used everywhere now
var cm_Globals = {};
cm_Globals.thingindex = null;
cm_Globals.allthings = null;
cm_Globals.options = null;
cm_Globals.returnURL = "";
cm_Globals.hubId = "all";

var modalStatus = 0;
var modalWindows = {};
var priorOpmode = "Operate";
var pagename = "main";

// set a global socket variable to manage two-way handshake
// var webSocketUrl = null;
// var wsinterval = null;
var reordered = false;

// set this global variable to true to disable actions
// I use this for testing the look and feel on a public hosting location
// this way the app can be installed but won't control my home
// end-users are welcome to use this but it is intended for development only
// use the timers options to turn off polling
cm_Globals.disablepub = false;
cm_Globals.logwebsocket = false;

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

function setCookie(name, value, options={path: "/", expires: 365, SameSite: "lax" } ) {

    if ( typeof options !== "object" ) {
        options={path: "/", expires: 365, SameSite: "strict" } 
    }
    if ( !options.path ) {
        options.path = "/";
    }
    if ( !options.expires || typeof options.expires!=="number" ) {
        options.expires = 365;
    }
    if ( !options.SameSite ) {
        options.SameSite = "strict";
    }
  
    if (options.expires instanceof Date) {
        options.expires = options.expires.toUTCString();
    } else if ( options.expires instanceof Number) {
        var d = new Date();
        d.setTime(d.getTime() + (options.expires*24*3600*1000));
        options.expires = d.toUTCString();
    }

    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
  
    for (let optionKey in options) {
      updatedCookie += "; " + optionKey;
      let optionValue = options[optionKey];
      if (optionValue !== true) {
        updatedCookie += "=" + optionValue;
      }
    }
  
    document.cookie = updatedCookie;
  }

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function formToObject(id) {
    var myform = document.getElementById(id);
    if ( myform ) {
        var formData = new FormData(myform);
        var obj = {};
        for ( var fv of formData.entries() ) {
            if ( typeof obj[fv[0]] === "undefined" ) {
                obj[fv[0]] = fv[1];
            } else if ( typeof obj[fv[0]] === "object" ) {
                obj[fv[0]].push(fv[1]);
            } else {
                obj[fv[0]] = [obj[fv[0]]];
                obj[fv[0]].push(fv[1]);
            }
        }
    } else {
        obj = null;
    }
    return obj;
}


function is_function(obj) {
    var test1 = Object.prototype.toString.call(obj) == '[object Function]';
    var test2 = Function.prototype.isPrototypeOf(obj);
    // console.log("test1= ", test1," test2= ", test2);
    return test1 || test2;
}

function strObject(o, level) {
    var out = '';
    if ( !level ) { level = 0; }
  
    if ( typeof o !== "object") { return o + '\n'; }
    
    for (var p in o) {
      out += '  ' + p + ': ';
      if (typeof o[p] === "object") {
          if ( level > 6 ) {
              out+= ' ...more beyond level 6 \n';
              out+= JSON.stringify(o);
          } else {
              out += strObject(o[p], level+1);
          }
      } else {
          out += o[p] + '\n';
      }
    }
    return out;
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// don't need the reload feature for Node since we do this every time page loads
// which happens every time after reading all the things from a hub
// function getAllthings() {
//         $.post(cm_Globals.returnURL, 
//             {useajax: "getthings", id: "none", type: "none", attr: ""},
//             function (presult, pstatus) {
//                 if (pstatus==="success" && typeof presult==="object" ) {
//                     var keys = Object.keys(presult);
//                     cm_Globals.allthings = presult;
//                     console.log("getAllthings returned from " + cm_Globals.returnURL + " " + keys.length + " things");
//                 } else {
//                     console.log("Error: failure obtaining things from HousePanel: ", presult);
//                     cm_Globals.allthings = null;
//                 }
//             }, "json"
//         );
// }

// obtain options using an ajax api call
// could probably read Options file instead
// but doing it this way ensure we get what main app sees
function getOptions(dosetup) {
    var doreload = "";
    try {
        var userid = $("#userid").val();
        var email = $("#emailid").val();
        var skin = $("#skinid").val();
        var config = $("#configsid").val();
        config = JSON.parse(config);
        cm_Globals.options = {userid: userid, email: email, skin: skin, config: config, rules: null};
        // console.log("getOptions returned: ", config);
        setFastSlow(config);

        // set the customization list
        $.post(cm_Globals.returnURL, 
            {useajax: "getoptions", userid: userid, id:"none", type:"none"},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    // console.log(">>>> presult: ", presult);
                    cm_Globals.options.rules = presult;

                    var indexkeys = Object.keys(presult);
                    console.log("getOptions returned: " + indexkeys.length + " configuration rules/links");
                } else {
                    console.log("error - failure reading config options from database for user = " + userid);
                }
            }, "json"
        );
    } catch(e) {
        console.log("error - failure reading your hmoptions.cfg file");
    }

    function setFastSlow(config) {
        try {
            var fast_timer = config.fast_timer;
            fast_timer = parseInt(fast_timer, 10);
            var slow_timer = config.slow_timer;
            slow_timer = parseInt(slow_timer, 10);
        } catch(err) {
            console.log ("Couldn't retrieve slow or fast timers; using defaults. err: ", err);
            fast_timer = 0;
            slow_timer = 0;
        }
        if ( fast_timer && fast_timer >= 1000 ) {
            setupTimer("fast", fast_timer, "all");
        }
        if ( slow_timer && slow_timer >= 1000 ) {
            setupTimer("slow", slow_timer, "all");
        }

        // TODO - use refresh field to set up timers for all things
    }
}

$(document).ready(function() {
    // set the global return URL value
    try {
        cm_Globals.returnURL = $("input[name='returnURL']").val();
        if ( !cm_Globals.returnURL ) {
            throw "Return URL not defined by host page. Using default.";
        }
    } catch(e) {
        console.log("***Warning*** ", e);
        cm_Globals.returnURL = "http://localhost:3080";
    }

    try {
        pagename = $("input[name='pagename']").val();
    } catch(e) {
        pagename = "main";
    }
    
    try {
        var pathname = $("input[name='pathname']").val();
    } catch(e) {
        pathname = "/";
    }

    // reroute to main page if undefined asked for
    if ( pathname==="/undefined" ) {
        window.location.href = cm_Globals.returnURL;
    }
    // alert(pathname + " returnURL= " + cm_Globals.returnURL);

    // show tabs and hide skin
    if ( pagename==="main" ) {
        $("#tabs").tabs();
        var tabcount = $("li.ui-tabs-tab").length;

        // hide tabs if there is only one room
        if ( tabcount === 1 ) {
            toggleTabs();
        }
    
        // get default tab from cookie and go to that tab
        var defaultTab = getCookie( 'defaultTab' );
        if ( defaultTab && tabcount > 1 ) {
            try {
                $("#"+defaultTab).click();
            } catch (e) {
                defaultTab = $("#roomtabs").children().first().attr("aria-labelledby");
                setCookie('defaultTab', defaultTab);
                try {
                    $("#"+defaultTab).click();
                } catch (f) {
                    console.log(f);
                }
            }
        }
    }

    // auth page is displayed until reload with updated info so blink
    if ( pagename==="auth" ) {
        if ( $("#newthingcount") && $("#newthingcount").html().startsWith("Retrieving") ) {
            var blinkauth = setInterval(function() {
                $("#newthingcount").fadeTo(400, 0.1 ).fadeTo(400, 1);
            }, 1000);
        }
    }
    
    // create key bindings for the login screen
    if ( pagename==="login" ) {

        initWebsocket();

        var unamere = /^\D\S{3,}$/;      // start with a letter and be four long at least
        // $("#uname").val("default");
        $("#uname").focus();
        $("#loginform").on("keydown", function(e) {
            if ( e.which===27  ){
                $("#uname").val("");
                $("#pword").val("");
            }
        });

        $("#uname").on("keydown",function(e) {
            var unameval = $("#uname").val();
            if ( e.which===13 ){
                var msg = checkInpval("username", unameval, unamere);
                if ( msg ) {
                    $("#uname").focus();
                    alert(msg);
                } else {
                    $("#pword").val("");
                    $("#pword").focus();
                }
                // e.stopPropagation();
            }
        });

        // $("#pword").on("keydown",function(e) {
        //     if ( e.which===13 ){
        //         execButton("dologin");
        //         e.stopPropagation();
        //     }
        // });
    }

    // load things and options
    if ( pagename==="main" || pagename==="auth" ) {

        getOptions(true);
        
        // disable return key
        $("body").off("keypress");
        $("body").on("keypress", function(e) {
            if ( e.keyCode===13  ){
                return false;
            }
        });
    }
    
    // handle button setup for all pages
    setupButtons();
    
    // handle interactions for the options page
    if (pagename==="options") {
        getOptions();
        setupCustomCount();
        setupFilters();
    }

    // handle interactions for main page
    // note that setupFilters will be called when entering edit mode
    if ( pagename==="main" ) {
        initWebsocket();
        setupTabclick();
        cancelDraggable();
        cancelSortable();
        cancelPagemove();
        clockUpdater();
        // setInterval( clockUpdater, 60000 );

        // finally we wait a moment then setup page clicks
        if ( !cm_Globals.disablepub ) {
            setTimeout(function() { 
                setupPage(); 
                setupSliders();
                setupColors();
                // now handle blackout differently in the proceessHub function on server
            }, 200);
        }
    }

});

function checkLogin() {
    var pwordre = /^\S{6,}$/;        // start with anything but no white space and at least 6 digits 
    var pwordval = $("#pword").val();
    var msg = checkInpval("password", pwordval, pwordre);
    if ( pwordval!=="" && msg ) {
        $("#pword").focus();
        alert(msg);
        return false;
    }
    return true;
}

function initWebsocket() {

    // get the webSocket info
    try {
        var userid = $("#userid").val();
        var webSocketUrl = $("input[name='webSocketUrl']").val();
    } catch(err) {
        webSocketUrl = null;
    }
    
    // set up socket
    if ( webSocketUrl ) {
        setupWebsocket(userid, webSocketUrl);
    }

    // now try to set up web sockets for ISY hubs
    // setupISYSocket("http://192.168.11.31/rest", "admin:ag86Nuke");

}

function setupISYSocket(hubhost, hubaccess) {
    
    // var userid = cm_Globals.options.userid;
    // var hubs = JSON.parse(cm_Globals.options.hubs);
    // hubs.forEach(function(hub) {
    // if this hub is an ISY hub then set up a websocket to push results to our browser

        // var buff = new ArrayBuffer(hubaccess);
        // var base64 = buff.toString('base64');

        if ( hubhost.startsWith("https://") ) {
            wshost = "wss://" + hubaccess + "@" + hubhost.substr(8);
        } else if ( hubhost.startsWith("http://") ) {
            wshost = "ws://" + hubaccess + "@" + hubhost.substr(7);
        }
        wshost = wshost + "/subscribe";
        // wshost = wshost + "/subscribe?Origin=com.universal-devices.websockets.isy";

        // set up socket for ISY hub if one is there
        var protocols = "ISYSUB";
        var wsclient = new WebSocket(wshost, protocols);

        // var buff = Buffer.from(hub.hubaccess);
        // var base64 = buff.toString('base64');
        // var origin = "com.universal-devices.websockets.isy";
        // var header = {"Authorization": "Basic " + base64, "Sec-WebSocket-Protocol": "ISYSUB",  
        //             "Sec-WebSocket-Version": "13", "Origin": "com.universal-devices.websockets.isy"};

        wsclient.onopen = function(event) {
            console.log( "webSocket opened: ", event);
        }

        // handle incoming state messages from ISY
        // this will be ignored if the node isn't in our list
        wsclient.onmessage = function(event) {
            var msg = event.data;
            console.log("webSocket message: ", msg);
            // if ( msg.type==="utf8" ) {
            //     processIsyMessage(msg.utf8Data);
            // }
        }
        
        wsclient.onerror = function(event) {
            console.log( "webSocket error: ", event );
        }
        
        wsclient.onclose = function(event) {
            if ( event.wasClean ) {
                console.log( "Connection closed to ISY socket: ");
            } else {
                console.log( "webSocket Error - closing connection to ISY socket: ", event);
            }
        }

}

// new routine to set up and handle websockets
// only need to do this once - I have no clue why it was done the other way before
function setupWebsocket(userid, webSocketUrl) {
    var wsSocket = null;

    try {
        console.log("Creating webSocket for: ", webSocketUrl);
        wsSocket = new WebSocket(webSocketUrl);
    } catch(err) {
        console.log("Error attempting to create webSocket for: ", webSocketUrl," error: ", err);
        return;
    }
    
    // upon opening a new socket notify user and do nothing else
    wsSocket.onopen = function() {
        console.log("webSocket connection opened for: ", webSocketUrl);

        function sendUser() {
            if ( wsSocket.readyState === wsSocket.OPEN ) {
                wsSocket.send(userid.toString());
            }
        }
        // console.log( "ready state: ",  wsSocket.readyState );
        sendUser();
    };
    
    wsSocket.onerror = function(evt) {
        console.error("webSocket error: ", evt);
    };
    
    wsSocket.onclose = function() {
        console.log("webSocket connection closed for: ", webSocketUrl);
    };

    // received a message from housepanel-push or hpserver.js
    // this contains a single device object
    // this is where pushClient is processed for hpserver.js
    wsSocket.onmessage = function (evt) {
        var reservedcap = ["name", "password", "DeviceWatch-DeviceStatus", "DeviceWatch-Enroll", "checkInterval", "healthStatus"];

        try {
            var presult = JSON.parse(evt.data);
            var bid = presult.id;
            var thetype = presult.type;
            var pvalue = presult.value;
            var clientcount = presult.clientcount;
            var subid = presult.trigger;
            if ( cm_Globals.options && cm_Globals.options.config && cm_Globals.options.config.blackout ) {
                var blackout = cm_Globals.options.config.blackout;
            } else {
                blackout = false;
            }

            // reload page if signalled from server
            if ( bid==="reload" ) {

                // skip reload if we are asleep
                if ( priorOpmode !== "Operate" ) {
                    return;
                }

                // only reload this page if the trigger is this page name, blank, or all
                if ( !thetype || thetype==="all" || thetype===pagename ) {

                    // reload all screens if that is requested
                    if ( typeof subid==="undefined" || subid==="" || subid==="/" || subid==="reload" || subid==="/reload" ) {
                        var reloadpage =  cm_Globals.returnURL;
                        window.location.href = reloadpage;

                    } else {
                        if ( subid.substr(0,1)!=="/" ) {
                            subid = "/" + subid;
                        }
                        reloadpage =  cm_Globals.returnURL + subid;
                        alert("reloading to: " + reloadpage);
                        window.location.href = reloadpage;
                        
                    }
                }

            // now process messages intended for the hub auth page
            // we can either pass in a pvalue object with key/val pairs
            // or given a specific "key" in the type and value in pvalue
            // the thetype parameter names the page or "all" for any page
            } else if (bid==="pagemsg" ) {

                if ( !thetype || thetype==="all" || thetype===pagename ) {
                    if (  typeof pvalue==="object" ) {
                        for (var key in pvalue) {
                            if ( $(key) ) {
                                $(key).html(pvalue[key]);
                            }
                        }
                    } else if ( subid && typeof subid==="string" && typeof pvalue==="string" && $(subid) ) {
                        $(subid).html(pvalue);
                    }
                }

            } else if (bid==="setposition" ) {

                // console.log(">>>> thetype: ", thetype, " pvalue: ", pvalue);
                // var thing = $("div.thing[thingid='"+thetype+"']");
                var thing = $("#t-"+thetype);
                if ( thing ) {
                    // console.log("moved thing: ", thing.html());
                    relocateTile(thing, pvalue);
                }

            } else if ( bid && thetype && pvalue && typeof pvalue==="object" ) {

                // expand objects if returned
                // update the global allthings array
                for ( var psubid in pvalue ) {
                    try {
                        var jsontval = JSON.parse(pvalue[psubid]);
                    } catch (jerr) {
                        jsontval = null;
                    }
                    if ( jsontval && typeof jsontval==="object" ) {
                        for (var jtkey in jsontval ) {
                            var jindex = psubid + "_" + jtkey.toString();
                            pvalue[jindex] = jsontval[jtkey];
                        }
                        delete pvalue[psubid];
                    }
                }

                // grab name and subid for console log
                var pname = pvalue["name"] ? pvalue["name"] : "";

                // remove reserved fields
                $.each(reservedcap, function(index, val) {
                    if ( pvalue[val] ) {
                        delete pvalue[val];
                    }
                });
                
                if ( cm_Globals.logwebsocket ) {
                    console.log("webSocket message from: ", webSocketUrl," bid= ",bid," name:",pname," client:",client," of: ",clientcount," type= ",thetype," subid= ",subid," value= ",pvalue);
                }
        
                // change not present to absent for presence tiles
                // it was an early bad design decision to alter ST's value that I'm now stuck with
                if ( pvalue["presence"] && pvalue["presence"] ==="not present" ) {
                    pvalue["presence"] = "absent";
                }

                // console.log("websocket tile update. id: ", bid, " type: ", thetype, " pvalue: ", pvalue);
                // update all the tiles that match this type and id
                // this now works even if tile isn't on the panel
                $('div.panel div.thing[bid="'+bid+'"][type="'+thetype+'"]').each(function() {
                    try {
                        var aid = $(this).attr("aid");
                        updateTile(aid, pvalue);
                    } catch (e) {
                        console.log("Error updating tile of type: "+ thetype + " and id: " + bid + " with value: ", pvalue);
                        console.log(e);
                    }
                });

                // handle links - loop through all tiles that have a link to see if they match
                // because this link shadow field has the real subid triggered we dont have to check subid below
                // fixed old bug that assumed sibling was next item, which isn't true for variables
                // console.log("linkbid= ", bid, "subid= ", subid, " pvalue: ", pvalue);
                $('div.panel div[command="LINK"][linkbid="' + bid + '"][subid="' + subid + '"]').each(function() {

                    // get the id to see if it is the thing being updated
                    var linkedtile = $(this).attr("linkval");
                    var src = $("div.thing.p_"+linkedtile);
                    var lbid = src.attr("bid");
                    var thisbid = $(this).attr("linkbid");

                    // if we have a match, update the sibling field
                    if ( lbid === thisbid ) {
                        var aid = $(this).attr("aid");
                        var sibling = $("#a-"+aid+"-"+subid);
                        var oldvalue = sibling.html();
                        var oldclass = sibling.attr("class");
                        var value = pvalue[subid];

                        // swap out the class and change value
                        // this should match logic in hpserver.js in putElement routine
                        if ( oldclass && oldvalue && value && typeof value==="string" &&
                            subid!=="name" && subid!=="trackImage" && subid!=="color" && subid!=='ERR' && subid!=="date" && subid!=="time" &&
                            !subid.startsWith("_") && subid.substr(0,6)!=="event_" &&
                            subid!=="trackDescription" && subid!=="mediaSource" &&
                            subid!=="currentArtist" && subid!=="currentAlbum" && subid!=="groupRole" &&
                            value.indexOf(" ")===-1 && oldvalue.indexOf(" ")===-1 &&
                            value.substr(0,7)!=="number_" &&
                            value.indexOf("://")===-1 &&
                            value.indexOf("::")===-1 &&
                            value.indexOf("rgb(")===-1 &&
                            value.length < 30 &&
                            $.isNumeric(value)===false && 
                            $.isNumeric(oldvalue)===false &&
                            oldclass.indexOf(oldvalue)>=0 ) 
                        {
                                $(sibling).removeClass(oldvalue);
                                $(sibling).addClass(value);
                        }

                        if ( subid==="level" || subid==="onlevel" || subid==="colortemperature" || subid==="volume"  && $(sibling).slider ) {
                            $(sibling).slider("value", value);
                        } else {
                            $(sibling).html( value );
                        }
                    }
                });

                // blank screen if night mode set
                if ( (thetype==="mode" ) && 
                     (blackout==="true" || blackout===true) && (priorOpmode === "Operate" || priorOpmode === "Sleep") ) {
                    if ( pvalue.themode === "Night" ) {
                        execButton("blackout");
                    } else if ( $("#blankme") ) {
                        $("#blankme").off("click");
                        $("#blankme").remove(); 
                        priorOpmode = "Operate";
                    }
                }
            }

        } catch (err) {
            console.log("Error interpreting webSocket message. err: ", err);
            return;
        };
    }
}

function rgb2hsv(r, g, b) {
     //remove spaces from input RGB values, convert to int
     var r = parseInt( (''+r).replace(/\s/g,''),10 ); 
     var g = parseInt( (''+g).replace(/\s/g,''),10 ); 
     var b = parseInt( (''+b).replace(/\s/g,''),10 ); 

    if ( r===null || g===null || b===null ||
         isNaN(r) || isNaN(g)|| isNaN(b) ) {
        return {"hue": 0, "saturation": 0, "level": 0};
    }
    
    if (r<0 || g<0 || b<0 || r>255 || g>255 || b>255) {
        return {"hue": 0, "saturation": 0, "level": 0};
    }
    r /= 255, g /= 255, b /= 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
    h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }
    h = Math.floor(h * 100);
    s = Math.floor(s * 100);
    v = Math.floor(v * 100);

    return {"hue": h, "saturation": s, "level": v};
}

function getMaxZindex(panel) {
    var zmax = 1;
    var target = "div.panel";
    if ( panel ) {
        target = target + "-" + panel;
    }
    $(target+" div.thing").each( function() {
        var zindex = $(this).css("z-index");
        if ( zindex ) {
            zindex = parseInt(zindex, 10);
            if ( !isNaN(zindex) && zindex > zmax && zindex < 999) { zmax = zindex; }
        }
    });
    if ( zmax >= 998 ) {
        zmax = 1;
    }
    return zmax;
}

function convertToModal(modalcontent, addok) {
    if ( typeof addok === "string" )
    {
        modalcontent = modalcontent + '<div class="modalbuttons"><button name="okay" id="modalokay" class="dialogbtn okay">' + addok + '</button></div>';
    } else {
        modalcontent = modalcontent + '<div class="modalbuttons"><button name="okay" id="modalokay" class="dialogbtn okay">Okay</button>';
        modalcontent = modalcontent + '<button name="cancel" id="modalcancel" class="dialogbtn cancel">Cancel</button></div>';
    }
    return modalcontent;
}

function createModal(modalid, modalcontent, modaltag, addok,  pos, responsefunction, loadfunction) {
    // var modalid = "modalid";

    // skip if this modal window is already up...
    if ( typeof modalWindows[modalid]!=="undefined" && modalWindows[modalid]>0 ) { 
        // console.log("modal suppressed: ", modalWindows);
        return; 
    }
    
    modalWindows[modalid] = 1;
    modalStatus = modalStatus + 1;
    // console.log("modalid= ", modalid, "modaltag= ", modaltag, " addok= ", addok, " pos= ", pos, " modalWindows= ", modalWindows, " modalStatus= ", modalStatus);
    
    var modaldata = modalcontent;
    var modalhook;
    
    var postype;
    if ( modaltag && typeof modaltag === "object" ) {
        modalhook = modaltag;
        postype = "relative";
    } else if ( modaltag && (typeof modaltag === "string") && typeof ($(modaltag)) === "object"  ) {
        // console.log("modaltag string: ", modaltag);
        modalhook = $(modaltag);
        if ( modaltag==="body" || modaltag==="document" || modaltag==="window" ) {
            postype = "absolute";
        } else {
            postype = "relative";
        }
    } else {
        // console.log("modaltag body: ", modaltag);
        modalhook = $("body");
        postype = "absolute";
    }
    
    var styleinfo = "";
    if ( pos ) {
        
        // enable full style specification of specific attributes
        if ( pos.style ) {
            styleinfo = " style=\"" + pos.style + "\"";
        } else {
            if ( pos.position ) {
                postype = pos.position;
            }
            styleinfo = " style=\"position: " + postype + ";";
            if ( !isNaN(pos.left) && !isNaN(pos.top) ) {
                styleinfo += " left: " + pos.left + "px; top: " + pos.top + "px;";
            }
            if ( pos.height ) {
                if ( typeof pos.height === "string" ) {
                    var hstr = pos.height + ";";
                } else {
                    hstr = pos.height.toString() + "px;";
                }
                styleinfo += " height: " + hstr;
            }
            if ( pos.width ) {
                if ( typeof pos.width === "string" ) {
                    var wstr = pos.width + ";";
                } else {
                    wstr = pos.width.toString() + "px;";
                }
                styleinfo += " width: " + wstr;
            }
            if ( pos.border ) {
                styleinfo += " border: " + pos.border + ";";
            }
            if ( pos.background ) {
                styleinfo += " background: " + pos.background + ";";
            }
            if ( pos.color ) {
                styleinfo += " color: " + pos.color + ";";
            }
            if ( pos.zindex ) {
                styleinfo += " z-index: " + pos.zindex + ";";
            }
            if ( pos["z-index"] ) {
                styleinfo += " z-index: " + pos["z-index"] + ";";
            }
            styleinfo += "\"";
        }
    }
    
    modalcontent = "<div id='" + modalid +"' class='modalbox'" + styleinfo + ">" + modalcontent;
    if ( addok ) {
        modalcontent = convertToModal(modalcontent, addok);
    }
    modalcontent = modalcontent + "</div>";
    
    modalhook.prepend(modalcontent);
    
    // call post setup function if provided
    if ( loadfunction ) {
        loadfunction(modalhook, modaldata);
    }

    // invoke response to click
    if ( addok ) {
        $("#"+modalid).on("click",".dialogbtn", function(evt) {
            if ( responsefunction ) {
                responsefunction(this, modaldata);
            }
            closeModal(modalid);
        });
    } else {
        // body clicks turn of modals unless clicking on box itself
        // or if this is a popup window any click will close it
        $("body").off("click");
        $("body").on("click",function(evt) {
            if ( (evt.target.id === modalid && modalid!=="modalpopup") || modalid==="waitbox") {
                evt.stopPropagation();
                return;
            } else {
                if ( responsefunction ) {
                    responsefunction(evt.target, modaldata);
                }
                closeModal(modalid);
                $("body").off("click");
            }
        });
        
    }
    
}

function closeModal(modalid) {
    try {
        $("#"+modalid).remove();
    } catch(e) {}

    modalWindows[modalid] = 0;
    modalStatus = modalStatus - 1;
    if ( modalStatus < 0 ) { modalStatus = 0; }
}

function setupColors() {
    
   $("div.overlay.color >div.color").each( function() {
        var that = $(this);
        var aid = that.attr("aid");
        var defcolor = that.html();
        if ( !defcolor ) {
            defcolor = "#FFFFFF";
        }
        $(this).attr("value", defcolor);
        $(this).minicolors({
            position: "bottom left",
            defaultValue: defcolor,
            theme: 'default',
            change: function(hex) {
                try {
                    var oldhex = that.html();
                    that.html(hex);
                    that.attr("value", hex);
                    // close picker if something changed
                    // that.minicolors('hide');
                } catch(e) {}
            },
            hide: function() {
                var newcolor = $(this).minicolors("rgbObject");
                var hexval = $(this).minicolors("value");
                var hsl = rgb2hsv( newcolor.r, newcolor.g, newcolor.b );
                var hslstr = "hsl("+hsl.hue.pad(3)+","+hsl.saturation.pad(3)+","+hsl.level.pad(3)+")";
                var tile = '#t-'+aid;
                var bid = $(tile).attr("bid");
                var hubid = $(tile).attr("hub");
                var thetype = $(tile).attr("type");
                var userid = cm_Globals.options.userid;
                var thingid = $(tile).attr("thingid");
                var tileid = $(tile).attr("tile");
                console.log("setupColors doaction: id: ", bid, " type: ", thetype, " value: ", hslstr, " hex: ", hexval, " attr: color hubid: ", hubid);

                $.post(cm_Globals.returnURL, 
                       {useajax: "doaction", userid: userid, id: bid, thingid: thingid, type: thetype, value: hslstr, 
                        subid: "color", attr: hexval, hubid: hubid, tileid: tileid} );
            }
        });
    });

}

function setupSliders() {
    
    $("div.overlay.level >div.level, div.overlay.onlevel >div.onlevel, div.overlay.volume >div.volume").slider({
        orientation: "horizontal",
        min: 0,
        max: 100,
        step: 5,
        stop: function( evt, ui) {
            var thing = $(evt.target);
            thing.attr("value",ui.value);
            
            var aid = thing.attr("aid");
            var tile = '#t-'+aid;
            var bid = $(tile).attr("bid");
            var hubid = $(tile).attr("hub");
            var subid = thing.attr("subid");
            var thevalue = parseInt(ui.value);
            var thetype = $(tile).attr("type");
            var userid = cm_Globals.options.userid;
            var thingid = $(tile).attr("thingid");
            var tileid = $(tile).attr("tile");
            
            var usertile = thing.siblings(".user_hidden");
            var command = "";
            var linktype = thetype;
            var linkval = "";
            if ( usertile && usertile.length>0 && $(usertile).attr("command") ) {
                command = $(usertile).attr("command");    // command type
                if ( !thevalue ) {
                    thevalue = $(usertile).attr("value");      // raw user provided val
                }
                linkval = $(usertile).attr("linkval");    // urlencooded val
                linktype = $(usertile).attr("linktype");  // type of tile linked to
            }
            
            // console.log(ajaxcall + ": id= "+bid+" type= "+linktype+ " value= " + thevalue + " subid= " + subid + " command= " + command + " linkval: ", linkval);
            console.log("setupSliders doaction: command= " + command + " bid= "+bid+" hub= " + hubid + " type= " + thetype + " linktype= " + linktype + " subid= " + subid + " value= " + thevalue + " linkval= " + linkval);

            $.post(cm_Globals.returnURL, 
                {useajax: "doaction", userid: userid, id: bid, thingid: thingid, type: linktype, value: thevalue, attr: subid, 
                 subid: subid, hubid: hubid, tileid: tileid, command: command, linkval: linkval} );
        }
    });

    // set the initial slider values
    $("div.overlay.level >div.level, div.overlay.onlevel >div.onlevel, div.overlay.volume >div.volume").each( function(){
        var initval = $(this).attr("value");
        $(this).slider("value", initval);
    });

    // now set up all colorTemperature sliders
    $("div.overlay.colorTemperature >div.colorTemperature").slider({
        orientation: "horizontal",
        min: 2000,
        max: 7400,
        step: 200,
        stop: function( evt, ui) {
            var thing = $(evt.target);
            thing.attr("value",ui.value);
            
            var aid = thing.attr("aid");
            var tile = '#t-'+aid;
            var bid = $(tile).attr("bid");
            var hubid = $(tile).attr("hub");
            var ajaxcall = "doaction";
            var subid = thing.attr("subid");
            var thevalue = parseInt(ui.value);
            var thetype = $(tile).attr("type");
            var usertile = thing.siblings(".user_hidden");
            var userid = cm_Globals.options.userid;
            var command = "";
            var linktype = thetype;
            var linkval = "";
            if ( usertile && usertile.length>0 ) {
                command = $(usertile).attr("command");    // command type
                if ( !thevalue ) {
                    thevalue = $(usertile).attr("value");      // raw user provided val
                }
                linkval = $(usertile).attr("linkval");    // urlencooded val
                linktype = $(usertile).attr("linktype");  // type of tile linked to
            }
            
            // console.log(ajaxcall + ": command= " + command + " id= "+bid+" type= "+linktype+ " value= " + thevalue + " subid= " + subid + " command= " + command + " linkval: ", linkval);
            
            $.post(cm_Globals.returnURL, 
                {useajax: ajaxcall, userid: userid, id: bid, type: thetype, value: parseInt(ui.value), 
                          attr: "colorTemperature", subid: subid, hubid: hubid, command: command, linkval: linkval } );
        }
    });

    // set the initial slider values
    $("div.overlay.colorTemperature >div.colorTemperature").each( function(){
        var initval = $(this).attr("value");
        $(this).slider("value", initval);
    });
    
}

function cancelDraggable() {
    $("div.panel div.thing").each(function(){
        if ( $(this).draggable("instance") ) {
            $(this).draggable("destroy");
            
            // remove the position so color swatch stays on top
            if ( $(this).css("left")===0 || $(this).css("left")==="" ) {
                $(this).css("position","");
            }
        }
    });
    
    if ( $("div.panel").droppable("instance") ) {
        $("div.panel").droppable("destroy");
    }

    if ( $("#catalog").droppable("instance") ) {
        $("#catalog").droppable("destroy");
    }
    
    // remove the catalog
    // $("#catalog").remove();
    $("#catalog").hide();
}

function cancelSortable() {
    $("div.panel").each(function(){
        if ( $(this).sortable("instance") ) {
            $(this).sortable("destroy");
        }
    });
    $("div.sortnum").each(function() {
       $(this).remove();
    });
}

function cancelPagemove() {
    if ( $("#roomtabs").sortable("instance") ) {
        $("#roomtabs").sortable("destroy");
    }
    $("div.sortnum").each(function() {
        $(this).remove();
     });
 }

function setupPagemove() {
        
    // loop through each thing in this room and number it
    var num = 0;
    $("#roomtabs li.ui-tab").each(function(){
        num++;
        addSortNumber(this, num.toString(), "li");
    });
    
    // make the room tabs sortable
    // the change function does a post to make it permanent
    $("#roomtabs").sortable({
        axis: "x", 
        items: "> li",
        cancel: "li.nodrag",
        opacity: 0.5,
        containment: "ul.ui-tabs-nav",
        delay: 200,
        revert: false,
        update: function(evt, ui) {
            var pages = [];
            var k = 0;
            // get the new list of pages in order
            // fix nasty bug to correct room tab move
            // updated to pass the object the DB is expecting to update each room
            $("#roomtabs >li.ui-tab").each(function() {
                var pagename = $(this).children().first().text();
                var roomid = $("#panel-"+pagename).attr("roomid");
                pages[k] = {id: roomid, rorder: k, rname: pagename};
                k++;
                // updateSortNumber(this, k.toString());
            });
            var userid = cm_Globals.options.userid;
            console.log("reordering " + k + " rooms: ", pages);
            $.post(cm_Globals.returnURL, 
                {useajax: "setorder", userid: userid, id: "none", type: "rooms", value: pages},
                function (presult, pstatus) {
                    if (pstatus==="success" ) {
                        console.log( "setorder POST returned: ", presult );
                    } else {
                        console.log( "pstatus: ", pstatus, " presult: ", presult );
                    }
                }, "json"
            );
        }
    });
}

function setupSortable() {
    
    // loop through each room panel
    reordered = false;
    $("div.panel").each( function() {
        var panel = $(this).attr("title");
        // console.log("setup sortable: ", panel);
        
        // loop through each thing in this room and number it
        var num = 0;
        $("div.thing[panel="+panel+"][style*='relative']").each(function(){
            num++;
            addSortNumber(this, num.toString(), "div");
        });
    });

    $("div.panel").sortable({
        containment: "parent",
        scroll: true,
        items: "> div[style*='relative']",                  // only select non absolute things
        delay: 50,
        grid: [1, 1],
        stop: function(evt, ui) {
            var panel = $(ui.item).attr("panel");
            var roomid = $("#panel-"+panel).attr("roomid");
            var hubid = $(ui.item).attr("hub");
            var userid = cm_Globals.options.userid;
            var tilenums = [];
            var num = 0;
            $("div.thing[panel="+panel+"][style*='relative']").each(function(){
                // get tile name and number
                // var tilename = $(this).find(".thingname").text();
                var tileid = $(this).attr("tile");
                var thingid = $(this).attr("thingid");
                num++;
                // var tileobj = {id: thingid, updval: {tileid: tileid, torder: num}};
                var tileobj = {id: thingid, tileid: tileid, torder: num, position: "relative"};
                tilenums.push(tileobj);
                
                // update the sorting numbers to show new order
                updateSortNumber(this, num.toString());
            });

            // only proceed if some tiles were relative
            if ( num > 0 ) {
                // now add on the tiles that are absolute to renumber them
                $("div.thing[panel="+panel+"][style*='absolute']").each(function(){
                    var tileid = $(this).attr("tile");
                    var thingid = $(this).attr("thingid");
                    num++;
                    var tileobj = {id: thingid, tileid: tileid, torder: num, position: "absolute"};
                    tilenums.push(tileobj);
                });

                console.log("reordering " + num + " tiles: ", tilenums);
                $.post(cm_Globals.returnURL, 
                    {useajax: "setorder", userid: userid, id: "none", type: "things", value: tilenums, hubid: hubid, roomid: roomid},
                    function (presult, pstatus) {
                        if (pstatus==="success" && typeof presult==="object" ) {
                            console.log("setorder POST returned: ", presult );
                            // reordered = true;
                        } else {
                            console.log( "pstatus: ", pstatus, " presult: ", presult);
                        }
                    }, "json"
                );
            }
        }
    });
}

function addSortNumber(thetile, num, div) {
   var sortdiv = "<div class=\"sortnum\">" + num + "</div>";
   $(thetile).append(sortdiv);
}

function updateSortNumber(thetile, num) {
   $(thetile).children(".sortnum").html(num);
}


function setupDraggable() {
    var startPos = {top: 0, left: 0, "z-index": 0, position: "relative", priorStart: "relative"};
    var hubpick = cm_Globals.hubId;
    var delx;
    var dely;

    xhrdone();

    function thingDraggable(thing, snap, catpanel) {
        var snapgrid = false;
    
        if ( snap ) {
            snapgrid = [10, 10];
        }
        var panel = catpanel;
        thing.draggable({
            revert: "invalid",
    
            start: function(evt, ui) {

                // get the panel name - if the target is in catalog we have to do more work
                if ( catpanel ) {
                    panel = catpanel;
                } else if ( $(evt.target).attr("panel") ) {
                    panel = $(evt.target).attr("panel");
                } else {
                    var deftabid = getCookie("defaultTab");
                    panel = $("#"+deftabid).text();
                }
                startPos["z-index"] = parseInt($(evt.target).css("z-index"));
                
                // while dragging make sure we are on top
                // unless dragging won't be productive due to open dialog
                if (  modalStatus===0 ) {
                    $(evt.target).css("z-index", 999);
                }
    
                // set relative for new things and absolute for moving existing things
                if ( $(evt.target).hasClass("catalog-thing") ) {
                    startPos.left = 0;
                    startPos.top = 0;
                    delx = 0;
                    dely = 0;
                    startPos.position = "relative";
                    startPos.priorStart = "relative";
                } else {
                    startPos.left = parseInt($(evt.target).position().left);
                    startPos.top  = parseInt($(evt.target).position().top);
                    delx = evt.pageX - startPos.left;
                    dely = evt.pageY - startPos.top;
                    // $(evt.target).css({"position":startPos.position, "left": startPos.left, "top": startPos.top} );
                    startPos.priorStart = $(evt.target).css("position");
                    startPos.position = "absolute";
                }
    
                // console.log("start... left: " + startPos.left + " top: "+ startPos.top, " panel: ", panel, delx, dely);
            },
            stop: function(evt, ui) {
                // var thing = ui.draggable;
                // console.log("Stopped dragging: ", $(evt.target).attr("type") );
            },
            grid: snapgrid
        });
    }
    
    // get the catalog content and insert after main tabs content
    // var userid = cm_Globals.options.userid;
    // $.post(cm_Globals.returnURL, 
    //     {useajax: "getcatalog", userid: userid, id: 0, type: "catalog", value: "none", attr: hubpick},
    //     function (presult, pstatus) {
    //         console.log("catalog return: ", pstatus);
    //         if (pstatus==="success") {
    //             console.log("edit result: ", presult);
    //             $("#tabs").after(presult);
    //         } else {
    //             console.log("error - ", pstatus);
    //         }
    //     }
    // );
    
    // var xhr = function dum() {
    // }

    // if we failed clean up
    // xhr.fail( cancelDraggable );
    
    // enable filters and other stuff if successful
    function xhrdone() {
        
        // $("#catalog").draggable();
        
        setupFilters();

        // show the catalog
        $("#catalog").show();

        // the active things on a panel
        var snap = $("#mode_Snap").prop("checked");
        thingDraggable( $("div.panel div.thing"), snap, null );
    
        // enable dropping things from the catalog into panel
        // and movement of existing things around on the panel itself
        // use this instead of stop method to deal with cancelling drops
        $("div.panel").droppable({
            accept: function(thing) {
                var accepting = false;
                if ( thing.hasClass("thing") && modalStatus===0 ) {
                    accepting = true;
                }
                return accepting;
            },
            tolerance: "intersect",
            drop: function(evt, ui) {
                var thing = ui.draggable;
                var bid = $(thing).attr("bid");
                var thingtype = $(thing).attr("type");
                var thingname = $(thing).find(".thingname").text();
                var hubid = $(thing).attr("hubid");
                var hubindex = $(thing).attr("hubindex");
                var userid = cm_Globals.options.userid;
                var panelid = $("input[name='panelid']").val();
                startPos.left = 0;
                startPos.top  = 0;
                startPos["z-index"] = 1;
                startPos.position = "relative";

                // handle new tile creation
                if ( thing.hasClass("catalog-thing") ) {
                    // get panel of active page - have to do this the hard way
                    // because the thing in the catalog doesn't have a panel attr
                    $("li.ui-tabs-tab").each(function() {
                        if ( $(this).hasClass("ui-tabs-active") ) {
                            var clickid = $(this).attr("aria-labelledby");
                            var panel = $("#"+clickid).text();
                            var lastthing = $("div.panel-"+panel+" div.thing").last();
                            var roomid = $("#panel-"+panel).attr("roomid");
                            // alert("room = " + panel + " roomid = " + roomid + " hubindex = " + hubindex);
                            pos = {position: "absolute", top: evt.pageY, left: evt.pageX, width: 300, height: "auto"};
                            var zmax = getMaxZindex(panel);
                            startPos["z-index"] = zmax;
                            createModal("modaladd","Add: "+ thingname + " of Type: "+thingtype+" to Room: "+panel+"?<br /><br />Are you sure?", "body", true, pos, function(ui, content) {
                                var clk = $(ui).attr("name");
                                if ( clk==="okay" ) {
                                    // add it to the system
                                    // the ajax call must return a valid "div" block for the dragged new thing
                                    $.post(cm_Globals.returnURL, 
                                        {useajax: "addthing", userid: userid, id: bid, type: thingtype, value: panel, panelid: panelid, attr: startPos, hubid: hubid, hubindex: hubindex, roomid: roomid},
                                        function (presult, pstatus) {
                                            if (pstatus==="success" && !presult.startsWith("error") ) {
                                                console.log( "Added " + thingname + " of type " + thingtype + " and bid= " + bid + " to room " + panel, " pos: ", startPos);
                                                lastthing.after(presult);
                                                var newthing = lastthing.next();
                                                $(newthing).css( startPos );
                                                var snap = $("#mode_Snap").prop("checked");
                                                thingDraggable( newthing, snap, panel );
                                                setupPage();
                                                setupSliders();
                                                setupColors();
                                                addEditLink();
                                            } else {
                                                console.log("pstatus: ", pstatus, " presult: ", presult);
                                            }
                                        } 
                                    );
                                }
                            });
                        } 
                    });
                // otherwise this is an existing thing we are moving
                } else {

                    // var lastthing = $("div.panel-"+panel+" div.thing").last();
                    // startPos.left = $(evt.target).css("left");
                    // startPos.top = $(evt.target).css("top");
                    startPos.left = evt.pageX - delx;   // parseInt($(evt.target).offset().left);
                    startPos.top  = evt.pageY - dely;   // parseInt($(evt.target).offset().top);
                    var panel = $(thing).attr("panel");
                    var tile = $(thing).attr("tile");
                    var roomid = $("#panel-"+panel).attr("roomid");
                    var thingid = $(thing).attr("thingid");
                    $(thing).css("z-index", startPos["z-index"] );

                    // revert back to relative if we dragged outside panel to left or top
                    if ( startPos.left < 0 || startPos.top < 0 ) {
                        startPos.left = 0;
                        startPos.top = 0;
                        startPos.position = "relative";
                    } else {
                        var zmax = getMaxZindex(panel);
                        var thisz = startPos["z-index"];
                        if ( zmax > thisz ) {
                            zmax++;
                        }
                        startPos["z-index"] = zmax;
                        startPos.position = "absolute";
                    }

                    $(thing).css(startPos);
                    
                    // now post back to housepanel to save the position
                    // also send the dragthing object to get panel name and tile pid index
                    if ( ! $("#catalog").hasClass("ui-droppable-hover") ) {
                        console.log( "Moving tile #" + tile + " thingid= ", thingid, " to position: ", startPos);
                        $.post(cm_Globals.returnURL, 
                               {useajax: "setposition", userid: cm_Globals.options.userid, id: bid, type: thingtype, value: panel, attr: startPos, tile: tile, hubid: hubid, thingid: thingid, roomid: roomid},
                               function (presult, pstatus) {
                                // check for an object returned which should be a promise object
                                if (pstatus==="success" && ( typeof presult==="object" || (typeof presult === "string" && !presult.startsWith("error"))) ) {
                                    console.log("setposition presult: ", presult );
                                } else {
                                    console.log("pstatus: ", pstatus, " presult: ", presult);
                                }
                            }
                        );
                    }

                }
            }
        });

        // enable dragging things from catalog
        $("#catalog div.thing").draggable({
            revert: false,
            // containment: "#dragregion",
            helper: "clone"
        });

        // enable dragging catalog
        $("#catalog").draggable({
            revert: false
        });

        // enable dropping things from panel into catalog to remove
        $("#catalog").droppable({
            // accept: "div.panel div.thing",
            accept: function(thing) {
                var accepting = false;
                if ( thing.hasClass("thing") && thing.attr("panel")!=="catalog" && modalStatus===0 ) {
                    accepting = true;
                }
                return accepting;
            },
            tolerance: "fit",
            drop: function(evt, ui) {
                var thing = ui.draggable;
                var bid = $(thing).attr("bid");
                var thingtype = $(thing).attr("type");
                var panel = $(thing).attr("panel");
                // var id = $(thing).attr("id");
                // we now use the new thingid to pinpoint the exact thing which is unique on the page
                // we could use tile and page name but that would require a database search for pageid
                // and tile numbers are not unique on each page since any tile can show up multiple times
                var roomid = $("#panel-"+panel).attr("roomid");
                var thingid = $(thing).attr("thingid");
                var hubid = $(thing).attr("hub");
                var tile = $(thing).attr("tile");
                var tilename = $(thing).find(".thingname").text();
                var pos = {top: 100, left: 10};

                createModal("modaladd","Remove: "+ tilename + " (thing # " + thingid + ") of type: "+thingtype+" from room "+panel+"? Are you sure?", "body" , true, pos, function(ui, content) {
                    var clk = $(ui).attr("name");
                    if ( clk==="okay" ) {
                        $.post(cm_Globals.returnURL, 
                            {useajax: "delthing", userid: cm_Globals.options.userid, id: bid, type: thingtype, value: panel, attr: "", hubid: hubid, tile: tile, thingid: thingid, roomid: roomid},
                            function (presult, pstatus) {
                                // check for an object returned which should be a promise object
                                if (pstatus==="success" && ( typeof presult==="object" || (typeof presult === "string" && !presult.startsWith("error"))) ) {
                                    console.log( "delthing presult: ", presult );
                                    console.log( "Removed tile #" + tile + " thingid: ", thingid, " name: ", tilename, " from page: ", panel);
                                    $(thing).remove();
                                } else {
                                    console.log("pstatus: ", pstatus, " presult: ", presult);
                                }
                            }
                        );

                    // this isn't a clone so we have to revert to original place
                    } else {
                        startPos.position = startPos.priorStart;
                        relocateTile(thing, startPos);
                        // $("#"+id).data('draggable').options.revert();
                        // try {
                        //     $(thing).css("position", startPos.priorStart);
                        //     if ( startPos.priorStart === "relative" ) {
                        //         startPos.left = 0;
                        //         startPos.top = 0;
                        //     }
                        //     $(thing).css("left", startPos.left). css("top",startPos.top).css("z-index", startPos["z-index"] );
                        // } catch(e) { 
                        //     console.log("Drag/drop error. Please share this with @kewashi on the ST or HE Community Forum: ", e); 
                        // }
                    }
                });
            }
        });
    
    }
}

function relocateTile(thing, tileloc) {

    // force positions of relative tiles back to zero
    if ( tileloc.position && tileloc.position==="relative") {
        tileloc.left = 0;
        tileloc.top = 0;
        tileloc["z-index"] = 1;
    }

    try {
        if ( tileloc.position ) {
            $(thing).css("position", tileloc.position);
        }
        if ( tileloc.left ) {
            $(thing).css("left", tileloc.left);
        }
        if ( tileloc.top ) {
            $(thing).css("top",tileloc.top);
        }
        if ( tileloc["z-index"] ) {
            $(thing).css("z-index", tileloc["z-index"]);
        }
    } catch(e) { 
        console.log("Tile reposition error.", e); 
    }

}

// make the post call back to main server
function dynoPost(ajaxcall, body, callback) {
    var isreload = false;
    var delay = false;

    // if body is not given or is not an object then use all other values
    // to set the object to pass to post call with last one being a reload flag
    if ( typeof body === "object" ) { 
        body["api"] = ajaxcall;
        if ( body.reload ) {
            isreload = true;
            var d = parseInt(body.reload);
            if ( !isNaN(d) ) {
                delay = d;
            }
        }
    } else {
        body = {api: ajaxcall, id: "none", type: "none"};
    }

    if ( callback && typeof callback==="function" ) {
        $.post(cm_Globals.returnURL, body, callback);

    } else {
        $.post(cm_Globals.returnURL, body,
            function (presult, pstatus) {
                if ( isreload ) {
                    if ( delay ) {
                        setTimeout( function() {
                            window.location.href = cm_Globals.returnURL;
                        }, delay);
                    } else {
                        window.location.href = cm_Globals.returnURL;
                    }
                }

                // clear blinking interval if requested
                else if ( typeof presult === "object" && presult.blink ) {
                    clearInterval(presult.blink);
                }
            }
        );
    }
}

function execButton(buttonid) {

    if ( buttonid==="optSave") {
        // first save our filters
        if ( !checkInputs() ) { return; }

        var fobj = formToObject("filteroptions");
        var uobj = formToObject("userpw");
        var oobj = formToObject("optionspage");

        try {
            dynoPost("filteroptions", fobj, function(presult, pstatus) {
                if ( typeof presult==="object" ) {
                    // console.log("processed filteroptions page.", presult);
                    dynoPost("saveuserpw", uobj, function(presult, pstatus) {
                        if ( typeof presult==="object" ) {
                            // console.log("processed saveuserpw page.", presult);
                            dynoPost("saveoptions", oobj, function(presult, pstatus) {
                                if ( presult==="success" ) {
                                    window.location.href = cm_Globals.returnURL;
                                } else {
                                    throw "Problem with saving room and thing options";
                                }
                            });
                        } else {
                            throw "Problem with saving username or password";
                        }
                    });
                } else {
                    throw "Problem with saving filters";
                }
            });
        } catch (e) {
            console.log("Failed to properly save Options page. ", e);
        }

    } else if ( buttonid==="optCancel" ) {
        // do nothing but reload the main page
        window.location.href = cm_Globals.returnURL;

    } else if ( buttonid==="optReset" ) {
        // reset the forms on the options page to their starting values
        $("#optionspage")[0].reset();
        $("#filteroptions")[0].reset();

    } else if ( buttonid==="dologin") {

        if ( !checkLogin() ) { return; }

        var genobj = formToObject("loginform");
        dynoPost("dologin", genobj, function(presult, pstatus) {
            if ( pstatus === "success" && presult && typeof presult === "object" ) {
                console.log("login successful for user: ",  presult["users_email"], " and panel: ", presult["panels_pname"]);
                var pstyle = "position: absolute; border: 6px black solid; background-color: blue; color: white; font-weight: bold; font-size: 24px; left: 500px; top: 200px; width: 600px; height: 180px; padding-top: 20px;";
                var pos = {style: pstyle};
                createModal("loginfo","User: " + presult["users_email"] + "<br>Logged into panel: " + presult["panels_pname"] + "<br>With skin: " + presult["panels_skin"] + "<br><br>Proceed? ", 
                    "body", true, pos, function(ui) {
                        var clk = $(ui).attr("name");
                        if ( clk==="okay" ) {
                            window.location.href = cm_Globals.returnURL;
                        }
                    });
                // window.location.href = cm_Globals.returnURL;
            } else {
                var pstyle = "position: absolute; border: 6px black solid; background-color: red; color: white; font-weight: bold; font-size: 24px; left: 500px; top: 200px; width: 600px; height: 180px; padding-top: 50px;";
                var pos = {style: pstyle};
                createModal("loginfo","Either the User and Password pair are invalid, or the requested Panel and Password pair are invalid. <br><br>Please try again.", "body", false, pos);
                setTimeout(function() {
                    closeModal("loginfo");
                },2000);
                // window.location.href = cm_Globals.returnURL;
            }
        });

    } else if ( buttonid === "blackout") {
        // blank out screen with a black box size of the window and pause timers
        var w = window.innerWidth;
        var h = window.innerHeight;
        // var dophotos = true;
        var photohandle;

        try {
            var phototimer = cm_Globals.options.config["phototimer"];
            phototimer = parseInt(phototimer) * 1000;
        } catch(e) {
            phototimer = 0;
        }
        priorOpmode = "Sleep";
        $("div.maintable").after("<div id=\"blankme\"></div>");
        var photos;

        // if timer is zero or less than 1 second just do a black screen
        if ( phototimer < 1000 ) {
            $("#blankme").css( {"height":h+"px", "width":w+"px", 
            "position":"absolute", "background-color":"black",
            "left":"0px", "top":"0px", "z-index":"9999" } );
        
        // if timer provided make call to get list of photos to cycle through
        // and if this fails fall back to the same simple black screen
        } else {
            $.post(cm_Globals.returnURL, 
                {useajax: "getphotos", userid: cm_Globals.options.userid, id: 0, type: "none"}, 
                function(presult, pstatus) {
                    if ( presult && typeof presult == "object" ) {
                        // console.log("photos from getPhotos: ", presult);
                        photos = presult;
                        var pnum = 0;
                        $("#blankme").css( {"height":h+"px", "width":w+"px", 
                        "position":"absolute", "background-color":"black", "background-size":"contain",
                        "background-image": "url('photos/" + photos[pnum] + "')",
                        "left":"0px", "top":"0px", "z-index":"9999" } );
                        photohandle = setInterval(function() {
                            pnum++;
                            if ( typeof photos[pnum] === "undefined" ) {
                                pnum = 0;
                            }
                            $("#blankme").css( {"height":h+"px", "width":w+"px", 
                            "position":"absolute", "background-color":"black", "background-size":"contain",
                            "background-image": "url('photos/" + photos[pnum] + "')",
                            "left":"0px", "top":"0px", "z-index":"9999" } );
                        }, phototimer);
                    
                    } else {
                        $("#blankme").css( {"height":h+"px", "width":w+"px", 
                        "position":"absolute", "background-color":"black",
                        "left":"0px", "top":"0px", "z-index":"9999" } );
                    }
                }
            );
        }
            // photos = {0: "Nascar Race-18.JPG", 1: "Nascar Race-49.JPG", 2: "ford2020mustang.png", 3: "Techonomy 2015-2.JPG"};

        // clicking anywhere will restore the window to normal
        $("#blankme").off("click");
        $("#blankme").on("click", function(evt) {
            if ( photohandle ) {
                clearInterval(photohandle);
            }
            $("#blankme").remove(); 
            priorOpmode = "Operate";
            evt.stopPropagation();
        });
    } else if ( buttonid === "toggletabs") {
        toggleTabs();
    } else if ( buttonid === "reorder" ) {
        if ( priorOpmode === "DragDrop" ) {
            updateFilters();
            cancelDraggable();
            delEditLink();
        }
        setupSortable();
        setupPagemove();
        $("#mode_Reorder").prop("checked",true);
        priorOpmode = "Reorder";
    } else if ( buttonid === "edit" ) {
        if ( priorOpmode === "Reorder" ) {
            cancelSortable();
            cancelPagemove();
        }
        setupDraggable();
        addEditLink();
        $("#mode_Edit").prop("checked",true);
        priorOpmode = "DragDrop";
    } else if ( buttonid==="showdoc" ) {
        window.open("http://www.housepanel.net",'_blank');
        return;
    // } else if ( buttonid==="name" ) {
    //     return;
    } else if ( buttonid==="operate" ) {
        if ( priorOpmode === "Reorder" ) {
            cancelSortable();
            cancelPagemove();
            if ( reordered ) {
                window.location.href = cm_Globals.returnURL;
            }
        } else if ( priorOpmode === "DragDrop" ) {
            updateFilters();
            cancelDraggable();
            delEditLink();
        }
        $("#mode_Operate").prop("checked",true);
        priorOpmode = "Operate";
    } else if ( buttonid==="snap" ) {
        var snap = $("#mode_Snap").prop("checked");
        console.log("Tile movement snap mode: ",snap);

    } else if ( buttonid==="refreshpage" ) {
        var pstyle = "position: absolute; background-color: blue; color: white; font-weight: bold; font-size: 32px; left: 300px; top: 300px; width: 600px; height: 100px; margin-top: 50px;";
        createModal("info", "Screen may reload multiple times...","body", false, {style: pstyle});
        dynoPost(buttonid);

    } else if ( buttonid==="refactor" ) {
        alert("This feature is not yet available.");

    // default is to call main node app with the id as a path
    } else {
        window.location.href = cm_Globals.returnURL + "/" + buttonid;
    }
}

function updateFilters() {
    var fobj = formToObject("filteroptions");
    if ( fobj ) {
        dynoPost("filteroptions", fobj);
    }
}

function checkInpval(field, val, regexp) {
    var errs = "";
    if ( !regexp.test(val) ) {
        errs = "field: " + field + "= " + val + " is not a valid entry";
    }
    return errs;
}

function checkInputs() {

    var port = $("input[name='port']").val().trim();
    var webSocketServerPort = $("input[name='webSocketServerPort']").val().trim();
    var fast_timer = $("input[name='fast_timer']").val();
    var slow_timer = $("input[name='slow_timer']").val().trim();
    var uname = $("input[name='uname']").val().trim();
    var pword = $("input[name='pword']").val().trim();

    var errs = {};
    var isgood = true;
    var intre = /^\d{1,6}$/;         // only up to 6 digits allowed
    var unamere = /^\D\S{3,}$/;      // start with a letter and be four long at least
    var pwordre = /^\S{6,}$/;        // start with anything but no white space and at least 6 digits 

    errs.webSocketServerPort = checkInpval("webSocketServerPort", webSocketServerPort, intre);
    errs.port = checkInpval("port", port, intre);
    errs.fast_timer = checkInpval("fast_timer", fast_timer, intre);
    errs.slow_timer = checkInpval("slow_timer", slow_timer, intre);
    errs.uname = checkInpval("username", uname, unamere);
    errs.pword = pword==="" ? "" : checkInpval("password", pword, pwordre);

    // show all errors
    var str = "";
    $.each(errs, function(key, val) {
        if ( val ) {
            str = str + "Invalid " + key + val + "\n"; 
        }
    });

    if ( str ) {
        alert(str);
        isgood = false;
    }

    return isgood;
}

function setupButtons() {

    if ( $("div.formbutton") ) {
        $("div.formbutton").on('click', function(evt) {
            var buttonid = $(this).attr("id");
            var textname = $(this).text();

            // do nothing for name field
            if ( textname === "name" ) {
                return;
            }

            if ( $(this).hasClass("confirm") ) {
                var pos = {top: 100, left: 100};
                createModal("modalexec","Perform " + textname + " operation... Are you sure?", "body", true, pos, function(ui, content) {
                    var clk = $(ui).attr("name");
                    if ( clk==="okay" ) {
                        execButton(buttonid);
                        evt.stopPropagation();
                    }
                });
            } else {
                execButton(buttonid);
                evt.stopPropagation();
            }
        });
    }

    // disable cancel auth button when page first loads
    // and turn it on after a seconds which gives time for hubs to load
    if ( $("button.infobutton") ) {
        $("button.infobutton").addClass("disabled").prop("disabled", true);
        setTimeout(function() {
            $("button.infobutton").removeClass("disabled").prop("disabled", false);
        }, 200);
            
        $("button.infobutton").on('click', function() {
            // location.reload(true);
            // $.post(cm_Globals.returnURL, 
            //     {useajax: "reload", id: 0, type: "none"} );
            window.location.href = cm_Globals.returnURL;
        });
    }

    if ( pagename==="main" && !cm_Globals.disablepub ) {

        // prevent mode from changing when editing a tile
        $("div.modeoptions").on("click","input.radioopts",function(evt){
            if ( modalStatus === 0  ) {
                var opmode = $(this).attr("value");
                execButton(opmode);
            } else {
                console.log("warning: attempted to change operating mode while a dialog box is open.");
            }
            evt.stopPropagation();
        });
        
        $("#infoname").on("click", function(e) {
            var username = $(this).html();
            var pos = {top: 40, left: 820};
            createModal("modalexec","Log out user "+ username + " <br/>Are you sure?", "body" , true, pos, function(ui, content) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    window.location.href = cm_Globals.returnURL + "/logout";
                } else {
                    closeModal("modalexec");
                }
            });
        });

    } else if ( pagename==="info" ) {
        
        $("#listhistory").on('click', function() {
            if ( $("#showhistory").hasClass("hidden") ) {
                $("#showhistory").removeClass("hidden");
                $(this).html("Dev History");
            } else {
                $("#showhistory").addClass("hidden");
                $(this).html("Show Dev History");
            }
        });

        $("#listthing").on('click', function() {
            if ( $("#showthing").hasClass("hidden") ) {
                $("#showthing").removeClass("hidden");
                $(this).html("Authorized Things");
            } else {
                $("#showthing").addClass("hidden");
                $(this).html("Show Authorized Things");
            }
        });

        $("#listcustom").on('click', function() {
            if ( $("#showcustom").hasClass("hidden") ) {
                $("#showcustom").removeClass("hidden");
                $(this).html("Customizations");
            } else {
                $("#showcustom").addClass("hidden");
                $(this).html("Show Customizations");
            }
        });

    } else if ( pagename==="auth" ) {

        // now we use the DB index of the hub to ensure it is unique
        $("#pickhub").on('change',function(evt) {
            var hubindex = $(this).val();
            var target = "#authhub_" + hubindex;

            // this is only the starting type and all we care about is New
            // if we needed the actual type we would have used commented code
            var hubType = $(target).attr("hubtype");
            var hubId = $(target).attr("hubid");
            // alert("hubType = " + hubType);
            // var realhubType = $("#hubdiv_" + hubId).children("select").val();
            // alert("realhubType= " + realhubType);
            if ( hubId==="new" ) {
                $("input.hubauth").removeClass("hidden");
                $("input.hubdel").addClass("hidden");
                $("#newthingcount").html("Fill out the fields below to add a New hub");
            } else if ( hubId==="-1" ) {
                $("#newthingcount").html("The \"null\" hub for things not associated with a hub. It cannot be altered or authorized.");
                $("input.hubdel").addClass("hidden");
                $("input.hubauth").addClass("hidden");
                $("#hubdiv_new > select[name='hubType']").addClass("hidden");
            } else {
                $("input.hubauth").removeClass("hidden");
                $("input.hubdel").removeClass("hidden");
                $("#newthingcount").html("");
            }
            $("div.authhub").each(function() {
                if ( !$(this).hasClass("hidden") ) {
                    $(this).addClass("hidden");
                }
            });
            $(target).removeClass("hidden");

            // populate the clientSecret field that could have funky characters
            if ( hubType!=="New" && hubindex ) {
                var funkysecret = $("#csecret_"+hubindex).val();
                $(target + " div.fixClientSecret >input").val(funkysecret);
            }

            evt.stopPropagation(); 
        });

        $("#hubdiv_new > select[name='hubType']").on('change', function(evt) {
            var hubType = $(this).val();
            var hubTarget = $("#hubform_new").find("input[name='hubHost']");
            if ( hubType=== "SmartThings" ) {
                hubTarget.val("https://graph.api.smartthings.com");
            } else if ( hubType=== "NewSmartThings" ) {
                hubTarget.val("https://api.smartthings.com");
            } else if ( hubType==="Hubitat" ) {
                hubTarget.val("https://oauth.cloud.hubitat.com");
            } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
                hubTarget.val("https://fordconnect.cv.ford.com");
            } else if ( hubType==="ISY" ) {
                hubTarget.val("http://192.168.11.31");
            } else {
                hubTarget.val("");
            }
        });
        
        // this clears out the message window
        $("#newthingcount").on('click',function(evt) {
            $("#newthingcount").html("");
        });
        
        // handle auth submissions
        // add on one time info from user
        $("input.hubauth").click(function(evt) {
            try {
                // var hubId = $(this).attr("hubid");
                var hubindex = $(this).attr("hubindex");
                var formData = formToObject("hubform_"+hubindex);
                // console.log(formData);
            } catch(err) {
                evt.stopPropagation(); 
                alert("Something went wrong when trying to authenticate your hub...\n" + err.message);
                console.log("Error: ", err);
                return;
            }
            
            // make an api call and process results
            // some hubs return devices on server and pushes results later
            // others return a request to start an OATH redirection flow
            formData["api"] = "hubauth";
            $.post(cm_Globals.returnURL, formData,  function(presult, pstatus) {
                // console.log("hubauth: ", presult);

                if ( pstatus==="success" && typeof presult==="object") {
                    var obj = presult;

                    // for hubs that have auth info in the config file we do nothing but notify user of retrieval
                    if ( obj.action === "things" ) {
                        // tell user we are authorizing hub...
                        $("#newthingcount").html("Authorizing " + obj.hubType + " hub: " + obj.hubName).fadeTo(400, 0.1 ).fadeTo(400, 1.0);
                        setInterval(function() {
                            $("#newthingcount").fadeTo(400, 0.1 ).fadeTo(400, 1);
                        }, 1000);

                        // reload the page after 15 seconds of trying to get the devices in the background
                        // while we are waiting the server is reading the devices from the hub asyncronously
                        // if this reload happens that means the device read likely failed
                        setTimeout(function() {
                            var location = cm_Globals.returnURL + "/reauth";
                            window.location.href = location;
                        }, 15000);

                    }

                    // navigate to the location to authorize Ford Pass - see the following postman schema for background info
                    // "_postman_id": "a4dffc56-609b-4b97-9880-15e5b249b9ea",
                    // "name": "CA Ford-Connect Production",
                    // "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
                    else if ( obj.action === "fordoauth" ) {
                        var nvpreq= "make=" + obj.model + "&application_id=" + obj.hubId + 
                                    "&response_type=code&state=123&client_id=" + obj.clientId + 
                                    "&scope=access&redirect_uri=" + encodeURI(obj.url);
                        var location = obj.host + "/common/login/?" + nvpreq;
                        
                        alert("Ready to redirect to location: " + location);
                        window.location.href = location;

                    }

                    // if oauth flow then start the process with a redirection to site
                    // was updated to handle specific client_type values for user level auth and user scope values
                    else if ( obj.action === "oauth" ) {
                        // $("#newthingcount").html("Redirecting to OAUTH page");
                        var nvpreq = "response_type=code";
                        if ( obj.client_type ) {
                            nvpreq = nvpreq + "&client_type=" + obj.client_type;
                        }
                        if ( obj.scope ) {
                            nvpreq = nvpreq + "&scope=" + encodeURI(obj.scope);
                        } else {
                            nvpreq = nvpreq + "&scope=app";
                        }
                        nvpreq= nvpreq + "&client_id=" + encodeURI(obj.clientId) + "&redirect_uri=" + encodeURI(obj.url);

                        // navigate over to the server to authorize
                        var location = obj.host + "/oauth/authorize?" + nvpreq;
                        
                        // alert("Ready to redirect to location: " + location);
                        window.location.href = location;
                    }
                } else {
                    if (typeof presult==="string" ) {
                        $("#newthingcount").html(presult);
                    }
                }
            });
            evt.stopPropagation();
        });
        
        // TODO - test and activate this feature
        $("input.hubdel").click(function(evt) {
            var hubnum = $(this).attr("hubnum");
            var hubId = $(this).attr("hubid");
            var hubindex = $(this).attr("hubindex");
            var bodytag = "body";
            var pos = {position: "absolute", top: 100, left: 100, 
                       width: 600, height: 120, border: "4px solid"};
            // alert("Remove request for hub: " + hubnum + " hubID: " + hubId );

            createModal("modalhub","Remove Hub #" + hubnum + " hubID: " + hubId + "? <br>Are you sure?", bodytag , true, pos, function(ui, content) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    // remove it from the system
                    $.post(cm_Globals.returnURL, 
                        {useajax: "hubdelete", userid: cm_Globals.options.userid, hubid: hubId, id: hubindex},
                        function (presult, pstatus) {
                            if (pstatus==="success" && !presult.startsWith("error")) {
                                $("#newthingcount").html(presult);

                                // var location = cm_Globals.returnURL + "/reauth";
                                // window.location.href = location;

                                // $("#authhub_"+hubindex).remove();
                                // $("#hubopt_"+hubindex).remove();
                                // $("#newthingcount").html(presult);
                            } else {
                                $("#newthingcount").html("error - could not remove hub #" + hubnum + " hub ID: " + hubId);
                                console.log(presult);
                            }
                        }
                    );
                }
            });
            
            evt.stopPropagation(); 
        });
    
    }

}

function addEditLink() {
    
    // add links to edit and delete this tile
    $("div.panel > div.thing").each(function() {
        var editdiv = "<div class=\"editlink\" aid=" + $(this).attr("id") + "> </div>";
        var cmzdiv = "<div class=\"cmzlink\" aid=" + $(this).attr("id") + ">" + $(this).attr("tile")  + "</div>";
        var deldiv = "<div class=\"dellink\" aid=" + $(this).attr("id") + "> </div>";
        // var numdiv = "<div class=\"tilenum\" aid=" + $(this).attr("id") + ">" + $(this).attr("tile")  + "</div>";
        $(this).append(cmzdiv).append(editdiv).append(deldiv);
    });
    
    // add links to edit page tabs
    $("#roomtabs li.ui-tab").each(function() {
        var roomname = $(this).children("a").text();
        var editdiv = "<div class=\"editpage\" roomnum=" + $(this).attr("roomnum") + " roomname=\""+roomname+"\"> </div>";
        var deldiv = "<div class=\"delpage\" roomnum=" + $(this).attr("roomnum") + " roomname=\""+roomname+"\"> </div>";
        $(this).append(editdiv).append(deldiv);
    })
    
    // add link to add a new page
    var editdiv = "<div id=\"addpage\" class=\"addpage\" roomnum=\"new\">Add New Page</div>";
    $("#roomtabs").append(editdiv);
    
    $("div.editlink").on("click",function(evt) {
        var taid = $(evt.target).attr("aid");
        var thing = "#" + taid;
        var aid = taid.substr(2);
        var str_type = $(thing).attr("type");
        var tile = $(thing).attr("tile");
        var strhtml = $(thing).html();
        var thingclass = $(thing).attr("class");
        var pagename = $(thing).attr("panel")
        var bid = $(thing).attr("bid");
        var hubid = $(thing).attr("hub");
        var hubType = $(thing).attr("hubtype");
        var thingid = $(thing).attr("thingid");
        var userid = cm_Globals.options.userid;
        try {
            var customname = $("#a-"+aid+"-name").html();
        } catch(e) {
            customname = $("#s-"+aid).html();
        }

        // replace all the id tags to avoid dynamic updates
        strhtml = strhtml.replace(/ id="/g, " id=\"x_");
        console.log("editing tile: ", thingid, customname, pagename);
        editTile(userid, thingid, pagename, str_type, tile, aid, bid, thingclass, hubid, hubType, customname, strhtml);
    });
    
    $("div.cmzlink").on("click",function(evt) {
        var aid = $(evt.target).attr("aid");
        var thing = "#" + aid;
        var thingname = $(thing).attr("name");
        var pwsib = $(evt.target).siblings("div.overlay.password");
        var userid = cm_Globals.options.userid;
        if ( pwsib && pwsib.length > 0 ) {
            pw = pwsib.children("div.password").html();
            checkPassword(thing, "Tile editing", pw, runCustom);
        } else {
            runCustom(thing," ");
        }
        function runCustom(thing, name) {
            var str_type = $(thing).attr("type");
            var tile = $(thing).attr("tile");
            var bid = $(thing).attr("bid");
            var hubid = $(thing).attr("hub");
            // var thingid = $(thing).attr("thingid");
            customizeTile(userid, tile, aid, bid, str_type, hubid);
        }
        // customizeTile(tile, aid, bid, str_type, hubid);
    });
    
    $("div.dellink").on("click",function(evt) {
        var thing = "#" + $(evt.target).attr("aid");
        var thingtype = $(thing).attr("type");
        var tile = $(thing).attr("tile");
        var bid = $(thing).attr("bid");
        var panel = $(thing).attr("panel");
        var tilename = $(thing).find(".thingname").text();
        var offset = $(thing).offset();
        var thigh = $(thing).height();
        var twide = $(thing).width();
        var tleft = offset.left - 600 + twide;
        if ( tleft < 10 ) { tleft = 10; }
        var pos = {top: offset.top + thigh, left: tleft, width: 600, height: 80};
        var roomid = $("#panel-"+panel).attr("roomid");
        var thingid = $(thing).attr("thingid");
        var hubid = $(thing).attr("hub");
        var userid = cm_Globals.options.userid;

        createModal("modaladd","Remove: "+ tilename + " of type: "+thingtype+" from hub Id: " + hubid + " & room "+panel+"?<br>Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "delthing", userid: userid, id: bid, type: thingtype, value: panel, attr: "", hubid: hubid, tile: tile, thingid: thingid, roomid: roomid},
                    function (presult, pstatus) {
                        // check for an object returned which should be a promise object
                        if (pstatus==="success" && ( typeof presult==="object" || (typeof presult === "string" && !presult.startsWith("error"))) ) {
                            console.log( "delthing presult: ", presult );
                            $(thing).remove();
                        } else {
                            console.log("pstatus: ", pstatus, " presult: ", presult);
                        }
                    }
                );
            }
        });
        
    });
    
    $("#roomtabs div.delpage").off("click");
    $("#roomtabs div.delpage").on("click",function(evt) {
        var roomnum = $(evt.target).attr("roomnum");
        var roomname = $(evt.target).attr("roomname");
        var roomid = $("#panel-"+roomname).attr("roomid");
        var clickid = $(evt.target).parent().attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        createModal("modaladd","Remove Room #" + roomnum + " with Name: " + roomname +" from HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                
                // fix default tab if it is on our deleted page
                var defaultTab = getCookie( 'defaultTab' );
                if ( defaultTab === clickid ) {
                    defaultTab = $("#roomtabs").children().first().attr("aria-labelledby");
                    setCookie('defaultTab', defaultTab);
                }

                // remove it from the system
                $.post(cm_Globals.returnURL, 
                    {useajax: "pagedelete", userid: cm_Globals.options.userid, id: roomnum, type: "none", value: roomname, roomid: roomid, attr: "none"},
                    function (presult, pstatus) {
                        if (pstatus==="success" && !presult.startsWith("error")) {
                            // remove it visually - although we do a refresh so not really needed
                            $("li[roomnum="+roomnum+"]").remove();
                            // getOptions();
                        }
                        console.log(presult);
                    }
                );
            }
        });
        
    });
    
    $("#roomtabs div.editpage").off("click");
    $("#roomtabs div.editpage").on("click",function(evt) {
        var roomnum = $(evt.target).attr("roomnum");
        var roomname = $(evt.target).attr("roomname");
        var roomid = $("#panel-"+roomname).attr("roomid");
        console.log("editing room: ", roomid, roomnum, roomname);
        editTile(cm_Globals.options.userid, roomid, roomname, "page", roomname, 0, 0, "", 0, "None", roomname);
    });
   
    $("#addpage").off("click");
    $("#addpage").on("click",function(evt) {
        // var clickid = $(evt.target).attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        var panelid = $("input[name='panelid']").val();
        createModal("modaladd","Add New Room to HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "pageadd", userid: cm_Globals.options.userid, id: "none", panelid: panelid},
                    function (presult, pstatus) {
                        if ( pstatus==="success" && !presult.startsWith("error") ) {
                            window.location.href = cm_Globals.returnURL;
                        } else {
                            console.log(presult);
                        }
                    }
                );
            }
        });
        
    });    

    $("#catalog").show();
    
}

function delEditLink() {
//    $("div.editlink").off("click");
    $("div.editlink").each(function() {
       $(this).remove();
    });
    $("div.cmzlink").each(function() {
       $(this).remove();
    });
    $("div.dellink").each(function() {
       $(this).remove();
    });
    // $("div.tilenum").each(function() {
    //     $(this).remove();
    //  });
    $("div.editpage").each(function() {
       $(this).remove();
    });
    $("div.delpage").each(function() {
       $(this).remove();
    });
    $("div.addpage").each(function() {
       $(this).remove();
    });
    
    // closeModal();
}

function showType(ischecked, theval, hubpick) {
    
    // var hubpick = cm_Globals.hubId;
    // var hubpick = "all";
        
    if ( pagename==="options" ) {
        $('table.roomoptions tr[type="'+theval+'"]').each(function() {
            var hubId = $(this).children("td.hubname").attr("hubid");
            if ( ischecked && (hubpick===hubId || hubpick==="all") ) {
                $(this).attr("class", "showrow");
            } else {
                $(this).attr("class", "hiderow");
           }
        });

        var rowcnt = 0;
        $('table.roomoptions tr').each(function() {
            var odd = "";
            var theclass = $(this).attr("class");
            if ( theclass !== "hiderow" ) {
                rowcnt++;
                rowcnt % 2 === 0 ? odd = " odd" : odd = "";
                $(this).attr("class", "showrow"+odd);
            }
        });
    }
    
    // handle main screen catalog
    if ( $("#catalog") ) {
        $("#catalog div.thing[type=\""+theval+"\"]").each(function(){
            // alert( $(this).attr("class"));
            var hubId = $(this).attr("hubid");
            if ( ischecked && (hubpick===hubId || hubpick==="all") && $(this).hasClass("hidden") ) {
                $(this).removeClass("hidden");
            } else if ( (!ischecked || (hubpick!==hubId && hubpick!=="all")) && ! $(this).hasClass("hidden") ) {
                $(this).addClass("hidden");
            }
        });
    }
}

function setupFilters() {
    
//    alert("Setting up filters");
   // set up option box clicks
   var pickedhub = cm_Globals.hubId;

    function updateClick() {
        var theval = $(this).val();
        var ischecked = $(this).prop("checked");
        showType(ischecked, theval, pickedhub);
    }

    // initial page load set up all rows
    $('input[name="useroptions[]"]').each(updateClick);
    
    // upon click update the right rows
    $('input[name="useroptions[]"]').click(updateClick);

    // hub specific filter
    $('input[name="huboptpick"]').click(function() {
        // get the id of the hub type we just picked
        pickedhub = $(this).val();
        cm_Globals.hubId = pickedhub;

        // reset all filters using hub setting
        $('input[name="useroptions[]"]').each(updateClick);
    });

    $("div#thingfilters").click(function() {
        var filter = $("#filterup");
        // console.log( "filter: ", filter.html() );
        if ( filter.hasClass("hidden") ) {
            $(filter).removeClass("hidden");
            $("#catalog div.scrollvtable").removeClass("ftall");
            $("#catalog div.scrollvtable").addClass("fshort");
        } else {
            $(filter).addClass("hidden");
            $("#catalog div.scrollvtable").removeClass("fshort");
            $("#catalog div.scrollvtable").addClass("ftall");
        }
    });
    
    $("#allid").click(function() {
        $('input[name="useroptions[]"]').each(function() {
            $(this).prop("checked",true);
            $(this).attr("checked",true);
        });
        
        // update the main table using standard logic
        $('input[name="useroptions[]"]').each(updateClick);
    });
    
    $("#noneid").click(function() {
        $('input[name="useroptions[]"]').each(function() {
            $(this).prop("checked",false);
            $(this).attr("checked",false);
        });
        
        // update the main table using standard logic
        $('input[name="useroptions[]"]').each(updateClick);
    });
}

function setupCustomCount() {

    // use clock to get hubstr and rooms arrays
    var hubstr = $("tr[type='clock']:first td:eq(1)").html();
    var tdrooms = $("tr[type='clock']:first input");
    
    // this creates a new row
    function createRow(tilenum, k, tiletype) {
        var row = '<tr type="' + tiletype + '" tile="' + tilenum + '" class="showrow">';
        // var kstr = (k < 10) ? k : k;
        row+= '<td class="thingname">' + tiletype + k + '<span class="typeopt"> (' + tiletype + ')</span></td>';
        row+= '<td>' + hubstr + '</td>';

        tdrooms.each( function() {
            var theroom = $(this).attr("name");
            row+= '<td>';
            row+= '<input type="checkbox" name="' + theroom + '" value="' + tilenum + '" >';
            row+= '</td>';
        });
        row+= '</tr>';
        return row;
    }
    
    $("div.filteroption input.specialtile").on("change", function() {
        var sid = $(this).attr("id");
        var stype = sid.substring(4);
        var customtag = $("table.roomoptions tr[type='" + stype + "']");
        var currentcnt = customtag.size();
        var newcnt = parseInt($(this).val());
        // console.log("Id= ", sid," Type= ", stype, " Current count= ", currentcnt, " New count= ", newcnt);
        
        var customs = [];
        $("table.roomoptions tr[type='" + stype +"']").each( function() {
            customs.push($(this));
        });
        
        // get biggest id number
        var maxid = 0;
        $("table.roomoptions tr").each( function() {
            var tileid = parseInt($(this).attr("tile"));
            maxid = ( tileid > maxid ) ? tileid : maxid;
        });
        maxid++;
        // console.log("Biggest id number= ", maxid);
        
        // turn on the custom check box
        var custombox = $("input[name='useroptions[]'][value='" + stype + "']");
        if ( custombox ) {
            custombox.prop("checked",true);
            custombox.attr("checked",true);
        };
        
        // show the items of this type
        showType(true, stype, cm_Globals.hubId);
        
        // remove excess if we are going down
        if ( newcnt>0 && newcnt < currentcnt ) {
            for ( var j= newcnt; j < currentcnt; j++ ) {
                // alert("j = "+j+" custom = " + customs[j].attr("type") );
                customs[j].detach();
            }
        }
        
        // add new rows
        if ( newcnt > currentcnt ) {
            var baseline = $("table.roomoptions tr[type='clock']").last();
            for ( var k= currentcnt; k < newcnt; k++ ) {
                var newrow = createRow(maxid, k+1, stype);
                customs[k] = $(newrow);
                if ( k > 0 ) {
                    baseline = customs[k-1];
                }
                baseline.after(customs[k]);
                if ( !baseline.hasClass("odd") ) {
                    customs[k].addClass("odd");
                }
                maxid++;
            }
        }
        
        // set current count
        currentcnt = newcnt;
    });
}

function toggleTabs() {
    var hidestatus = $("#toggletabs");
    if ( $("#roomtabs").hasClass("hidden") ) {
        $("#showversion").removeClass("hidden");
        $("#roomtabs").removeClass("hidden");
        if ( hidestatus ) hidestatus.html("Hide Tabs");
    } else {
        $("#showversion").addClass("hidden");
        $("#roomtabs").addClass("hidden");
        if ( hidestatus ) hidestatus.html("Show Tabs");
    }
}

function fixTrack(tval) {
    if ( !tval || tval.trim() === "" ) {
        tval = "None"; 
    } 
    else if ( tval.length > 124) { 
        tval = tval.substring(0,120) + " ..."; 
    }
    return tval;
}

// update all the subitems of any given specific tile
// note that some sub-items can update the values of other subitems
// this is exactly what happens in music tiles when you hit next and prev song
// third parameter will skip links - but this is not used for now
function updateTile(aid, presult, skiplink) {

    // do something for each tile item returned by ajax call
    var isclock = false;
    var nativeimg = false;
    
    // handle audio devices
    if ( presult["audioTrackData"] ) {
        var oldtrack = "";
        if ( $("#a-"+aid+"-trackDescription") ) {
            oldtrack = $("#a-"+aid+"-trackDescription").html();
        }
        var audiodata = JSON.parse(presult["audioTrackData"]);
        presult["trackDescription"] = audiodata["title"] || "None";
        presult["currentArtist"] = audiodata["artist"];
        presult["currentAlbum"] = audiodata["album"];
        presult["trackImage"] = audiodata["albumArtUrl"];
        presult["mediaSource"] = audiodata["mediaSource"];
        delete presult["audioTrackData"];
        // if ( oldtrack !== presult["trackDescription"] ) {
        //     console.log("audio track changed from: ["+oldtrack+"] to: ["+ presult["trackDescription"] +"]");
        // }
    }
    if ( presult["title"] && presult["trackDescription"] ) {
        presult["trackDescription"] = presult["title"];
        delete presult["title"];
    }
    if ( presult["artist"] && presult["currentArtist"] ) {
        presult["currentArtist"] = presult["artist"];
        delete presult["artist"];
    }
    if ( presult["album"] && presult["currentAlbum"] ) {
        presult["currentAlbum"] = presult["album"];
        delete presult["album"];
    }
    if ( presult["albumArtUrl"] && presult["trackImage"] ) {
        presult["trackImage"] = presult["albumArtUrl"];
        delete presult["albumArtUrl"];
    }
    
    // handle native track images - including audio devices above
    if ( presult["trackImage"] ) {
        var trackImage = presult["trackImage"].trim();
        if ( $("#a-"+aid+"-width") &&  $("#a-"+aid+"-width").html() && $("#a-"+aid+"-height") && $("#a-"+aid+"-height").html() ) {
            var wstr = " width='" + $("#a-"+aid+"-width").html() + "' height= '" + $("#a-"+aid+"-height").html() + "' ";
        } else {
            wstr = " class='trackImage'";
        }
        // alert("aid= " + aid + " image width info: " + wstr );
        if ( trackImage.startsWith("http") ) {
            presult["trackImage"] = "<img" + wstr + "src='" + trackImage + "'>";
            nativeimg = true;
        }
    }

    // var dupcheck = {};
    $.each( presult, function( key, value ) {

        var targetid = '#a-'+aid+'-'+key;
        var dothis = $(targetid);
        
        // replace newlines with breaks for proper html rendering
        if ( typeof value==="string" && value.indexOf("\n")!==-1 ) {
            value = value.replace(/\n/g, "<br>");
        }

        // check for dups
        // if ( typeof dupcheck[key]!=="undefined" ) {
        //     dothis = false;
        // }

        if ( skiplink && dothis && dothis.siblings("div.user_hidden").length > 0  ) {
            if ( dothis.siblings("div.user_hidden").attr("command")==="LINK" ) {
                dothis = false;
            }
        }

        // skip objects except single entry arrays
        if ( dothis && ( typeof value==="object" || ( typeof value==="string" && value.startsWith("{") ) ) ) {
            dothis = false;
        }

        // only take action if this key is found in this tile and not a dup
        if ( dothis ) {
            dothis[key] = true;
            var oldvalue = $(targetid).html();
            var oldclass = $(targetid).attr("class");

            // swap out blanks from old value and value
            if ( oldvalue && typeof oldvalue === "string" ) {
                oldvalue = oldvalue.replace(/ /g,"_");
            }

            // remove spaces from class
            var extra = value;
            if ( value && typeof value === "string" ) {
                value = value.trim();
                extra = extra.trim();
                extra = extra.replace(/ /g,"_");
            }

            // remove the old class type and replace it if they are both
            // single word text fields like open/closed/on/off
            // this avoids putting names of songs into classes
            // also only do this if the old class was there in the first place
            // also handle special case of battery and music elements
            if ( key==="battery") {
                var powmod = parseInt(value);
                powmod = powmod - (powmod % 10);
                value = "<div style=\"width: " + powmod.toString() + "%\" class=\"ovbLevel L" + powmod.toString() + "\"></div>";

            // handle weather icons that were not converted
            // updated to address new integer indexing method in ST
            } else if ( (key==="weatherIcon" || key==="forecastIcon") && !isNaN(+value) ) {
                var icondigit = parseInt(value,10);
                var iconimg;
                if ( Number.isNaN(icondigit) ) {
                    iconimg = value;
                } else {
                    var iconstr = icondigit.toString();
                    if ( icondigit < 10 ) {
                        iconstr = "0" + iconstr;
                    }
                    iconimg = "media/weather/" + iconstr + ".png";
                }
                value = "<img src=\"" + iconimg + "\" alt=\"" + iconstr + "\" width=\"80\" height=\"80\">";
            } else if ( (key === "level" || key=== "onlevel" || key === "colorTemperature" || key==="volume") && $(targetid).slider ) {
                // console.log("aid= ", aid, " targetid= ", targetid, " value= ", value);
                $(targetid).slider("value", value);
                // disable putting values in the slot
                value = false;
                oldvalue = false;

            // we now make color values work by setting the mini colors circle
            } else if ( key==="color") {
                $(targetid).html(value);
                $(targetid).attr("value", value);
                $(targetid).minicolors('value', {color: value});
                oldvalue = "";

                // var rgb = $(targetid).minicolors('rgbString');
                // console.log( "new color rgb: ", rgb);
                // var swatch = $(targetid).find("span.minicolors-swatch-color");
                // if ( swatch ) {
                //     swatch.attr("style","background-color: "+rgb+";");
                // }
                
            // special case for numbers for KuKu Harmony things
            } else if ( key.startsWith("_number_") && value.startsWith("number_") ) {
                value = value.substring(7);
            } else if ( key === "skin" && value.startsWith("CoolClock") ) {
                value = '<canvas id="clock_' + aid + '" class="' + value + '"></canvas>';
                isclock = ( oldvalue !== value );
            // handle updating album art info
            } else if ( key === "trackDescription" && !nativeimg) {
                var forceit = false;
                if ( !oldvalue ) { 
                    oldvalue = "None" ;
                    forceit = true;
                } else {
                    oldvalue = oldvalue.trim();
                }
                // this is the same as fixTrack in php code
                if ( !value || value==="None" || (value && value.trim()==="") ) {
                    value = "None";
                    forceit = false;
                    try {
                        $("#a-"+aid+"-currentArtist").html("");
                        $("#a-"+aid+"-currentAlbum").html("");
                        $("#a-"+aid+"-trackImage").html("");
                    } catch (err) { console.log(err); }
                } 

            // add status of things to the class and remove old status
            } else if ( oldclass && oldvalue && extra &&
                    key!=="name" && key!=="trackImage" && 
                    key!=="trackDescription" && key!=="mediaSource" &&
                    key!=="currentArtist" && key!=="currentAlbum" &&
                    $.isNumeric(extra)===false && 
                    $.isNumeric(oldvalue)===false &&
                    oldclass.indexOf(oldvalue)>=0 ) 
            {
                    $(targetid).removeClass(oldvalue);
                    $(targetid).addClass(extra);
            }

            // update the content 
            if (oldvalue || value) {
                try {
                    $(targetid).html(value);
                } catch (err) {}
            }
        }
    });
    
    // if we updated a clock skin render it on the page
    if ( isclock ) {
        CoolClock.findAndCreateClocks();
    }
}

function refreshTile(aid, bid, thetype, hubid) {
    $.post(cm_Globals.returnURL, 
        {useajax: "doquery", userid: cm_Globals.options.userid, id: bid, type: thetype, value: "none", attr: "none", hubid: hubid} );
}

// refresh tiles on this page when switching to it
function setupTabclick() {
    $("a.ui-tabs-anchor").click(function() {
        // save this tab for default next time
        var defaultTab = $(this).attr("id");
        if ( defaultTab ) {
            setCookie( 'defaultTab', defaultTab );
        }
    });
}

function clockUpdater() {

    // var old = new Date();
    // var utc = old.getTime() + (old.getTimezoneOffset() * 60000);
    // var d = new Date(utc + (1000*tz));        
    var userid = cm_Globals.options.userid;

    updateClock("clockdigital");
    updateClock("clockanalog");

    function updateClock(clocktype) {

        // call server to get updated digital clocks
        $.post(cm_Globals.returnURL, 
            {useajax: "getclock", userid: userid, id: clocktype, type: "clock"},
            function (presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult==="object" ) {
                    console.log("Updating ",clocktype," with: ", presult);

                    // remove time items since we don't want to mess up the second updater
                    delete presult["time"];

                    // first update all the clock tiles
                    $('div.panel div.thing[bid="'+clocktype+'"]').each(function() {
                        var aid = $(this).attr("aid");
                        if ( aid ) {
                            updateTile(aid, presult);
                        }
                    });

                    // now update all linked tiles with weekdays and dates
                    // don't bother updating time zones - they dont really change
                    $('div.panel div.thing[linkbid="'+clocktype+'"]').each(function() {
                        var aid = $(this).attr("aid");
                        if ( aid ) {
                            var weekdayid = "#a-"+aid+"-weekday";
                            if ( weekdayid ) { $(weekdayid).html(presult.weekday); }
                            var dateid =  "#a-"+aid+"-date";
                            if ( dateid ) { $(dateid).html(presult.date); }
                            if ( presult.skin ) {
                                var skinid =  "#a-"+aid+"-skin";
                                if ( skinid ) { $(skinid).html(presult.skin); }
                            }
                        }
                    });
                } else {
                    console.log("Error obtaining ", clocktype, " clock update. pstatus: ", pstatus," presult: ", presult);
                }
            }, "json"
        );
    }

    // call server to get updated analog clocks
    // $.post(cm_Globals.returnURL, 
    //     {useajax: "getclock", userid: userid, id: "clockanalog", type: "clock"},
    //     function (presult, pstatus) {
    //         if ( pstatus==="success" && typeof presult==="object" ) {
    //             // console.log("Updating analog clocks with: ", presult);

    //             // remove time items since we don't want to mess up the second updater
    //             delete presult["time"];
    
    //             // first update all the clock tiles
    //             $('div.panel div.thing[bid="clockanalog"]').each(function() {
    //                 var aid = $(this).attr("aid");
    //                 if ( aid ) {
    //                     updateTile(aid, presult);
    //                 }
    //             });

    //             // now update all linked tiles with weekdays and dates
    //             // don't bother updating time zones - they dont really change
    //             $('div.panel div.thing[linkbid="clockanalog"]').each(function() {
    //                 var aid = $(this).attr("aid");
    //                 if ( aid ) {
    //                     var weekdayid = "#a-"+aid+"-weekday";
    //                     if ( weekdayid ) { $(weekdayid).html(presult.weekday); }
    //                     var dateid =  "#a-"+aid+"-date";
    //                     if ( dateid ) { $(dateid).html(presult.date); }
    //                     var skinid =  "#a-"+aid+"-skin";
    //                     if ( skinid ) { $(skinid).html(presult.skin); }
    //                 }
    //             });
    //         } else {
    //             console.log("Error obtaining analog clock update");
    //         }
    //     }, "json"
    // );

}

function setupTimer(timertype, timerval, hubid) {

    // we now pass the unique hubId value instead of numerical hub
    // since the number can now change when new hubs are added and deleted
    var updarray = [timertype, timerval, hubid];
    updarray.myMethod = function() {

        var that = this;
        console.log("hub #" + that[2] + " timer = " + that[1] + " timertype = " + that[0] + " priorOpmode= " + priorOpmode + " modalStatus= " + modalStatus);
        var err;

        if ( priorOpmode === "Operate" && modalStatus === 0 ) {

            try {
                // just do the post and nothing else since the post call pushClient to refresh the tiles
                var thingid = that[0];
                $.post(cm_Globals.returnURL, 
                    {useajax: "doquery", userid: cm_Globals.options.userid, thingid: thingid, hubid: that[2]},
                    function (presult, pstatus) {
                        if (pstatus==="success" && typeof presult==="object" ) {
                            if ( cm_Globals.logwebsocket ) {
                                console.log("timer poll refresh. pstatus = ", pstatus, " presult: ", presult);
                            }
                        }
                    }, "json"
                );
            } catch(err) {
                console.error ("Polling error", err.message);
            }
        }

        // repeat the method above indefinitely
        // console.log("timer= " + that[1]);
        setTimeout(function() {updarray.myMethod();}, that[1]);
    };

    // wait before doing first one - or skip this hub if requested
    if ( timerval && timerval >= 1000 ) {
        // alert("timerval = " + timerval);
        setTimeout(function() {updarray.myMethod();}, timerval);
    }
    
}

// setup clicking on the action portion of this thing
// this used to be done by page but now it is done by sensor type
function setupPage() {
    
    $("div.overlay > div").off("click.tileactions");
    $("div.overlay > div").on("click.tileactions", function(evt) {

        var that = this;
        var aid = $(this).attr("aid");
        var subid = $(this).attr("subid");
        var id = $(this).attr("id");

        // avoid doing click if the target was the title bar
        // also skip sliders tied to subid === level or colorTemperature
        if ( ( typeof aid==="undefined" ) || 
             ( subid==="level" ) || 
             ( subid==="onlevel" ) || 
             ( subid==="volume" ) || 
             ( subid==="colorTemperature" ) ||
             ( id && id.startsWith("s-") ) ) {
            return;
        }
        
        // var tile = '#t-'+aid;
        var thetype = $(that).attr("type");
        var thingname = $("#s-"+aid).html();
        
        // handle special control type tiles that perform javascript actions
        // if we are not in operate mode only do this if click is on operate
        if ( thetype==="control" && (priorOpmode==="Operate" || subid==="operate") ) {
            if ( $(this).hasClass("confirm") ) {
                var pos = {top: 100, left: 100};
                createModal("modalexec","<p>Perform " + subid + " operation ... Are you sure?</p>", "body", true, pos, function(ui) {
                    var clk = $(ui).attr("name");
                    if ( clk==="okay" && subid!=="name" ) {
                        execButton(subid);
                    }
                });
            } else {
                if ( subid!=="name" ) {
                    execButton(subid);
                }
            }
            return;
        }

        // ignore all other clicks if not in operate mode
        // including any password protected ones
        if ( priorOpmode!=="Operate" ) {
            return;
        }

        // check for read only custom field that ignores any action clicks for whole tile
        var ro = false;
        if ( subid==="readonly" ) {
            ro = true;
        } else {
            var rosib = $(this).parent().siblings("div.overlay.readonly");
            if ( rosib && rosib.length > 0 ) {
                ro = true;
            }
        }

        if ( ro ) {
            return;
        }
        
        // check for clicking on a password field
        // or any other field of a tile with a password sibling
        // this can only be true if user has added one using tile customizer
        var pw = false;
        if ( subid==="password" ) {
            pw = $(this).html();
        } else {
            var pwsib = $(this).parent().siblings("div.overlay.password");
            if ( pwsib && pwsib.length > 0 ) {
                pw = pwsib.children("div.password").html();
            }
        }

        // now ask user to provide a password to activate this tile
        // or if an empty password is given this becomes a confirm box
        // the dynamically created dialog box includes an input string if pw given
        // uses a simple md5 hash to store user password - this is not strong security
        if ( typeof pw === "string" && pw!==false ) {
            checkPassword(that, thingname, pw, processClick);
        } else {
            processClick(that, thingname);
        }
        evt.stopPropagation();

    });
   
}

function checkPassword(tile, thingname, pw, yesaction) {

    var userpw = "";
    var tpos = $(tile).offset();
    var ttop = (tpos.top > 95) ? tpos.top - 90 : 5;
    var pos = {top: ttop, left: tpos.left};
    var htmlcontent;
    if ( pw==="" ) {
        htmlcontent = "<p>Operate action for tile [" + thingname + "] Are you sure?</p>";
    } else {
        htmlcontent = "<p>" + thingname + " is Password Protected</p>";
        htmlcontent += "<div class='ddlDialog'><label for='userpw'>Password:</label>";
        htmlcontent += "<input class='ddlDialog' id='userpw' type='password' size='20' value='' />";
        htmlcontent += "</div>";
    }
    
    createModal("modalexec", htmlcontent, "body", true, pos, 
    function(ui) {
        var clk = $(ui).attr("name");
        if ( clk==="okay" ) {
            if ( pw==="" ) {
                // console.log("Tile action confirmed for tile [" + thingname + "]");
                yesaction(tile, thingname);
            } else {
                userpw = $("#userpw").val();
                $.post(cm_Globals.returnURL, 
                    {useajax: "pwhash", userid: cm_Globals.options.userid, id: "none", type: "verify", value: userpw, attr: pw},
                    function (presult, pstatus) {
                        if ( pstatus==="success" && presult==="success" ) {
                            // console.log("Protected tile [" + thingname + "] access granted.");
                            yesaction(tile, thingname);
                        } else {
                            console.log("Protected tile [" + thingname + "] access denied.");
                        }
                    }
                );

            }
        } else {
            console.log("Protected tile [" + thingname + "] access cancelled.");
        }
    },
    // after box loads set focus to pw field
    function(hook, content) {
        $("#userpw").focus();
        
        // set up return key to process and escape to cancel
        $("#userpw").off("keydown");
        $("#userpw").on("keydown",function(e) {
            if ( e.which===13  ){
                $("#modalokay").click();
            }
            if ( e.which===27  ){
                $("#modalcancel").click();
            }
        });
    });
}

function stripOnoff(thevalue) {
    var newvalue = thevalue.toLowerCase();
    if ( newvalue==="on" || newvalue==="off" ) {
        return " ";
    } else if ( newvalue.endsWith("on") ) {
        thevalue = thevalue.substr(0, thevalue.length-2);
    } else if ( newvalue.endsWith("off") ) {
        thevalue = thevalue.substr(0, thevalue.length-3);
    }
    if ( thevalue.substr(-1)!==" " && thevalue.substr(-1)!=="_" && thevalue.substr(-1)!=="-" && thevalue.substr(-1)!=="|" ) {
        thevalue+= " ";
    }
    return thevalue;
}

function addOnoff(targetid, subid, thevalue) {
    thevalue = stripOnoff(thevalue);
    if ( $(targetid).hasClass("on") ) {
        $(targetid).removeClass("on");
        $(targetid).addClass("off");
        $(targetid).html(thevalue+"On");
        thevalue = "off";
    } else if ( $(targetid).hasClass("off") )  {
        $(targetid).removeClass("off");
        $(targetid).addClass("on");
        $(targetid).html(thevalue+"Off");
        thevalue = "on";
    } else {
        if ( subid==="allon") {
            $(targetid).addClass("on");
            $(targetid).html(thevalue+"Off");
            thevalue = "on";
        } else if (subid==="alloff" ) {
            $(targetid).addClass("off");
            $(targetid).html(thevalue+"On");
            thevalue = "off";
        }
    }
    return thevalue;
}

// the aid value is now exactly equal to thingid -- both are the index key in the DB
// for the main things table that holds the index keys for devices shown on pages
// tileid below is the index in the devices table to the absolute device information
function processClick(that, thingname) {
    var aid = $(that).attr("aid");
    var theattr = $(that).attr("class");
    var subid = $(that).attr("subid");
    var tile = '#t-'+aid;
    var thetype = $(tile).attr("type");
    var linktype = thetype;
    var linkval = "";
    var command = "";
    var bid = $(tile).attr("bid");
    var hubid = $(tile).attr("hub");
    var userid = cm_Globals.options.userid;
    var thingid = $(tile).attr("thingid");
    var tileid = $(tile).attr("tile");
    var targetid;
    if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
        var slen = subid.length;
        targetid = '#a-'+aid+'-'+subid.substring(0,slen-3);
    } else {
        targetid = '#a-'+aid+'-'+subid;
    }

    // get the username for this click since it is easier than processing the cookie
    // cookies will be used as a fallback just in case
    var ujq = $("#infoname");
    var uname = ujq ? ujq.text() : "";
    // alert("uname = " + uname);

    // all hubs now use the same doaction call name
    var ajaxcall = "doaction";
    var thevalue = $(targetid).html();

    // special case of thermostat clicking on things without values
    // send the temperature as the value
    if ( !thevalue && (thetype=="thermostat" || thetype==="isy") && ($("#a-"+aid+"-temperature")!==null) &&
         ( subid.endsWith("-up") || subid.endsWith("-dn") ) ) {
        thevalue = $("#a-"+aid+"-temperature").html();
    }

    // handle linked tiles by looking for sibling
    // there is only one sibling for each of the music controls
    // check for companion sibling element for handling customizations
    // includes easy references for a URL or TEXT link
    // using jQuery sibling feature and check for valid http string
    // if found then switch the type to the linked type for calls
    // and grab the proper hub number
    var usertile = $(that).siblings(".user_hidden");
    var userval = "";
    
    if ( usertile && usertile.length>0 && $(usertile).attr("command") ) {
        command = $(usertile).attr("command");    // command type
        linkval = $(usertile).attr("linkval");    // urlencooded val
        linktype = $(usertile).attr("linktype");  // type of tile linked to

        // handle redirects to a user provided web page
        // remove the http requirement to support Android stuff
        // this places extra burden on users to avoid doing stupid stuff
        if ( command==="URL" ) {
            var userval = $(usertile).attr("linkval");      // raw user provided val
            try {
                if ( !userval ) {
                    throw "URL value is empty";
                }
                window.open(userval,'_blank');
            } catch(e) {
                console.log("user provided URL failed to open: ", e);
            }
            return;
        }

        // all the other command types are handled on the server side
        // this is enabled by the settings above for command, linkval, and linktype
    }

    // no longer treat TEXT custom fields as passive since they could be relabeling of action fields which is fine
    // if they are not leaving them as an active hub call does no harm - it just returns false but you loose inspections
    // to compensate for loss of inspection I added any custom field starting with "label" subid will inspect
    var ispassive = (subid==="custom" || subid==="temperature" || subid==="battery" || //  (command==="TEXT" && subid!=="allon" && subid!=="alloff") ||
        subid==="presence" || subid==="motion" || subid==="contact" || subid==="status" ||
        subid==="time" || subid==="date" || subid==="tzone" || subid==="weekday" ||
        subid==="video" || subid==="frame" || subid=="image" || subid==="blank" || subid.startsWith("label") ||
        (thetype==="ford" && !subid.startsWith("_"))
    );

    // alert("command: "+command+" subid: "+subid+" passive: "+ispassive);

    // turn momentary and piston items on or off temporarily
    // but only for the subid items that expect it
    // and skip if this is a custom action since it could be anything
    // also, for momentary buttons we don't do any tile updating
    // other than visually pushing the button by changing the class for 1.5 seconds
    if ( command==="" && ( (thetype==="momentary" && subid==="momentary") || 
                           (thetype==="piston" && subid.startsWith("piston") ) ) ) {
        var tarclass = $(targetid).attr("class");
        // define a class with method to reset momentary button
        var classarray = [$(targetid), tarclass, thevalue];
        classarray.myMethod = function() {
            this[0].attr("class", this[1]);
            this[0].html(this[2]);
        };

        if ( thevalue==="on" || thevalue==="off" ) {
            thevalue = thevalue==="on" ? "off" : "on";
        }
        console.log(ajaxcall + ": thingname= " + thingname + " command= " + command + " bid= "+bid+" hub Id= " + hubid + " type= " + thetype + " linktype= " + linktype + " subid= " + subid + " value= " + thevalue + " linkval= " + linkval + " attr="+theattr);

        $.post(cm_Globals.returnURL, 
            {useajax: ajaxcall, userid: userid, thingid: thingid, tileid: tileid, id: bid, type: thetype, value: thevalue,
                attr: subid, subid: subid, hubid: hubid},
            function(presult, pstatus) {
                if (pstatus==="success") {
                    console.log( ajaxcall + ": POST returned:", presult );
                    if (thetype==="piston") {
                        $(targetid).addClass("firing");
                        $(targetid).html("firing");
                    } else if ( $(targetid).hasClass("on") ) {
                        $(targetid).removeClass("on");
                        $(targetid).addClass("off");
                        $(targetid).html("off");
                    } else if ( $(targetid).hasClass("off") )  {
                        $(targetid).removeClass("off");
                        $(targetid).addClass("on");
                        $(targetid).html("on");
                    }
                    setTimeout(function(){classarray.myMethod();}, 1500);
                }
            }, 
        "json");

    // process user provided allon or alloff fields that turn all lights on or off
    } else if ( command==="TEXT" && (subid==="allon" || subid==="alloff") ) {
        var panel = $(tile).attr("panel");
        thevalue = addOnoff(targetid, subid, thevalue);
        $('div[panel="' + panel + '"] div.overlay.switch div').each(function() {
            var aid = $(this).attr("aid");
            var tile = '#t-'+aid;
            var thetype = $(tile).attr("type");
            var bid = $(tile).attr("bid");
            var hubid = $(tile).attr("hub");
            var thingid = $(tile).attr("thingid");
            var tileid = $(tile).attr("tile");
            var roomid = $("#panel-"+panel).attr("roomid");
                    
            var val = thevalue;

            var sib = $(this).siblings("div.user_hidden");
            if ( sib && sib.length > 0 ) {
                command = sib.attr("command");
                linkval = sib.attr("linkval");
            } else {
                command = "";
                linkval = "";
            }
            // force use of command mode by setting attr to blank
            theattr = "";  // $(this).attr("class");

            // for ISY only process if uom_switch is 100 which means a light
            // and fix use of on/off to DON/DOF
            var uomid = "#a-" + aid + "-uom_switch";
            if ( thetype==="ISY" ) {
                if ( $(uomid) && $(uomid).html() !== "100" ) {
                    val = false;
                } else if ( val==="on" ) {
                    val = "DON";
                }
                else if ( val==="off" ) {
                    val = "DOF";
                }
            }
            // console.log(subid, "clicked. bid: ", bid, " type: ", thetype, " value: ", thevalue, 
            //                    " attr: ", theattr, " hubid: ", hubid, " command: ", command, " linkval: ", linkval );
            if ( val ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: ajaxcall, userid: userid, id: bid, thingid: thingid, tileid: tileid, type: thetype, value: val, roomid: roomid,
                     attr: theattr, subid: "switch", hubid: hubid, command: command, linkval: linkval} );
            }
        });

    } else if ( ispassive ) {
        // console.log("Refreshing tile of passive clicked on element: ", subid, " tile type: ", thetype);
        $(targetid).html(thevalue);

        // open all images that are graphics files in a new window
        // var sibimage = $('#a-'+aid+'-_media_');
        // if ( sibimage && sibimage.html() ) {
        //     window.open(sibimage.html(), "_blank");
        //     return;
        // }
        
        // emulate refresh for show popup window for blanks and customs
        // no longer do this - will later implement a rule API function
        // TODO - implement passive click API function
        // $.post(cm_Globals.returnURL, 
        //     {useajax: "passiveclick", userid: cm_Globals.options.userid, id: bid, type: thetype, value: thevalue, uname: uname, 
        //      attr: theattr, subid: subid, hubid: hubid, command: command, linkval: linkval} );

        // if ( thetype!=="image" && thetype!=="video" ) {
        //     // var idx = thetype + "|" + bid;
        //     // var thing= cm_Globals.allthings[idx];
        //     // var value = thing.value;

        //     // make post call emulating refresh from hub to force rule execution
        //     // note we include field that signals to skip any value updates
        //     var body = {
        //         msgtype: "update", 
        //         hubid: hubid,
        //         change_device: bid,
        //         change_attribute: subid,
        //         change_value: thevalue,
        //         skip_push: true 
        //     };
        //     $.post(cm_Globals.returnURL, body);
 
        // TODO - rewrite this to show the hidden graphical fields
        //     // var showstr = "";
        //     // $.each(value, function(s, v) {
        //     //     if ( v!==null && s!=="password" && !s.startsWith("user_") ) {
        //     //         var txt = v.toString();
        //     //         txt = txt.replace(/<.*?>/g,'');
        //     //         showstr = showstr + s + ": " + txt + "<br>";
        //     //     }
        //     // });
        //     // var winwidth = $("#dragregion").innerWidth();
        //     // var leftpos = $(tile).position().left + 5;
        //     // if ( leftpos + 220 > winwidth ) {
        //     //     leftpos = leftpos - 110;
        //     // }
        //     // var pos = {top: $(tile).position().top + 80, left: leftpos};
        //     // createModal("modalpopup", showstr, "body", false, pos, function(ui) {
        //     // });
        // }

    } else {
        // invert value for lights since we want them to do opposite of state
        // this isn't needed for ST or HE but I put this here for ISY
        // in ST and HE the inversion is handled in the groovy code on attr
        // and the value is ignored unless attr is blank which it won't be here
        // but for ISY we pass the value directly to the hub so must be right
        // however, I still inverted the ST and HE values to support future update
        // where I might just look at thevalue for these hubs types as it should be
        // the attr action was a terrible workaround put in a much earlier version
        // we also convert any click on button tiles into a pushed call if it was held before
        if ( (subid==="switch") && (thevalue==="on" || thevalue==="off")  ) {
            thevalue = thevalue==="on" ? "off" : "on";
        } else if ( subid==="button" && thevalue==="held" ) {
            thevalue = "pushed";
        }

        // remove isy type check since it could be a link
        else if ( subid==="switch" && command==="" && (thevalue==="DON" || thevalue==="DOF" )  ) {
            thevalue = thevalue==="DON" ? "DOF" : "DON";
        }

        // invert open and close for doors and valves and set commaned
        else if ( (subid==="door" || subid==="valve") && (thevalue==="open" || thevalue==="closed") ) {
            thevalue = thevalue==="open" ? "close" : "open";
        }

        // invert and set lock command
        else if ( subid==="lock" && (thevalue==="locked" || thevalue==="unlocked") ) {
            thevalue = thevalue==="locked" ? "unlock" : "lock";
        }

        console.log("URL: ", cm_Globals.returnURL," ", ajaxcall + ": userid= ",userid," thingid= ",thingid,"tileid= ",tileid, "thingname= " + thingname + " command= " + command + " bid= "+bid+" hub= " + hubid + " type= " + thetype + " linktype= " + linktype + " subid= " + subid + " value= " + thevalue + " linkval= " + linkval + " attr="+theattr);

        // create a visual cue that we clicked on this item
        $(targetid).addClass("clicked");
        setTimeout( function(){ $(targetid).removeClass("clicked"); }, 750 );

        // pass the call to main routine
        // if an object is returned then show it in a popup dialog
        // removed this behavior since it is confusing - only do it above for passive tiles
        // values returned from actions are pushed back to GUI from server via pushClient call
        // alert("API call: " + ajaxcall + " bid: " + bid + " type: " + thetype + " value: " + thevalue);
        // hubid = "auto";
        $.post(cm_Globals.returnURL, 
               {useajax: ajaxcall, userid: userid, id: bid, thingid: thingid, type: thetype, value: thevalue,
                attr: theattr, subid: subid, hubid: hubid, tileid: tileid, command: command, linkval: linkval},
            function (presult, pstatus) {
                if (pstatus==="success") {

                    if ( typeof presult==="object" ) {
                        var showstr = "";
                        // console.log("doaction query result: ", presult);
                        $.each(presult, function(s, v) {
                            if ( s && v && s!=="password" && !s.startsWith("user_") ) {
                                // first try to parse as json string
                                try {
                                    var jsontval = JSON.parse(v);
                                } catch(jerr) {
                                    jsontval = null;
                                }
                                if ( jsontval && typeof jsontval==="object" ) {
                                    for (var jtkey in jsontval ) {
                                        var jtval = jsontval[jtkey];
                                        if ( jtval ) {
                                            if ( jtval.length > 12 ) {
                                                showstr = showstr + jtkey + ": " + jtval.substr(0,10) + "...<br>";
                                            } else {
                                                showstr = showstr + jtkey + ": " + jtval + "<br>";
                                            }
                                        }
                                    }
                                } else {
                                    if ( typeof v !== "string" ) {
                                        v = v.toString();
                                    }
                                    if ( v.length > 12 ) {
                                        showstr = showstr + s + ": " + v.substr(0,10) + "...<br>";
                                    } else {
                                        showstr = showstr + s + ": " + v + "<br>";
                                    }
                                }
                            }
                        });
                        var winwidth = $("#dragregion").innerWidth();
                        var leftpos = $(tile).position().left + 5;
                        if ( leftpos + 220 > winwidth ) {
                            leftpos = leftpos - 110;
                        }
                        var pos = {top: $(tile).position().top + 80, left: leftpos};
                        closeModal("modalpopup");
                        createModal("modalpopup", showstr, "body", false, pos, function(ui) {} );
                    } else if ( !presult.startsWith("error") ) {
                        console.log("Success: result will be pushed later.");
                    } else {
                        console.log("Unrecognized return from POST call. result: ", presult);
                    }
                }
            }, "json"
        );

    } 
}
