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
cm_Globals.thingidx = null;
cm_Globals.allthings = null;
cm_Globals.options = null;
cm_Globals.returnURL = "";
cm_Globals.hubId = "all";
cm_Globals.client = -1;
cm_Globals.skipseconds = false;

var modalStatus = 0;
var modalWindows = {};
var priorOpmode = "Operate";
var pagename = "main";

// set a global socket variable to manage two-way handshake
// var wsSocket = null;
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
function getAllthings() {
        $.post(cm_Globals.returnURL, 
            {useajax: "getthings", id: "none", type: "none", attr: ""},
            function (presult, pstatus) {
                if (pstatus==="success" && typeof presult==="object" ) {
                    var keys = Object.keys(presult);
                    cm_Globals.allthings = presult;
                    console.log("getAllthings returned from " + cm_Globals.returnURL + " " + keys.length + " things");
                } else {
                    console.log("Error: failure obtaining things from HousePanel: ", presult);
                    cm_Globals.allthings = null;
                }
            }, "json"
        );
}

// obtain options using an ajax api call
// could probably read Options file instead
// but doing it this way ensure we get what main app sees
function getOptions(dosetup) {
    var doreload = "";
    try {
    $.post(cm_Globals.returnURL, 
        {useajax: "getoptions", id: "none", type: "none", attr: doreload},
        function (presult, pstatus) {
            if (pstatus==="success" && typeof presult==="object" && presult.index ) {
                cm_Globals.options = clone(presult);
                var indexkeys = Object.keys(presult.index);
                console.log("getOptions returned: " + indexkeys.length + " things");
                if ( dosetup ) {
                    setupUserOpts();
                }
            } else {
                cm_Globals.options = null;
                console.log("error - failure reading your hmoptions.cfg file");
            }
        }, "json"
    );
    } catch(e) {
        console.log("error - failure reading your hmoptions.cfg file");
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
        var unamere = /^\D\S{3,}$/;      // start with a letter and be four long at least
        // $("#uname").val("default");
        $("#uname").focus();
        $("#loginform").on("keydown", function() {
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

        $("#pword").on("keydown",function(e) {
            if ( e.which===13 ){
                execButton("dologin");
                e.stopPropagation();
            }
        });
    }

    // load things and options
    if ( pagename!=="login" ) {
        getAllthings();
        getOptions(true);
        initWebsocket();
        
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
        setupCustomCount();
        setupFilters();
    }

    // handle interactions for main page
    // note that setupFilters will be called when entering edit mode
    if ( pagename==="main" ) {
        setupTabclick();
        cancelDraggable();
        cancelSortable();
        cancelPagemove();

        // finally we wait one second then setup page clicks and web sockets
        if ( !cm_Globals.disablepub ) {
            setTimeout(function() { 
                setupPage(); 
                setupSliders();
                setupColors();
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

function getHub(hubnum) {
    var ahub = null;
    try {
        var options = cm_Globals.options;
        var hubs = options.config["hubs"];
    } catch (e) {
        hubs = null;
    }

    if ( hubs && hubnum!=="-1" ) {
        $.each(hubs, function (num, hub) {
            if ( hubnum === hub.hubId ) {
                ahub = hub;
            }
        });
    }
    return ahub;
}

function setupUserOpts() {
    
    // get hub info from options array
    var options = cm_Globals.options;
    if ( !options || !options.config ) {
        console.log("error - valid options file not found.");
        return;
    }
    var config = options.config;
    
    // we could disable this timer loop
    // we also grab timer from each hub setting now
    // becuase we now do on-demand updates via webSockets
    // but for now we keep it just as a backup to keep things updated
    try {
        var hubs = config["hubs"];
    } catch(err) {
        console.log ("Couldn't retrieve hubs. err: ", err);
        hubs = null;
    }
    if ( hubs && typeof hubs === "object" ) {
        // loop through every hub
        $.each(hubs, function (num, hub) {
            // var hubType = hub.hubType;
            var timerval;
            var hubId = hub.hubId;
            if ( hub.hubTimer ) {
                timerval = parseInt(hub.hubTimer, 10);
                if ( isNaN(timerval) ) {
                    timerval = 0;
                }
            } else {
                timerval = 0;
            }
            if ( timerval >= 1000 ) {
                console.log("Timer for hub: ", hub.hubName," = ", timerval);
                setupTimer(timerval, "all", hubId);
            }
        });
    }

    // try to get timers
    try {
        var fast_timer = config.fast_timer;
        fast_timer = parseInt(fast_timer, 10);
        var slow_timer = config.slow_timer;
        slow_timer = parseInt(slow_timer, 10);
    } catch(err) {
        console.log ("Couldn't retrieve slow or fast timers; using defaults. err: ", err);
        fast_timer = 0;
        slow_timer = 24 * 3600;
    }

    // this can be disabled by setting anything less than 1000
    if ( fast_timer && fast_timer >= 1000 ) {
        setupTimer(fast_timer, "fast", -1);
    }

    if ( slow_timer && slow_timer >= 1000 ) {
        setupTimer(slow_timer, "slow", -1);
    }
    
    // TODO: wire up a new time zone feature
    var tzoffset = -5;
    clockUpdater(tzoffset);


}

function initWebsocket() {

    // get the webSocket info
    try {
        var webSocketUrl = $("input[name='webSocketUrl']").val();
    } catch(err) {
        webSocketUrl = null;
    }
    
    // set up socket
    if ( webSocketUrl ) {
        setupWebsocket(webSocketUrl);
    }

}

// new routine to set up and handle websockets
// only need to do this once - I have no clue why it was done the other way before
function setupWebsocket(webSocketUrl)
{
    var wsSocket = null;

    try {
        console.log("Creating webSocket for: ", webSocketUrl);
        wsSocket = new WebSocket(webSocketUrl);
    } catch(err) {
        console.log("Error attempting to create webSocket for: ", webSocketUrl," error: ", err);
        return;
    }
    
    // upon opening a new socket notify user and do nothing else
    wsSocket.onopen = function(){
        console.log("webSocket connection opened for: ", webSocketUrl);
    };
    
    wsSocket.onerror = function(evt) {
        console.error("webSocket error observed: ", evt);
    };

    // received a message from housepanel-push or hpserver.js
    // this contains a single device object
    // this is where pushClient is processed for hpserver.js
    wsSocket.onmessage = function (evt) {
        var reservedcap = ["name", "password", "DeviceWatch-DeviceStatus", "DeviceWatch-Enroll", "checkInterval", "healthStatus"];
        try {
            var presult = JSON.parse(evt.data);
            // console.log("pushClient: ", presult);
            var bid = presult.id;
            var thetype = presult.type;
            var pvalue = presult.value;
            var client = parseInt(presult.client);
            var clientcount = presult.clientcount;
            var subid = presult.trigger;
            var idx = thetype + "|" + bid;
            try {
                var blackout = cm_Globals.options.config["blackout"].toString();
            } catch (e) {
                blackout = "false";
            }

            // reload page if signalled from server
            if ( bid==="reload" ) {

                // skip reload if we are asleep
                if ( priorOpmode === "Sleep" ) {
                    return;
                }

                // reload all screens if that is requested
                if ( typeof thetype==="undefined" || thetype==="" || thetype==="/" || thetype==="reload" || thetype==="/reload" ) {
                    var reloadpage =  cm_Globals.returnURL;
                    window.location.href = reloadpage;

                } else {
                    if ( thetype.substr(0,1)!=="/" ) {
                        thetype = "/" + thetype;
                    }
                    reloadpage =  cm_Globals.returnURL + thetype;
                    window.location.href = reloadpage;
                }
                return;
            }

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
        } catch (err) {
            console.log("Error interpreting webSocket message. err: ", err);
            return;
        }
        
        // check if we have valid info for this update item
        if ( bid!==null && thetype && pvalue && typeof pvalue==="object" ) {
        
            // change not present to absent for presence tiles
            // it was an early bad design decision to alter ST's value that I'm now stuck with
            // nope ... removed it
            // if ( pvalue["presence"] && pvalue["presence"] ==="not present" ) {
            //     pvalue["presence"] = "absent";
            // }

            // console.log("websocket tile update. id: ", bid, " type: ", thetype, " pvalue: ", pvalue);

            // update the global allthings array
            for ( var psubid in pvalue ) {
                cm_Globals.allthings[idx]["value"][psubid] = pvalue[psubid];
            }

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
            // if ( subid==="trackImage" ) {
            //     console.log("subid= ", subid, " pvalue: ", pvalue);
            // }
            $('div.panel div[command="LINK"][linkbid="' + bid + '"][subid="' + subid + '"]').each(function() {

                // get the id to see if it is the thing being updated
                var linkedtile = $(this).attr("linkval");
                var src = $("div.thing.p_"+linkedtile);
                var lbid = src.attr("bid");
                var thisbid = $(this).attr("linkbid");

                // if we have a match, update the sibling field
                if ( lbid === thisbid ) {
                    var sibling = $(this).next();
                    var oldvalue = sibling.html();
                    var oldclass = $(sibling).attr("class");
                    var value = pvalue[subid];

                    // change not present to absent for presence tiles
                    // it was an early bad design decision to alter ST's value that I'm now stuck with
                    // if ( subid==="presence" && value==="not present" ) {
                    //     value = "absent";
                    // }

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
                    $(sibling).html( value );
                }
            });

            // blank screen if night mode set
            if ( thetype==="mode" && subid==="themode" && blackout==="true" && priorOpmode === "Operate" ) {
                if ( pvalue[subid]==="Night" ) {
                    execButton("blackout");
                } else if ( $("#blankme") ) {
                    $("#blankme").off("click");
                    $("#blankme").remove(); 
                    priorOpmode = "Operate";
                }
            }

        }
    };
    
    // if this socket connection closes then try to reconnect
    wsSocket.onclose = function(){
        console.log("webSocket connection closed for: ", webSocketUrl);
        // initWebsocket();
    };
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
                var hsl = rgb2hsv( newcolor.r, newcolor.g, newcolor.b );
                var hslstr = "hsl("+hsl.hue.pad(3)+","+hsl.saturation.pad(3)+","+hsl.level.pad(3)+")";
                var tile = '#t-'+aid;
                var bid = $(tile).attr("bid");
                var hubnum = $(tile).attr("hub");
                var thetype = $(tile).attr("type");
                // console.log("doaction: id= "+bid+" type= "+ thetype+ " color= "+ hslstr);
                $.post(cm_Globals.returnURL, 
                       {useajax: "doaction", id: bid, type: thetype, value: hslstr, attr: "color", hubid: hubnum} );
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
            var hubnum = $(tile).attr("hub");
            var ajaxcall = "doaction";
            var subid = thing.attr("subid");
            var thevalue = parseInt(ui.value);
            var thetype = $(tile).attr("type");
            
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
            
            $.post(cm_Globals.returnURL, 
                {useajax: ajaxcall, id: bid, type: linktype, value: thevalue, attr: subid, 
                 subid: subid, hubid: hubnum, command: command, linkval: linkval} );
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
            var hubnum = $(tile).attr("hub");
            var ajaxcall = "doaction";
            var subid = thing.attr("subid");
            var thevalue = parseInt(ui.value);
            var thetype = $(tile).attr("type");
            var usertile = thing.siblings(".user_hidden");
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
                {useajax: ajaxcall, id: bid, type: thetype, value: parseInt(ui.value), 
                          attr: "colorTemperature", subid: subid, hubid: hubnum, command: command, linkval: linkval } );
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
    $("#catalog").remove();
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
            var pages = {};
            var k = 0;
            // get the new list of pages in order
            // fix nasty bug to correct room tab move
            $("#roomtabs >li.ui-tab").each(function() {
                var pagename = $(this).children().first().text();
                pages[pagename] = k;
                k++;
                updateSortNumber(this, k.toString());
            });
            // console.log("reordering " + k + " rooms: ", pages);
            $.post(cm_Globals.returnURL, 
                {useajax: "setorder", id: "none", type: "rooms", value: pages, attr: "none"},
                function (presult, pstatus) {
                    if (pstatus==="success" && typeof presult==="object" ) {
                        console.log( "setorder POST returned: ", presult );
                    } else {
                        console.log( "pstatus: ", pstatus, " presult: ", presult);
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
        var roomtitle = $(this).attr("title");
        // console.log("setup sortable: ", roomtitle);
        
        // loop through each thing in this room and number it
        var num = 0;
        $("div.thing[panel="+roomtitle+"][style*='relative']").each(function(){
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
            var roomtitle = $(ui.item).attr("panel");
            var tilenums = [];
            var num = 0;
            $("div.thing[panel="+roomtitle+"][style*='relative']").each(function(){
                // get tile name and number
                // var tilename = $(this).find(".thingname").text();
                var tile = $(this).attr("tile");
                tilenums.push(tile);
                num++;
                
                // update the sorting numbers to show new order
                updateSortNumber(this, num.toString());
            });

            // now add on the tiles that are absolute
            $("div.thing[panel="+roomtitle+"][style*='absolute']").each(function(){
                var tile = $(this).attr("tile");
                tilenums.push(tile);
            });

            // console.log("reordering " + num + " tiles out of " + tilenums.length, " tiles: ", tilenums);
            $.post(cm_Globals.returnURL, 
                {useajax: "setorder", id: "none", type: "things", value: tilenums, attr: roomtitle},
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
                    var panelid = getCookie("defaultTab");
                    panel = $("#"+panelid).text();
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
    var xhr = $.post(cm_Globals.returnURL, 
        {useajax: "getcatalog", id: 0, type: "catalog", value: "none", attr: hubpick},
        function (presult, pstatus) {
            if (pstatus==="success") {
                $("#tabs").after(presult);
            } else {
                console.log("error - ", pstatus);
            }
        }
    );
    
    // if we failed clean up
    xhr.fail( cancelDraggable );
    
    // enable filters and other stuff if successful
    xhr.done( function() {
        
        $("#catalog").draggable();
        
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
                var tile = $(thing).attr("tile");
                var thingtype = $(thing).attr("type");
                var thingname = $(thing).find(".thingname").text();

                // handle new tile creation
                if ( thing.hasClass("catalog-thing") ) {
                    // get panel of active page - have to do this the hard way
                    // because the thing in the catalog doesn't have a panel attr
                    $("li.ui-tabs-tab").each(function() {
                        if ( $(this).hasClass("ui-tabs-active") ) {
                            var clickid = $(this).attr("aria-labelledby");
                            var panel = $("#"+clickid).text();
                            var lastthing = $("div.panel-"+panel+" div.thing").last();
                            pos = {position: "absolute", top: evt.pageY, left: evt.pageX, width: 300, height: "auto"};
                            var zmax = getMaxZindex(panel);
                            startPos["z-index"] = zmax;
                            createModal("modaladd","Add: "+ thingname + " of Type: "+thingtype+" to Room: "+panel+"?<br /><br />Are you sure?", "body", true, pos, function(ui, content) {
                                var clk = $(ui).attr("name");
                                if ( clk==="okay" ) {
                                    // add it to the system
                                    // the ajax call must return a valid "div" block for the dragged new thing
                                    $.post(cm_Globals.returnURL, 
                                        {useajax: "addthing", id: bid, type: thingtype, value: panel, attr: startPos},
                                        function (presult, pstatus) {
                                            if (pstatus==="success" && !presult.startsWith("error")) {
                                                // console.log( "Added " + thingname + " of type " + thingtype + " and bid= " + bid + " to room " + panel, " pos: ", startPos);
                                                lastthing.after(presult);
                                                var newthing = lastthing.next();
                                                $(newthing).css( startPos );
                                                var snap = $("#mode_Snap").prop("checked");
                                                thingDraggable( newthing, snap, panel );
                                                setupPage();
                                                setupSliders();
                                                setupColors();
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
                    }

                    $(thing).css(startPos);
                    
                    // now post back to housepanel to save the position
                    // also send the dragthing object to get panel name and tile pid index
                    if ( ! $("#catalog").hasClass("ui-droppable-hover") ) {
                        // console.log( "Moving tile #" + tile + " to position: ", startPos);
                        $.post(cm_Globals.returnURL, 
                               {useajax: "setposition", id: bid, type: thingtype, value: panel, attr: startPos, tile: tile}
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
                // easy to get panel of active things
                var panel = $(thing).attr("panel");
                var id = $(thing).attr("id");
                var tile = $(thing).attr("tile");
                // var tilename = $("#s-"+aid).text();
                // var tilename = $("span.original.n_"+tile).html();
                var tilename = $(thing).find(".thingname").text();
                var pos = {top: 100, left: 10};

                createModal("modaladd","Remove: "+ tilename + " of type: "+thingtype+" from room "+panel+"? Are you sure?", "body" , true, pos, function(ui, content) {
                    var clk = $(ui).attr("name");
                    if ( clk==="okay" ) {
                        $.post(cm_Globals.returnURL, 
                            {useajax: "dragdelete", id: bid, type: thingtype, value: panel, attr: tile},
                            function (presult, pstatus) {
                                if (pstatus==="success" && !presult.startsWith("error")) {
                                    console.log( "Removed tile #" + tile + " name: " + tilename);
                                    $(thing).remove();
                                } else {
                                    console.log("pstatus: ", pstatus, " presult: ", presult);
                                }
                            }
                        );

                    // this isn't a clone so we have to revert to original place
                    } else {
                        // $("#"+id).data('draggable').options.revert();
                        try {
                            $(thing).css("position", startPos.priorStart);
                            if ( startPos.priorStart === "relative" ) {
                                startPos.left = 0;
                                startPos.top = 0;
                            }
                            $(thing).css("left", startPos.left). css("top",startPos.top).css("z-index", startPos["z-index"] );
                        } catch(e) { 
                            console.log("Drag/drop error. Please share this with @kewashi on the ST or HE Community Forum: ", e); 
                        }
                    }
                });
            }
        });
    
    });
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
        // var obj = Object.assign(uobj, oobj);

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
            window.location.href = cm_Globals.returnURL;
        });

    } else if ( buttonid === "blackout") {
        // blank out screen with a black box size of the window and pause timers
        var w = window.innerWidth;
        var h = window.innerHeight;            
        priorOpmode = "Sleep";
        $("div.maintable").after("<div id=\"blankme\"></div>");
        $("#blankme").css( {"height":h+"px", "width":w+"px", 
                            "position":"absolute", "background-color":"black",
                            "left":"0px", "top":"0px", "z-index":"9999" } );

        // clicking anywhere will restore the window to normal
        $("#blankme").off("click");
        $("#blankme").on("click", function(evt) {
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
    dynoPost("filteroptions", fobj);
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
        }, 1000);
            
        $("button.infobutton").on('click', function() {
            // location.reload(true);
            $.post(cm_Globals.returnURL, 
                {useajax: "reload", id: 0, type: "none"} );
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

        $("#pickhub").on('change',function(evt) {
            var hubId = $(this).val();
            var target = "#authhub_" + hubId;
            
            // this is only the starting type and all we care about is New
            // if we needed the actual type we would have used commented code
            var hubType = $(target).attr("hubtype");
            // var realhubType = $("#hubdiv_" + hubId).children("select").val();
            // alert("realhubType= " + realhubType);
            if ( hubType==="New" ) {
                $("input.hubdel").addClass("hidden");
                $("#newthingcount").html("Fill out the fields below to add a New hub");
            } else {
                $("input.hubdel").removeClass("hidden");
                $("#newthingcount").html("");
            }
            $("div.authhub").each(function() {
                if ( !$(this).hasClass("hidden") ) {
                    $(this).addClass("hidden");
                }
            });
            $(target).removeClass("hidden");
            evt.stopPropagation(); 
        });
        
        // this clears out the message window
        $("div.greetingopts").on('click',function(evt) {
            $("#newthingcount").html("");
        });
        
        // handle auth submissions
        // add on one time info from user
        $("input.hubauth").click(function(evt) {
            try {
                var hubId = $(this).attr("hubid");
                var formData = formToObject("hubform_"+hubId);
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
                    if ( obj.action === "things" ) {
                        // tell user we are authorizing hub...
                        $("#newthingcount").html("Authorizing " + obj.hubType + " hub: " + obj.hubName).fadeTo(400, 0.1 ).fadeTo(400, 1.0);
                        setInterval(function() {
                            $("#newthingcount").fadeTo(400, 0.1 ).fadeTo(400, 1);
                        }, 1000);
                    }

                    // if oauth flow then start the process
                    else if ( obj.action === "oauth" ) {
                        // $("#newthingcount").html("Redirecting to OAUTH page");
                        var nvpreq= "response_type=code&client_id=" + encodeURI(obj.clientId) + "&scope=app&redirect_uri=" + encodeURI(obj.url);
                        var location = obj.host + "/oauth/authorize?" + nvpreq;
                        // alert("Ready to redirect to location: " + location);
                        window.location.href = location;

                    }
                }
            });
            evt.stopPropagation();
        });
        
        // TODO - test and activate this feature
        $("input.hubdel").click(function(evt) {
            var hubnum = $(this).attr("hub");
            var hubId = $(this).attr("hubid");
            var bodytag = "body";
            var pos = {position: "absolute", top: 600, left: 150, 
                       width: 600, height: 60, border: "4px solid"};
            // alert("Remove request for hub: " + hubnum + " hubID: " + hubId );

            createModal("modalhub","Remove hub #" + hubnum + " hubID: " + hubId + "? Are you sure?", bodytag , true, pos, function(ui, content) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    // remove it from the system
                    $.post(cm_Globals.returnURL, 
                        {useajax: "hubdelete", id: hubId, type: "none", value: "none"},
                        function (presult, pstatus) {
                            if (pstatus==="success" && !presult.startsWith("error")) {
                                getOptions();
                                // now lets fix up the auth page by removing the hub section
                                var target = "#authhub_" + hubId;
                                $(target).remove();
                                $("#pickhub > option[value='" + hubId +"']").remove();
                                $("div.authhub").first().removeClass("hidden");
                                $("#pickhub").children().first().prop("selected", true);

                                // inform user what just happened
                                var ntc = "Removed hub#" + hubnum + " hubID: " + hubId;
                                if ( $("#newthingcount") ) {
                                    $("#newthingcount").html(ntc);
                                }
                                console.log( ntc );
                                
                                // send message over to Node.js to update elements
                                // wsSocketSend("update");
                            } else {
                                if ( $("#newthingcount") ) {
                                    $("#newthingcount").html(presult);
                                }
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
        var hubnum = $(thing).attr("hub");
        var hub = getHub(hubnum);
        var hubName = "None";
        var hubType = "SmartThings";
        try {
            var customname = $("#a-"+aid+"-name").html();
        } catch(e) {
            customname = $("#s-"+aid).html();
        }
        if ( hub ) {
            hubName = hub.hubName;
            hubType = hub.hubType;
        }

        // replace all the id tags to avoid dynamic updates
        strhtml = strhtml.replace(/ id="/g, " id=\"x_");
        editTile(pagename, str_type, tile, aid, bid, thingclass, hubnum, hubName, hubType, customname, strhtml);
    });
    
    $("div.cmzlink").on("click",function(evt) {
        var aid = $(evt.target).attr("aid");
        var thing = "#" + aid;
        var thingname = $(thing).attr("name");
        var pwsib = $(evt.target).siblings("div.overlay.password");
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
            var hubnum = $(thing).attr("hub");
            customizeTile(tile, aid, bid, str_type, hubnum);
        }
        // customizeTile(tile, aid, bid, str_type, hubnum);
    });
    
    $("div.dellink").on("click",function(evt) {
        var thing = "#" + $(evt.target).attr("aid");
        var str_type = $(thing).attr("type");
        var tile = $(thing).attr("tile");
        var bid = $(thing).attr("bid");
        var panel = $(thing).attr("panel");
        var hubnum = $(thing).attr("hub");
        var tilename = $(thing).find(".thingname").text();
        var offset = $(thing).offset();
        var thigh = $(thing).height();
        var twide = $(thing).width();
        var tleft = offset.left - 600 + twide;
        if ( tleft < 10 ) { tleft = 10; }
        var pos = {top: offset.top + thigh, left: tleft, width: 600, height: 80};

        createModal("modaladd","Remove: "+ tilename + " of type: "+str_type+" from hub Id: " + hubnum + " & room "+panel+"?<br>Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "dragdelete", id: bid, type: str_type, value: panel, attr: tile},
                    function (presult, pstatus) {
                        if (pstatus==="success" && !presult.startsWith("error")) {
                            console.log("Removed tile #" + tile + " name: " + tilename);
                            $(thing).remove();
                            getOptions();
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
        var clickid = $(evt.target).parent().attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        createModal("modaladd","Remove Room #" + roomnum + " with Name: " + roomname +" from HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                // remove it from the system
                // alert("Removing thing = " + tilename);
                $.post(cm_Globals.returnURL, 
                    {useajax: "pagedelete", id: roomnum, type: "none", value: roomname, attr: "none"},
                    function (presult, pstatus) {
                        if (pstatus==="success" && !presult.startsWith("error")) {
                            console.log( "Removed Page #" + roomnum + " Page name: "+ roomname );
                            // remove it visually
                            $("li[roomnum="+roomnum+"]").remove();
                            getOptions();
                            
                            // fix default tab if it is on our deleted page
                            var defaultTab = getCookie( 'defaultTab' );
                            if ( defaultTab === clickid ) {
                                defaultTab = $("#roomtabs").children().first().attr("aria-labelledby");
                                setCookie('defaultTab', defaultTab);
                            }
                        } else {
                            console.log(presult);
                        }
                    }
                );
            }
        });
        
    });
    
    $("#roomtabs div.editpage").off("click");
    $("#roomtabs div.editpage").on("click",function(evt) {
        var roomnum = $(evt.target).attr("roomnum");
        var roomname = $(evt.target).attr("roomname");
        editTile(roomname, "page", roomname, 0, 0, "", roomnum, "None", "None", roomname);
    });
   
    $("#addpage").off("click");
    $("#addpage").on("click",function(evt) {
        var clickid = $(evt.target).attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        createModal("modaladd","Add New Room to HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "pageadd", id: "none", type: "none", value: "none", attr: "none"},
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

function showType(ischecked, theval) {
    
    var hubpick = cm_Globals.hubId;
        
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
    function updateClick() {
        var theval = $(this).val();
        var ischecked = $(this).prop("checked");
        showType(ischecked, theval);
    }

    // initial page load set up all rows
    $('input[name="useroptions[]"]').each(updateClick);
    
    // upon click update the right rows
    $('input[name="useroptions[]"]').click(updateClick);

    // hub specific filter
    $('input[name="huboptpick"]').click(function() {
        // get the id of the hub type we just picked
        cm_Globals.hubId = $(this).val();

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
        showType(true, stype);
        
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

    var dupcheck = {};
    $.each( presult, function( key, value ) {

        var targetid = '#a-'+aid+'-'+key;
        var dothis = $(targetid);
        
        // replace newlines with breaks for proper html rendering
        if ( typeof value==="string" && value.indexOf("\n")!==-1 ) {
            value = value.replace(/\n/g, "<br>");
        }

        // check for dups
        if ( typeof dupcheck[key]!=="undefined" ) {
            dothis = false;
        }

        if ( skiplink && dothis && dothis.siblings("div.user_hidden").length > 0  ) {
            if ( dothis.siblings("div.user_hidden").attr("command")==="LINK" ) {
                dothis = false;
            }
        }

        // skip objects
        if ( dothis && ( typeof value==="object" || ( typeof value==="string" && value.startsWith("{") ) ) ) {
            dothis = false;
        }

        // only take action if this key is found in this tile and not a dup
        if ( dothis ) {
            dothis[key] = true;
            var oldvalue = $(targetid).html();
            var oldclass = $(targetid).attr("class");

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
                
                // if ( (forceit || (value!==oldvalue)) && !value.startsWith("Grouped with") ) {
                if ( value!==oldvalue ) {
                    value = value.trim();
                    // console.log("music track changed from: [" + oldvalue + "] to: [" + value + "]");
                }
                
            // add status of things to the class and remove old status
            } else if ( oldclass && oldvalue && value &&
                    key!=="name" && key!=="trackImage" && 
                    key!=="trackDescription" && key!=="mediaSource" &&
                    key!=="currentArtist" && key!=="currentAlbum" &&
                    $.isNumeric(value)===false && 
                    $.isNumeric(oldvalue)===false &&
                    oldclass.indexOf(oldvalue)>=0 ) 
            {
                    $(targetid).removeClass(oldvalue);
                    $(targetid).addClass(value);
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

function refreshTile(aid, bid, thetype, hubnum) {
    var ajaxcall = "doquery";
    $.post(cm_Globals.returnURL, 
        {useajax: ajaxcall, id: bid, type: thetype, value: "none", attr: "none", hubid: hubnum} );
}

// refresh tiles on this page when switching to it
function setupTabclick() {
    // $("li.ui-tab > a").click(function() {
    $("a.ui-tabs-anchor").click(function() {
        // save this tab for default next time
        var defaultTab = $(this).attr("id");
        if ( defaultTab ) {
            setCookie( 'defaultTab', defaultTab );
        }
    });
}

function clockUpdater(tz) {

    // update the clocks and process clock rules once every minute
    setInterval(function() {
        // var old = new Date();
        // var utc = old.getTime() + (old.getTimezoneOffset() * 60000);
        // var d = new Date(utc + (1000*tz));        

        // call server to get updated digital clocks
        $.post(cm_Globals.returnURL, 
            {useajax: "getclock", id: "clockdigital", type: "clock"},
            function (presult, pstatus) {
                if ( pstatus==="success" && typeof presult==="object" ) {
                    // console.log("Updating digital clocks with: ", presult);

                    // remove time items since we don't want to mess up the second updater
                    delete presult["time"];
                    // delete presult["fmt_time"];

                    // first update all the clock tiles
                    $('div.panel div.thing[bid="clockdigital"]').each(function() {
                        var aid = $(this).attr("aid");
                        if ( aid ) {
                            updateTile(aid, presult);
                        }
                    });

                    // now update all linked tiles with weekdays and dates
                    // don't bother updating time zones - they dont really change
                    $('div.panel div.thing[linkbid="clockdigital"]').each(function() {
                        var aid = $(this).attr("aid");
                        if ( aid ) {
                            var weekdayid = "#a-"+aid+"-weekday";
                            if ( weekdayid ) { $(weekdayid).html(presult.weekday); }
                            var dateid =  "#a-"+aid+"-date";
                            if ( dateid ) { $(dateid).html(presult.date); }
                        }
                    });
                } else {
                    console.log("Error obtaining digital clock update");
                }
            }
        );

        // call server to get updated analog clocks
        $.post(cm_Globals.returnURL, 
            {useajax: "getclock", id: "clockanalog", type: "clock"},
            function (presult, pstatus) {
                if ( pstatus==="success" && typeof presult==="object" ) {
                    // console.log("Updating analog clocks with: ", presult);

                    // remove time items since we don't want to mess up the second updater
                    delete presult["time"];
                    // delete presult["fmt_time"];
        
                    // first update all the clock tiles
                    $('div.panel div.thing[bid="clockanalog"]').each(function() {
                        var aid = $(this).attr("aid");
                        if ( aid ) {
                            updateTile(aid, presult);
                        }
                    });

                    // now update all linked tiles with weekdays and dates
                    // don't bother updating time zones - they dont really change
                    $('div.panel div.thing[linkbid="clockanalog"]').each(function() {
                        var aid = $(this).attr("aid");
                        if ( aid ) {
                            var weekdayid = "#a-"+aid+"-weekday";
                            if ( weekdayid ) { $(weekdayid).html(presult.weekday); }
                            var dateid =  "#a-"+aid+"-date";
                            if ( dateid ) { $(dateid).html(presult.date); }
                            var skinid =  "#a-"+aid+"-skin";
                            if ( skinid ) { $(skinid).html(presult.skin); }
                        }
                    });
                } else {
                    console.log("Error obtaining analog clock update");
                }
            }
        );

    }, 60000 );

    // update digital clock time fields every second
    // this includes all linked fields
    // this is also where we take care of all the time formatting
    setInterval(function() {
        // var old = new Date();
        // var utc = old.getTime() + (old.getTimezoneOffset() * 60000);
        // var d = new Date(utc + (1000*tz)); 
        
        if ( cm_Globals.skipseconds ) {
            return;
        }

        var d = new Date();
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
        var defaultstr = hour + ":" + zmin + ":" + zsec;
        
        // update the time of all things on the main page
        // this skips the wysiwyg items in edit boxes
        // include format if provided by user in a sibling field
        $("div.panel div.clock.time").each(function() {
            var idx = "clock|clockdigital";
            var idxa = "clock|clockanalog";
            if ( $(this).parent().siblings("div.overlay.fmt_time").length > 0 ) {
                var timestr = $(this).parent().siblings("div.overlay.fmt_time").children("div.fmt_time").html();
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
                $(this).html(timestr);

                // save in allthing array
                // console.log("updating time: ", timestr);
                cm_Globals.allthings[idx]["value"]["time"] = timestr;
                cm_Globals.allthings[idxa]["value"]["time"] = timestr;

            // take care of linked times that don't have their own formatting string
            // one can of course add a unique formatting string to any linked time item
            // in which case the linked time will use its own formatting
            } else if ( $(this).siblings("div.user_hidden").length > 0 ) {
                var linkval = $(this).siblings("div.user_hidden").attr("linkval");
                var ival = parseInt(linkval);
                if ( linkval && !isNaN(ival) && $("div.clock.time.p_"+linkval) ) {
                    var timestr = $("div.clock.time.p_"+linkval).html();
                    $(this).html(timestr);
                }
            } else {
                var timestr = defaultstr;
                if ( hour24 >= 12 ) {
                    timestr+= " PM";
                } else {
                    timestr+= " AM";
                }
                $(this).html(timestr);

                // save in allthing array
                // console.log("updating default time: ", timestr);
                cm_Globals.allthings[idx]["value"]["time"] = timestr;
                cm_Globals.allthings[idxa]["value"]["time"] = timestr;
            }
        });
    }, 1000);
}

function setupTimer(timerval, timertype, hubnum) {

    // we now pass the unique hubId value instead of numerical hub
    // since the number can now change when new hubs are added and deleted
    var updarray = [timertype, timerval, hubnum];
    updarray.myMethod = function() {

        var that = this;
        console.log("hub #" + that[2] + " timer = " + that[1] + " timertype = " + that[0] + " priorOpmode= " + priorOpmode + " modalStatus= " + modalStatus);
        var err;

        // skip if not in operation mode or if inside a modal dialog box
        if ( priorOpmode !== "Operate" || modalStatus > 0 ) { 
            // repeat the method above indefinitely
            setTimeout(function() {updarray.myMethod();}, that[1]);
            return; 
        }

        try {
            $.post(cm_Globals.returnURL, 
                {useajax: "doquery", id: that[0], type: that[0], value: "none", attr: "none", hubid: that[2]},
                function (presult, pstatus) {

                    // skip all this stuff if we dont return an object
                    if (pstatus==="success" && typeof presult==="object" ) {

                        if ( cm_Globals.logwebsocket ) {
                            var keys = Object.keys(presult);
                            console.log("pstatus = ", pstatus, " loaded ", keys.length, " things from server");
                        }
    
                        // go through all tiles and update
                        // this uses our new aid field in all tiles
                        try {
                            $('div.panel div.thing').each(function() {
                                var aid = $(this).attr("aid");
                                // skip the edit in place tile
                                if ( aid ) {
                                    var tileid = $(this).attr("tile");
                                    var strtype = $(this).attr("type");
                                    var bid = $(this).attr("bid");
                                    var idx = strtype + "|" + bid;

                                    var thevalue;
                                    try {
                                        thevalue = presult[tileid];
                                    } catch (err) {
                                        tileid = parseInt(tileid, 10);
                                        try {
                                            thevalue = presult[tileid];
                                        } catch (err) { 
                                            thevalue = null; 
                                            console.log(err.message);
                                        }
                                    }
                                    // handle both direct values and bundled values
                                    if ( thevalue && thevalue.hasOwnProperty("value") ) {
                                        thevalue = thevalue.value;
                                    }
                                    
                                    // don't update names here via timer since we can't get user values
                                    // also skip updating music and audio album art for old music tiles 
                                    // since doing it here messes up the websocket updates
                                    // I actually kept the new audio refresh since it seems to work okay
                                    if ( thevalue && typeof thevalue==="object" ) {
                                        if ( typeof thevalue["name"]!=="undefined" ) { delete thevalue["name"]; }
                                        if ( typeof thevalue["password"]!=="undefined" ) { delete thevalue["password"]; }
                                        if ( typeof thevalue["allon"]!=="undefined" ) { delete thevalue["allon"]; }
                                        if ( typeof thevalue["alloff"]!=="undefined" ) { delete thevalue["alloff"]; }
                                        if ( strtype==="music" ) {
                                            if ( thevalue["trackDescription"] ) { delete thevalue["trackDescription"]; }
                                            if ( thevalue["trackImage"] ) { delete thevalue["trackImage"]; }
                                            if ( thevalue["currentArtist"] ) { delete thevalue["currentArtist"]; }
                                            if ( thevalue["currentAlbum"] ) { delete thevalue["currentAlbum"]; }
                                        }
                                        if ( strtype==="weather" && thevalue["forecast"] ) { delete thevalue["forecast"]; }
                                        updateTile(aid, thevalue); 
                                    }
                                }
                            });
                        } catch (err) { console.error("Polling error", err.message); }
                    }
                }, "json"
            );
        } catch(err) {
            console.error ("Polling error", err.message);
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
                    {useajax: "pwhash", id: "none", type: "verify", value: userpw, attr: pw},
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
    var hubnum = $(tile).attr("hub");
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

    var ispassive = (subid==="custom" || subid==="temperature" || subid==="battery" || (command==="TEXT" && subid!=="allon" && subid!=="alloff") ||
        subid==="presence" || subid==="motion" || subid==="contact" || subid==="status" ||
        subid==="time" || subid==="date" || subid==="tzone" || subid==="weekday" ||
        subid==="video" || subid==="frame" || subid=="image" || subid==="blank" || subid==="custom");

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
        console.log(ajaxcall + ": thingname= " + thingname + " command= " + command + " bid= "+bid+" hub Id= " + hubnum + " type= " + thetype + " linktype= " + linktype + " subid= " + subid + " value= " + thevalue + " linkval= " + linkval + " attr="+theattr);

        $.post(cm_Globals.returnURL, 
            {useajax: ajaxcall, id: bid, type: thetype, value: thevalue, uname: uname,
                attr: subid, subid: subid, hubid: hubnum},
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
            aid = $(this).attr("aid");
            tile = '#t-'+aid;
            thetype = $(tile).attr("type");
            bid = $(tile).attr("bid");
            hubnum = $(tile).attr("hub");
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
            //                    " attr: ", theattr, " hubnum: ", hubnum, " command: ", command, " linkval: ", linkval );
            if ( val ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: ajaxcall, id: bid, type: thetype, value: val, uname: uname,
                     attr: theattr, subid: "switch", hubid: hubnum, command: command, linkval: linkval} );
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
        
        // show popup window for blanks and customs
        if ( cm_Globals.allthings && thetype!=="image" && thetype!=="video" ) {
            var idx = thetype + "|" + bid;
            var thing= cm_Globals.allthings[idx];
            var value = thing.value;

            // make post call emulating refresh from hub to force rule execution
            // note we include field that signals to skip any value updates
            var body = {
                msgtype: "update", 
                hubid: hubnum,
                change_device: bid,
                change_attribute: subid,
                change_value: value[subid],
                skip_push: true 
            };
            $.post(cm_Globals.returnURL, body);
 
            var showstr = "";
            $.each(value, function(s, v) {
                if ( v && s!=="password" && !s.startsWith("user_") ) {
                    var txt = v.toString();
                    txt = txt.replace(/<.*?>/g,'');
                    showstr = showstr + s + ": " + txt + "<br>";
                }
            });
            var winwidth = $("#dragregion").innerWidth();
            var leftpos = $(tile).position().left + 5;
            if ( leftpos + 220 > winwidth ) {
                leftpos = leftpos - 110;
            }
            var pos = {top: $(tile).position().top + 80, left: leftpos};
            createModal("modalpopup", showstr, "body", false, pos, function(ui) {
            });
        }

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

        else if ( thetype==="isy" && subid==="switch" && (thevalue==="DON" || thevalue==="DOF" )  ) {
            thevalue = thevalue==="DON" ? "DOF" : "DON";
        }
        console.log("URL: ", cm_Globals.returnURL," ", ajaxcall + ": thingname= " + thingname + " command= " + command + " bid= "+bid+" hub= " + hubnum + " type= " + thetype + " linktype= " + linktype + " subid= " + subid + " value= " + thevalue + " linkval= " + linkval + " attr="+theattr);

        // create a visual cue that we clicked on this item
        $(targetid).addClass("clicked");
        setTimeout( function(){ $(targetid).removeClass("clicked"); }, 750 );

        // pass the call to main routine
        // if an object is returned then show it in a popup dialog
        // values returned from actions are pushed in another place now
        // alert("API call: " + ajaxcall + " bid: " + bid + " type: " + thetype + " value: " + thevalue);
        $.post(cm_Globals.returnURL, 
               {useajax: ajaxcall, id: bid, type: thetype, value: thevalue, uname: uname, 
                attr: theattr, subid: subid, hubid: hubnum, command: command, linkval: linkval},
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
                    } else if ( presult==="success" ) {
                        console.log("Success: result will be pushed later.");
                    } else {
                        console.log("Unrecognized return from POST call. result: ", presult);
                    }
                }
            }, "json"
        );

    } 
}
