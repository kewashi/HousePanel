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
cm_Globals.wsclient = null;

var modalStatus = 0;
var modalWindows = {};
var priorOpmode = "operate";
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

// obtain options using an ajax api call
// could probably read Options file instead
// but doing it this way ensure we get what main app sees
function getOptions() {
    priorOpmode = getCookie("opmode") || "operate";
    try {
        var userid = $("#userid").val();
        var email = $("#emailid").val();
        var skin = $("#skinid").val();
        var config = $("#configsid").val();
        var pname = $("#showversion span#infoname").html();
        config = JSON.parse(config);
        cm_Globals.options = {userid: userid, email: email, skin: skin, config: config, rules: {}};

        // disabled timer based refreshes since we no longer need this
        // setFastSlow(config);

        // set the customization list
        $.post(cm_Globals.returnURL, 
            {useajax: "getoptions", userid: userid, pname: pname, id:"none", type:"none"},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    cm_Globals.options["rules"] = presult;

                    if ( cm_Globals.options.config.blackout ) {
                        var blackout = cm_Globals.options.config.blackout;
                        blackout = (blackout === "true") || (blackout === true) ? true : false;
                    } else {
                        blackout = false;
                    }
        
                    // handle black screen
                    if ( priorOpmode === "sleep" && blackout ) {
                        execButton("blackout");
                    } else {
                        priorOpmode = "operate";
                        setCookie("opmode", priorOpmode);
                    }

                    // console.log(">>>> getOptions returned: ", presult, " opmode: ", priorOpmode);
                } else {
                    console.log("error - failure reading config options from database for user = " + userid);
                }
            }, "json"
        );
    } catch(e) {
        console.log("error - failure reading your hmoptions.cfg file", e);
    }

    function setFastSlow(config) {
        try {
            var fast_timer = config.fast_timer;
            fast_timer = parseInt(fast_timer, 10);
        } catch(err) {
            console.log ("Couldn't retrieve fast timer; disabling fast timer refresh feature. err: ", err);
            fast_timer = 0;
        }
        try {
            var slow_timer = config.slow_timer;
            slow_timer = parseInt(slow_timer, 10);
        } catch(err) {
            console.log ("Couldn't retrieve slow timer; disabling slow timer refresh feature. err: ", err);
            slow_timer = 0;
        }
        if ( fast_timer && fast_timer >= 1000 ) {
            setupTimer("fast", fast_timer, "all");
        }
        if ( slow_timer && slow_timer >= 1000 ) {
            setupTimer("slow", slow_timer, "all");
        }
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
        cm_Globals.returnURL = "https://housepanel.net:3080";
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
        // if ( tabcount === 1 ) {
        //     toggleTabs();
        // }
    
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
                    console.log(">>>> error retrieving default Tab cookie:", f);
                }
            }
        }

        cm_Globals.hubId = getCookie( 'defaultHub' );
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
        $("#emailid").focus();
        $("#loginform").on("keydown", function(e) {
            if ( e.which===27  ){
                $("#emailid").val("");
                $("#pname").val("");
                $("#pword").val("");
                $("#panelpword").val("");
            }
        });

        $("#emailid").on("keydown",function(e) {
            var unameval = $("#emailid").val();
            if ( e.which===13 || e.which===9 ){
                var msg = checkInpval("username", unameval, unamere);
                if ( msg ) {
                    $("#emailid").focus();
                    alert(msg);
                } else {
                    $("#pword").val("");
                    $("#pword").focus();
                }
                // e.stopPropagation();
            }
        });

        $("#moreinfo").off("click");
        $("#moreinfo").on("click",function(evt) {
            if ( $("#loginmore").hasClass("hidden") ) {
                $("#loginmore").removeClass("hidden");
                $(evt.target).html("Less...");
            } else {
                $("#loginmore").addClass("hidden");
                $(evt.target).html("More...");
            }
        });

        $("#newuser").off("click");
        $("#newuser").on("click",function(evt) {
            $("#loginform").addClass("hidden");
            $("#newuserform").removeClass("hidden");
        });

        $("#olduser").off("click");
        $("#olduser").on("click",function(e) {
            $("#newuserform").addClass("hidden");
            $("#loginform").removeClass("hidden");
            e.stopPropagation();
        });

        $("#revertolduser").off("click");
        $("#revertolduser").on("click",function(e) {
            window.location.href = cm_Globals.returnURL + "/logout";
        });

        $("#forgotpw").off("click");
        $("#forgotpw").on("click",function(e) {
            execForgotPassword();
            e.stopPropagation();
        });

        $("#pword").on("keydown",function(e) {
            if ( e.which===13 || e.which===9 ){
                $("#pname").val("default");
                $("#pname").focus();
                e.stopPropagation();
            }
        });

        $("#pname").on("keydown",function(e) {
            if ( e.which===13 || e.which===9 ){
                $("#panelpword").val("");
                $("#panelpword").focus();
                e.stopPropagation();
            }
        });

        $("#panelpword").on("keydown",function(e) {
            if ( e.which===13 ){
                execButton("dologin");
                e.stopPropagation();
            }
        });
    }

    // load things and options
    if ( pagename==="main" || pagename==="auth" || pagename==="options" ) {

        getOptions();
        
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
    // if (pagename==="options") {
    //     getOptions();
    //     setupCustomCount();
    //     setupFilters();
    // }

    // handle interactions for main page
    // note that setupFilters will be called when entering edit mode
    if ( pagename==="main" ) {
        setupTabclick();
        cancelDraggable();
        cancelSortable();
        cancelPagemove();
        initWebsocket();

        // run initial clock updater forcing read
        clockUpdater("clockdigital", true);
        clockUpdater("clockanalog", true);

        // repeat digital clock update every second and analog clock every minute
        setInterval( function() 
            { clockUpdater("clockdigital", false) }, 1000
        );

        // run clockdigital and clockanalog once every minute for rules
        setInterval( function() 
            { 
                clockUpdater("clockdigital", true);
                clockUpdater("clockanalog", true);
            }, 60000
        );

        // finally we wait a moment then setup page clicks
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

function initWebsocket() {
    try {
        var userid = $("#userid").val();
        var webSocketUrl = $("input[name='webSocketUrl']").val();

        if ( userid && webSocketUrl ) {

            // get the port from the panel name cookie
            var pname = getCookie("pname");
            if ( pname.substr(1,1)!==":" ) {
                pname = "1:" + pname;
            }
            var portnum = pname.substr(0,1);
            var port = 8180 + parseInt(portnum);
            webSocketUrl += ":" + port;
            $("#infoport").html("#"+portnum);
            // alert("webSocketUrl: " + webSocketUrl);
            // console.log(">>>> port:", port, " webSocketUrl:", webSocketUrl);
            setupWebsocket(userid, port, webSocketUrl);
        }
    } catch(err) {
        console.log( "error - could not initialize websocket. err: ", err);
    }
}

// new routine to set up and handle websockets
// only need to do this once - I have no clue why it was done the other way before
function setupWebsocket(userid, wsport, webSocketUrl) {
    var wsSocket = null;

    try {
        // console.log("Creating webSocket for: ", webSocketUrl);
        wsSocket = new WebSocket(webSocketUrl, "housepanel");
    } catch(err) {
        console.log("Error attempting to create webSocket for: ", webSocketUrl," error: ", err);
        return;
    }
    
    // upon opening a new socket notify user and do nothing else
    wsSocket.onopen = function() {
        console.log("webSocket connection opened for: ", webSocketUrl);

        function sendUser() {
            if ( wsSocket.readyState === wsSocket.OPEN ) {
                wsSocket.send(userid.toString() + "|" + wsport);
            }
        }
        // console.log( "ready state: ",  wsSocket.readyState );
        sendUser();
    };
    
    wsSocket.onerror = function(evt) {
        console.error("webSocket error: ", evt, " webSocketUrl: ", webSocketUrl);
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
                blackout = (blackout === "true") || (blackout === true) ? true : false;
            } else {
                blackout = false;
            }

            // reload page if signalled from server
            if ( bid==="reload" ) {

                // skip reload if we are asleep
                if ( priorOpmode !== "operate" ) {
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
                        // alert("reloading to: " + reloadpage);
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
                var thing = $("#t-"+thetype);
                if ( thing ) {
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

                // update all the tiles that match this type and id
                // this only works if tile is on the panel
                // $('div.panel div.thing[bid="'+bid+'"][type="'+thetype+'"]').each(function() {
                var panelItems = $('div.panel div.thing[bid="'+bid+'"]');
                if ( panelItems ) {
                    panelItems.each(function() {
                        try {
                            var aid = $(this).attr("aid");
                            updateTile(aid, pvalue);
                        } catch (e) {
                            console.log("Error updating tile of type: "+ thetype," id: ", bid, " value: ", pvalue, " error: ", e);
                        }
                    });
                }

                // we now handle links in the updateTile function which is more consistent
                // $('div.panel div[command="LINK"][linkbid="' + bid + '"][subid="' + subid + '"]').each(function() {
                //     // get the id to see if it is the thing being updated
                //     // var linkedtile = $(this).attr("linkid");
                //     var sibid = $(this).attr("aid");
                //     var sibling = $(this).next();
                //     var dothis = true;

                //     // if we have a match, update the sibling field
                //     if ( sibling && sibling.attr("aid")=== sibid ) {
                //         var value = pvalue[subid];

                //         // replace newlines with breaks for proper html rendering
                //         if ( typeof value==="string" && value.indexOf("\n")!==-1 ) {
                //             value = value.replace(/\n/g, "<br>");
                //         }

                //         // skip objects except single entry arrays
                //         if ( typeof value==="object" || ( typeof value==="string" && value.startsWith("{") ) ) {
                //             dothis = false;
                //         }
                //         if ( dothis ) {
                //             var targetid = "#" + sibling.attr("id");
                //             processKeyVal(targetid, sibid, subid, value);                        
                //         }

                //     }
                // });

                // blank screen if night mode set
                if ( (thetype==="mode" || thetype==="location" ) && 
                     (blackout==="true" || blackout===true) && (priorOpmode === "operate" || priorOpmode === "sleep") ) {

                    // console.log("mode: ", pvalue.themode, " priorMode: ", priorOpmode);
                    if ( pvalue.themode === "Night" ) {
                        execButton("blackout");
                        priorOpmode = "sleep";
                    } else if ( $("#blankme") ) {
                        $("#blankme").off("click");
                        $("#blankme").remove(); 
                        priorOpmode = "operate";
                    }
                    setCookie("opmode", priorOpmode);
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
            // case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case r: h = (g - b) / d; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        // h /= 6;
        h = Math.round(h * 60);
        if ( h < 0 ) {
            h += 360;
        }
    }
    // h = Math.floor(h * 100);
    s = Math.round(s * 100);
    v = Math.round(v * 100);

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
        modalhook = $(modaltag);
        if ( modaltag==="body" || modaltag==="document" || modaltag==="window" ) {
            postype = "absolute";
        } else {
            postype = "relative";
        }
    } else {
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
        $("#"+modalid).focus();
        $("#"+modalid).on("keydown",function(e) {
            if ( e.which===13 ) {
                if ( responsefunction ) {
                    responsefunction(this, modaldata);
                }
                closeModal(modalid);
            }
        });

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
        var subid = "color";
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
                // console.log("color = " + hexval+" hsl = "+hslstr);
                var tile = '#t-'+aid;
                var bid = $(tile).attr("bid");
                var hubid = $(tile).attr("hub");
                var hubindex = $(tile).attr("hubindex");
                var thetype = $(tile).attr("type");
                var userid = cm_Globals.options.userid;
                var thingid = $(tile).attr("thingid");
                var tileid = $(tile).attr("tile");
                var hint = $(tile).attr("hint");
                var pname = $("#showversion span#infoname").html();

                var usertile =  $("#sb-"+aid+"-"+subid);
                var command = "";
                var linktype = thetype;
                var linkval = "";
                var linkbid = bid;
                var linkhub = hubindex;
                var realsubid = subid;
    
                if ( usertile && usertile.attr("command") ) {
                    command = usertile.attr("command");    // command type
                    linkval = usertile.attr("linkval");
                    linkbid = usertile.attr("linkbid");
                    linkhub = usertile.attr("linkhub");
                    linktype = usertile.attr("linktype");
                    realsubid = usertile.attr("subid");
                }
                if ( typeof linkval === "string" && 
                     (linkval.startsWith("GET::") || linkval.startsWith("POST::") || 
                      linkval.startsWith("PUT::") || linkval.startsWith("LINK::") || 
                      linkval.startsWith("RULE::") || linkval.startsWith("URL::")) )
                {
                    var jcolon = linkval.indexOf("::");
                    // command = linkval.substr(0, jcolon);
                    command = linkval.substring(0, jcolon);
                    // linkval = linkval.substr(jcolon+2);
                    linkval = linkval.substring(jcolon+2);
                } else {
                    command = "";
                    linkval = "";
                }
                console.log("setupColors doaction: id: ", linkbid, " type: ", linktype, " value: ", hslstr, " hex: ", hexval, " hubid: ", linkhub);
                $.post(cm_Globals.returnURL, 
                       {useajax: "doaction", userid: userid, pname: pname, id: linkbid, thingid: thingid, type: linktype, value: hslstr, hint: hint,
                        subid: realsubid, attr: hexval, hubid: hubid, hubindex: linkhub, tileid: tileid, command: command, linkval: linkval} );
            }
        });
    });

}

function setupSliders() {

    function hpsliders(evt, ui) {
        var thing = $(evt.target);
        thing.attr("value",ui.value);
        
        var aid = thing.attr("aid");
        var tile = '#t-'+aid;
        var bid = $(tile).attr("bid");
        var hubid = $(tile).attr("hub");
        var hubindex = $(tile).attr("hubindex");
        var subid = thing.attr("subid");
        var thevalue = parseInt(ui.value);
        var thetype = $(tile).attr("type");
        var userid = cm_Globals.options.userid;
        var thingid = $(tile).attr("thingid");
        var tileid = $(tile).attr("tile");
        var hint = $(tile).attr("hint");
        var pname = $("#showversion span#infoname").html();
        
        var usertile =  $("#sb-"+aid+"-"+subid);
        var command = "";
        var linktype = thetype;
        var linkval = thevalue;
        var linkbid = bid;
        var realsubid = subid;
        var linkhub = hubindex;
        var linkid = 0;

        if ( usertile && usertile.attr("command") ) {
            command = usertile.attr("command");    // command type
            linkval = usertile.attr("linkval");
            linkbid = usertile.attr("linkbid");
            linkhub = usertile.attr("linkhub");
            linktype = usertile.attr("linktype");
            realsubid = usertile.attr("subid");
            linkid = usertile.attr("linkid");
            hint = usertile.attr("hint");
        }

        if ( typeof linkval === "string" && 
            (linkval.startsWith("GET::") || linkval.startsWith("POST::") || 
             linkval.startsWith("PUT::") || 
             linkval.startsWith("RULE::") || linkval.startsWith("URL::")) )
        {
            var jcolon = linkval.indexOf("::");
            command = linkval.substr(0, jcolon);
            linkval = linkval.substr(jcolon+2);
        // } else {
        //     command = "";
        //     linkval = "";
        }

        console.log("Slider action: command= ", command, " bid= ", bid, " linkbid= ", linkbid, " linkid= ", linkid, " hub= ", linkhub, " type= ", linktype, " subid= ", realsubid, " hint= ", hint, " value= ", thevalue, " linkval= ", linkval);
        $.post(cm_Globals.returnURL, 
            {useajax: "doaction", userid: userid, pname: pname, id: linkbid, thingid: thingid, type: linktype, value: thevalue, attr: subid, hint: hint,
            subid: realsubid, hubid: hubid, hubindex: linkhub, tileid: tileid, command: command, linkval: linkval},
            function(presult, pstatus) {
                if (pstatus==="success") {
                    if ( presult && presult.startsWith("error") ) {
                        console.error(">>>> error adjusting a slider: ", presult);
                    }
                }
            }, "json"
        );
    }

    
    $("div.overlay.level >div.level, div.overlay.onlevel >div.onlevel, div.overlay.volume >div.volume, div.overlay.groupVolume >div.groupVolume, div.overlay.position >div.position").slider({
        orientation: "horizontal",
        min: 0,
        max: 100,
        step: 5,
        stop: function( evt, ui) {
            hpsliders(evt, ui);
        }
    });

    // set the initial slider values
    $("div.overlay.level >div.level, div.overlay.onlevel >div.onlevel, div.overlay.volume >div.volume, div.overlay.groupVolume >div.groupVolume, div.overlay.position >div.position").each( function(){
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
            hpsliders(evt, ui);
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
            var pname = $("#showversion span#infoname").html();
            // console.log("reordering " + k + " rooms: ", pages);
            $.post(cm_Globals.returnURL, 
                {useajax: "setorder", userid: userid, pname: pname, id: "none", type: "rooms", value: pages},
                function (presult, pstatus) {
                    if (pstatus==="success" ) {
                        console.log( "setorder POST returned: ", presult );
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
            var pname = $("#showversion span#infoname").html();
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

                $.post(cm_Globals.returnURL, 
                    {useajax: "setorder", userid: userid, pname: pname, id: "none", type: "things", value: tilenums, hubid: hubid, roomid: roomid},
                    function (presult, pstatus) {
                        if (pstatus==="success" ) {
                            console.log("setorder POST returned: ", presult );
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
            },
            stop: function(evt, ui) {
                // var thing = ui.draggable;
                // console.log("Stopped dragging: ", $(evt.target).attr("type") );
            },
            grid: snapgrid
        });
    }
    
    // enable filters and other stuff if successful
    function xhrdone() {
        
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
                var pname = $("#showversion span#infoname").html();
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
                            // var lastthing = $("div.panel-"+panel+" div.thing").last();
                            var roomid = $("#panel-"+panel).attr("roomid");
                            var pname = $("#showversion span#infoname").html();
                            pos = {position: "absolute", top: evt.pageY, left: evt.pageX, width: 300, height: "auto"};
                            var zmax = getMaxZindex(panel);
                            startPos["z-index"] = zmax;
                            createModal("modaladd","Add: "+ thingname + " of Type: "+thingtype+" to Room: "+panel+"?<br /><br />Are you sure?", "body", true, pos, function(ui, content) {
                                var clk = $(ui).attr("name");
                                if ( clk==="okay" ) {
                                    // add it to the system
                                    // the ajax call must return a valid "div" block for the dragged new thing
                                    $.post(cm_Globals.returnURL, 
                                        {useajax: "addthing", userid: userid, pname: pname, id: bid, type: thingtype, value: panel, panelid: panelid, 
                                                              attr: startPos, hubid: hubid, hubindex: hubindex, roomid: roomid, pname: pname},
                                        function (presult, pstatus) {
                                            if (pstatus==="success" && !presult.startsWith("error") ) {
                                                console.log( "Added " + thingname + " of type " + thingtype + " and bid= " + bid + " to room " + panel, " pos: ", startPos, " thing: ", presult);
                                                $("div.panel-"+panel).append(presult);
                                                var newthing = $("div.panel-"+panel+" div.thing").last();
                                                // lastthing.after(presult);
                                                // var newthing = lastthing.next();
                                                $(newthing).css( startPos );
                                                var snap = $("#mode_Snap").prop("checked");
                                                thingDraggable( newthing, snap, panel );
                                                setupPage();
                                                setupSliders();
                                                setupColors();
                                                addEditLink();
                                            } else {
                                                console.log("error attempting to add a tile. pstatus: ", pstatus, " presult: ", presult);
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
                        $.post(cm_Globals.returnURL, 
                               {useajax: "setposition", userid: cm_Globals.options.userid, pname: pname, id: bid, type: thingtype, value: panel, attr: startPos, tileid: tile, hubid: hubid, thingid: thingid, roomid: roomid},
                               function (presult, pstatus) {
                                // check for an object returned which should be a promise object
                                if (pstatus==="success" && ( typeof presult==="object" || (typeof presult === "string" && !presult.startsWith("error"))) ) {
                                    console.log("setposition presult: ", presult );
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
                var pname = $("#showversion span#infoname").html();

                createModal("modaladd","Remove: "+ tilename + " (thing # " + thingid + ") of type: "+thingtype+" from room "+panel+"? Are you sure?", "body" , true, pos, function(ui, content) {
                    var clk = $(ui).attr("name");
                    if ( clk==="okay" ) {
                        $.post(cm_Globals.returnURL, 
                            {useajax: "delthing", userid: cm_Globals.options.userid, id: bid, type: thingtype, value: panel, 
                                                  attr: "", hubid: hubid, tileid: tile, thingid: thingid, roomid: roomid, pname: pname},
                            function (presult, pstatus) {
                                // check for an object returned which should be a promise object
                                if (pstatus==="success" && ( typeof presult==="object" || (typeof presult === "string" && !presult.startsWith("error"))) ) {
                                    console.log( "Removed tile #" + tile + " thingid: ", thingid, " name: ", tilename, " from page: ", panel);
                                    $(thing).remove();
                                } else {
                                    console.log("error attempting to remove a tile. pstatus: ", pstatus, " presult: ", presult);
                                }
                            }
                        );

                    // this isn't a clone so we have to revert to original place
                    } else {
                        startPos.position = startPos.priorStart;
                        relocateTile(thing, startPos);
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
        console.log("error - Tile reposition error: ", e); 
    }

}

// make the post call back to main server
function dynoPost(ajaxcall, body, callback) {
    var isreload = false;
    var pname;
    if ( body && body.pname ) {
        pname = body.pname;
    } else {
        var target = $("#showversion span#infoname");
        if ( target && target.html() ) {
            pname = target.html();
        } else {
            pname = "default";
        }
    }

    // if body is not given or is not an object then use all other values
    // to set the object to pass to post call with last one being a reload flag
    if ( typeof body === "object" ) { 
        body["api"] = ajaxcall;
        body.pname = pname;
        if ( body.reload ) {
            isreload = true;
        }
    } else {
        body = {api: ajaxcall, userid: cm_Globals.options.userid, pname: pname};
    }

    if ( callback && typeof callback==="function" ) {
        $.post(cm_Globals.returnURL, body, callback);

    } else {
        $.post(cm_Globals.returnURL, body,
            function (presult, pstatus) {
                if ( isreload ) {
                    window.location.href = cm_Globals.returnURL;
                }

                // clear blinking interval if requested
                else if ( typeof presult === "object" && presult.blink ) {
                    clearInterval(presult.blink);
                }
            }
        );
    }
}

function execForgotPassword() {

    var genobj = formToObject("loginform");
    var emailname = genobj.emailid;
    var mobile = genobj.mobile;
    if ( emailname.length < 5 ) {
        alert("Enter a valid email or mobile phone number before requesting a reset. You will be sent a txt message.");
    } else {
        // alert(emailname);
        $.post(cm_Globals.returnURL, 
            {useajax: "forgotpw", email: emailname, mobile: mobile}, 
            function(presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult === "object" && presult.id ) {
                    var pstyle = "position: absolute; border: 6px black solid; background-color: green; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 100px; padding-top: 50px; text-align: center;";
                    var pos = {style: pstyle};
                    var userid = presult.id;
                    // console.log("user: ", presult);
                    createModal("loginfo","Login reset code sent via txt message.<br>On the next screen please provide that code <br>along with the new password information.<br>", "body", "Done", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL + "/forgotpw?userid="+userid;
                    });
                    // setTimeout(function() {
                    //     closeModal("loginfo");
                    //     window.location.href = cm_Globals.returnURL;
                    // },60000);
                } else {
                    // console.log("presult = ", presult);
                    alert("There was a problem attempting to reset your password.");
                    window.location.href = cm_Globals.returnURL;
                }
            }
        );
    }

}

function execCreateUser() {

    var genobj = formToObject("newuserform");
    var emailname = genobj.newemailid;
    var mobile = genobj.newmobile;
    var username = genobj.newuname;
    var newpw = genobj.newpword;
    var newpw2 = genobj.newpword2;

    if ( newpw.length < 6 ) {
        alert("Password provided is too short. Must be 6 or more characters in length");
    } else if ( newpw !== newpw2 ) {
        alert("Passwords do not match. Try again.");
    } else {
        $.post(cm_Globals.returnURL, 
            {useajax: "createuser", email: emailname, uname: username, mobile: mobile, pword: newpw}, 
            function(presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult === "object" && presult.id ) {
                    var pstyle = "position: absolute; border: 6px black solid; background-color: green; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 150px; padding-top: 50px; text-align: center;";
                    var pos = {style: pstyle};
                    console.log("new user created: ", presult);
                    var userid = presult.id;
                    createModal("loginfo","New user created. Next, please validate using code <br>sent to mobile: " + mobile+ " to activate this account.<br><br>", "body", "Done", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL + "/activateuser?userid="+userid;
                    });
                } else {
                    pstyle = "position: absolute; border: 6px black solid; background-color: red; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 150px; padding-top: 50px; text-align: center;";
                    pos = {style: pstyle};
                    var errstr = "";
                    if ( typeof presult === "string" ) { errstr = "<br>" + presult; }
                    createModal("loginfo","There was a problem with creating a new user." + errstr + "<br><br>Please try again.", "body", "Okay", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL;
                    });
                }
            }
        );
    }

}

function execValidatePassword() {
    var genobj = formToObject("newpwform");
    var userid = genobj.userid;
    var newpw = genobj.newpword;
    var newpw2 = genobj.newpword2;
    var pname = genobj.pname;
    var panelpw = genobj.panelpword;
    var emailname = genobj.email;
    var uname = genobj.uname;
    // var hpcode = genobj.hpcode;
    var newhpcode = genobj.newhpcode;
    var mobile = genobj.mobile;
    // console.log("genobj: ", genobj);

    if ( newpw.length < 6 ) {
        alert("Password provided is too short. Must be 6 or more characters in length");
    } else if ( newpw !== newpw2 ) {
        alert("Passwords do not match. Try again.");
    // } else if ( hpcode !== newhpcode ) {
    //     alert("Security code is incorrect.");
    } else {
        $.post(cm_Globals.returnURL, 
            {useajax: "updatepassword", userid: userid, email:emailname, mobile:mobile, uname: uname, pword: newpw, pname: pname, panelpw: panelpw, hpcode: newhpcode}, 
            function(presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult === "object" ) {
                    var pstyle = "position: absolute; border: 6px black solid; background-color: green; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 150px; padding-top: 50px; text-align: center;";
                    var pos = {style: pstyle};
                    createModal("loginfo","User and panel passwords updated successfully.<br>Please log in with the new credentials.<br>email = " + emailname+ "<br><br>", "body", "Done", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL;
                    });
                    // setTimeout(function() {
                    //     closeModal("loginfo");
                    //     window.location.href = cm_Globals.returnURL;
                    // },60000);
                } else {
                    pstyle = "position: absolute; border: 6px black solid; background-color: red; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 150px; padding-top: 50px; text-align: center;";
                    pos = {style: pstyle};
                    var errstr = "";
                    if ( typeof presult === "string" ) { errstr = "<br>" + presult; }
                    createModal("loginfo","There was a problem with updating a new password." + errstr + "<br><br>Please try again.", "body", "Okay", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL;
                    });
                }
            }
        );
    }
}

function execValidateUser() {
    var genobj = formToObject("validateuserpage");
    var userid = genobj.userid;
    var emailname = genobj.email;
    var mobile = genobj.mobile;
    // var hpcode = genobj.hpcode;
    var newhpcode = genobj.newhpcode;
    // console.log("validateUser genobj: ", genobj);

    // if ( hpcode !== newhpcode ) {
    //     alert("Security code is incorrect.");
    // } else {
        $.post(cm_Globals.returnURL, 
            {useajax: "validateuser", userid: userid, email:emailname, mobile:mobile, hpcode: newhpcode}, 
            function(presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult === "object" ) {
                    var pstyle = "position: absolute; border: 6px black solid; background-color: green; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 150px; padding-top: 50px; text-align: center;";
                    var pos = {style: pstyle};
                    createModal("loginfo","User with email: " + emailname + " successfully validated. <br><br>", "body", "Done", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL;
                    });
                } else {
                    pstyle = "position: absolute; border: 6px black solid; background-color: red; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 150px; padding-top: 50px; text-align: center;";
                    pos = {style: pstyle};
                    var errstr = "";
                    if ( typeof presult === "string" ) { errstr = "<br>" + presult; }
                    createModal("loginfo","There was a problem with updating a new password." + errstr + "<br><br>Please try again.", "body", "Okay", pos, function(ui) {
                        window.location.href = cm_Globals.returnURL;
                    });
                }
            }
        );
    // }
}

function execButton(buttonid) {

    if ( buttonid==="optSave") {
        // first save our filters
        // if ( !checkInputs() ) { return; }

        var fobj = formToObject("filteroptions");
        var oobj = formToObject("optionspage");

        try {
            dynoPost("filteroptions", fobj, function(presult, pstatus) {
                dynoPost("saveoptions", oobj, function(presult, pstatus) {
                    if ( pstatus!=="success" ) {
                        console.log(pstatus, " result: ", presult, " optionsobj: ", oobj);
                        alert("Options page failed to save properly");
                    }
                    window.location.href = cm_Globals.returnURL;
                });
            });
        } catch (e) {
            console.log("Options page failed to save properly", e);
            alert("Options page failed to save properly");
            window.location.href = cm_Globals.returnURL;
        }

    } else if ( buttonid==="optCancel" ) {
        // do nothing but reload the main page
        window.location.href = cm_Globals.returnURL;

    } else if ( buttonid==="optReset" ) {
        // reset the forms on the options page to their starting values
        $("#optionspage")[0].reset();
        $("#filteroptions")[0].reset();

    } else if ( buttonid==="createuser" ) {
        execCreateUser();

    } else if ( buttonid==="newuservalidate" ) {
        execValidateUser();

    } else if ( buttonid==="newpassword") {
        execValidatePassword();

    } else if ( buttonid==="dologin") {

        if ( !checkLogin() ) { return; }

        var genobj = formToObject("loginform");

        dynoPost("dologin", genobj, function(presult, pstatus) {
            if ( pstatus === "success" && presult && typeof presult === "object" ) {
                console.log("login successful for user: ",  presult["users_email"], " and panel: ", presult["panels_pname"]);
                var pstyle = "position: absolute; border: 6px black solid; background-color: blue; color: white; font-weight: bold; font-size: 24px; left: 560px; top: 220px; width: 600px; height: 220px; padding-top: 20px;";
                var pos = {style: pstyle};
                createModal("loginfo","User Email: " + presult["users_email"] + "<br>Username: " + presult["users_uname"] + "<br>Logged into panel: " + presult["panels_pname"] + "<br>With skin: " + presult["panels_skin"] + "<br><br>Proceed? ", 
                    "body", true, pos, function(ui) {
                        var clk = $(ui).attr("name");
                        if ( clk==="okay" ) {
                            window.location.href = cm_Globals.returnURL;
                        }
                    });
                // window.location.href = cm_Globals.returnURL;
            } else {
                console.log("not logged in. ", presult);
                var pstyle = "position: absolute; border: 6px black solid; background-color: red; color: white; font-weight: bold; font-size: 24px; left: 560px; top: 220px; width: 600px; height: 180px; padding-top: 50px;";
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
        priorOpmode = "sleep";
        setCookie("opmode", priorOpmode);
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
            var pname = $("#showversion span#infoname").html();
            $.post(cm_Globals.returnURL, 
                {useajax: "getphotos", userid: cm_Globals.options.userid, pname: pname}, 
                function(presult, pstatus) {
                    if ( presult && typeof presult == "object" ) {
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

        // clicking anywhere will restore the window to normal
        $("#blankme").off("click");
        $("#blankme").on("click", function(evt) {
            if ( photohandle ) {
                clearInterval(photohandle);
            }
            $("#blankme").remove(); 
            priorOpmode = "operate";
            setCookie("opmode",priorOpmode);
            evt.stopPropagation();
        });
    } else if ( buttonid === "toggletabs") {
        toggleTabs();
    } else if ( buttonid === "reorder" ) {
        if ( priorOpmode === "edit" ) {
            updateFilters();
            cancelDraggable();
            delEditLink();
        }
        setupSortable();
        setupPagemove();
        $("#mode_Reorder").prop("checked",true);
        priorOpmode = "reorder";
        setCookie("opmode", priorOpmode);
    } else if ( buttonid === "edit" ) {
        if ( priorOpmode === "reorder" ) {
            cancelSortable();
            cancelPagemove();
        }
        setupDraggable();
        addEditLink();
        $("#mode_Edit").prop("checked",true);
        priorOpmode = "edit";
        setCookie("opmode", priorOpmode);
    } else if ( buttonid==="showdoc" ) {
        window.open("https://housepanel.net",'_blank');
        return;
    // } else if ( buttonid==="name" ) {
    //     return;
    } else if ( buttonid==="operate" ) {
        if ( priorOpmode === "reorder" ) {
            cancelSortable();
            cancelPagemove();
            if ( reordered ) {
                window.location.href = cm_Globals.returnURL;
            }
        } else if ( priorOpmode === "edit" ) {
            updateFilters();
            cancelDraggable();
            delEditLink();
        }
        $("#mode_Operate").prop("checked",true);
        priorOpmode = "operate";
        setCookie("opmode", priorOpmode);
    } else if ( buttonid==="snap" ) {
        var snap = $("#mode_Snap").prop("checked");
        // console.log("Tile movement snap mode: ",snap);

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

    // var port = $("input[name='port']").val().trim();
    // var webSocketServerPort = $("input[name='webSocketServerPort']").val().trim();
    var fast_timer = $("input[name='fast_timer']").val().trim();
    var slow_timer = $("input[name='slow_timer']").val().trim();
    // var uname = $("input[name='uname']").val().trim();
    // var pword = $("input[name='pword']").val().trim();

    var errs = {};
    var isgood = true;
    var intre = /^\d{1,6}$/;         // only up to 6 digits allowed
    var unamere = /^\D\S{3,}$/;      // start with a letter and be four long at least
    var pwordre = /^\S{6,}$/;        // start with anything but no white space and at least 6 digits 

    // errs.webSocketServerPort = checkInpval("webSocketServerPort", webSocketServerPort, intre);
    // errs.port = checkInpval("port", port, intre);
    errs.fast_timer = checkInpval("fast_timer", fast_timer, intre);
    errs.slow_timer = checkInpval("slow_timer", slow_timer, intre);
    // errs.uname = checkInpval("username", uname, unamere);
    // errs.pword = pword==="" ? "" : checkInpval("password", pword, pwordre);

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
            }
            evt.stopPropagation();
        });
        
        $("#showversion").on("click", function(e) {
            var username = $("#infoname").html();
            var emailname = $("#emailname").html();
            var pos = {top: 40, left: 820};
            createModal("modalexec","Log out user "+ emailname + " on panel " + username+  " <br/>Are you sure?", "body" , true, pos, function(ui, content) {
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

    } else if ( pagename==="options") {
        setupCustomCount();
        setupFilters();
        var pos = {position: "absolute", top: 100, left: 100, width: 600, height: 120, border: "4px solid"};
        $("#showpanelname").hide();
        $("#userpanel").on("change", function(evt) {
            var panelid = $(this).val();
            if ( panelid === "new" ) {
                $("#showpanelname").show(); // removeClass("hidden");
                $("#panelname").val("");
                // $("#delPanel").html("Add Panel");
                $("#delPanel").hide();
            } else {
                var panelname = $("#userpanel option[value='"+panelid+"']").html();
                $("#showpanelname").hide(); // addClass("hidden");
                $("#panelname").val(panelname);
                // $("#delPanel").html("Delete Panel");
                $("#delPanel").show();
            }
        });
        $("#delPanel").on("click", function(evt) {
            const pname = $("#panelname").val();
            createModal("modalhub","Delete Panel: " + pname + " Are you sure?", "body" , true, pos, function(ui) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    alert("Removing panel: " + pname);
                    $.post(cm_Globals.returnURL, 
                        {useajax: "delpanel", userid: cm_Globals.options.userid, pname: pname}
                    );
                }
            });
        });
        $("#usePanel").on("click", function(evt) {
            const pname = $("#panelname").val();
            createModal("modalhub","Activate and switch to Panel: " + pname + " Are you sure?", "body" , true, pos, function(ui) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    alert("Using panel: " + pname);
                    $.post(cm_Globals.returnURL, 
                        {useajax: "usepanel", userid: cm_Globals.options.userid, pname: pname}
                    );
                }
            });
        });
        $("#delUser").on("click", function(evt) {
            const uname = $("#unameid").val();
            const emailname = $("#emailid").val();
            const userid = cm_Globals.options.userid;
            createModal("modalhub","Remove User #" + userid + " uname: " + uname + " email: " + emailname + " Are you sure?", "body" , true, pos, function(ui) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    alert("Removing user: " + uname + " | " + emailname);
                    $.post(cm_Globals.returnURL, 
                        {useajax: "deluser", userid: cm_Globals.options.userid, uname: uname, email: emailname}
                    );
                }
            });
        });


    } else if ( pagename==="auth" ) {

        $("input[name='csecret']").each(function(i) {
            var funkysecret = $(this).val();
            var target = $(this).parent().parent().find("input[name='clientsecret']")
            $(target).val(funkysecret);
        });

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
            } else {
                $("#newthingcount").html("");
                $("input.hubauth").removeClass("hidden");
                $("input.hubdel").removeClass("hidden");
            }
            $("div.authhub").each(function() {
                if ( !$(this).hasClass("hidden") ) {
                    $(this).addClass("hidden");
                }
            });
            $(target).removeClass("hidden");

            // populate the clientSecret field that could have funky characters
            // if ( hubindex ) {
            //     var funkysecret = $("#csecret_"+hubindex).val();
            //     $(target + " div.fixClientSecret >input").val(funkysecret);
            // }

            evt.stopPropagation(); 
        });

        // set the hub host based on the type
        $("select[name='hubtype']").on('change', function(evt) {
            var hubType = $(this).val();
            var hubindex = $("#pickhub").val();
            var hideid = $("#hideid_"+hubindex);
            var hubTarget = $(this).parent().find("input[name='hubhost']");
            var hubNameTarget = $(this).parent().parent().find("input[name='hubname']");
            if ( hubType==="SmartThings" || hubType==="NewSmartThings" ) {
                hideid.addClass("hidden");
                hubTarget.val("https://api.smartthings.com");
                // hubTarget.prop("disabled", true);
                hubNameTarget.val("SmartThings Home");
                $("#newthingcount").html("Ready to authorize your SmartThings hub via the new API platform.");
            } else if ( hubType==="Sonos" ) {
                hideid.removeClass("hidden");
                hubTarget.val("https://api.sonos.com");
                // hubTarget.prop("disabled", true);
                $(hubNameTarget).val("Sonos");
                $("#newthingcount").html("Ready to authorize your "+hubType+" account. The hub name can be set to anything or the name Sonos will be assigned.");
            } else if ( hubType==="Hubitat" ) {
                hideid.removeClass("hidden");
                hubTarget.val("https://oauth.cloud.hubitat.com");
                hubNameTarget.val("");
                // hubTarget.prop("disabled", false);
                $("#newthingcount").html("Fill out the fields below to authorize your "+hubType+" hub. The hub ID and name will be obtained automatically.");
            } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
                hideid.removeClass("hidden");
                $("#newthingcount").html("Fill out the fields below to authorize your "+hubType+". Be sure to provide a valid App ID");
                hubTarget.val("https://fordconnect.cv.ford.com");
                // hubTarget.prop("disabled", true);
                hubNameTarget.val(hubType);
            } else if ( hubType==="ISY" ) {
                hideid.removeClass("hidden");
                // hubTarget.prop("disabled", false);
                // hubTarget.val("http://192.168.x.x");
                hubNameTarget.val("ISY Home");
            } else {
                hideid.removeClass("hidden");
                // hubTarget.prop("disabled", false);
                hubTarget.val("");
            }
        });

        $("select[name='hubtype']").each( function(i) {
            var hubType = $(this).val();
            var hubindex = $("#pickhub").val();
            var hideid = $("#hideid_"+hubindex);
            var hubTarget = $(this).parent().find("input[name='hubhost']");
            if ( hubType=== "SmartThings" ) {
                hideid.removeClass("hidden");
                // hubTarget.prop("disabled", false);
                hubTarget.val("https://graph.api.smartthings.com");
            } else if ( hubType=== "NewSmartThings" ) {
                hideid.addClass("hidden");
                hubTarget.val("https://api.smartthings.com");
                // hubTarget.prop("disabled", true);
            } else if ( hubType=== "Sonos" ) {
                hideid.addClass("hidden");
                hubTarget.val("https://api.sonos.com");
                // hubTarget.prop("disabled", true);
            } else if ( hubType==="Hubitat" ) {
                hideid.removeClass("hidden");
                hubTarget.val("https://oauth.cloud.hubitat.com");
                // hubTarget.prop("disabled", false);
            } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
                hideid.removeClass("hidden");
                hubTarget.val("https://fordconnect.cv.ford.com");
                // hubTarget.prop("disabled", true);
            } else if ( hubType==="ISY" ) {
                hideid.removeClass("hidden");
                // hubTarget.val("http://192.168.x.x");
                // hubTarget.prop("disabled", false);
            } else {
                hideid.removeClass("hidden");
                hubTarget.val("");
                // hubTarget.prop("disabled", false);
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
            } catch(err) {
                evt.stopPropagation(); 
                alert("Something went wrong when trying to authenticate your hub...\n" + err.message);
                return;
            }
            
            // make an api call and process results
            // some hubs return devices on server and pushes results later
            // others return a request to start an OATH redirection flow
            var pname = $("#showversion span#infoname").html();
            formData["api"] = "hubauth";
            formData.pname = pname;
            $.post(cm_Globals.returnURL, formData,  function(presult, pstatus) {
                // console.log("hubauth: ", presult);
                // alert("wait... presult.action = " + presult.action);

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
                    // else if ( obj.action === "fordoauth" ) {
                    //     var nvpreq = "response_type=code";
                    //     nvpreq = nvpreq + "&make=" + obj.model + "&application_id=" + obj.appId;
                    //     if ( obj.scope ) {
                    //         nvpreq = nvpreq + "&scope=" + encodeURI(obj.scope);
                    //     }
                    //     if ( obj.state ) {
                    //         nvpreq = nvpreq + "&state=" + encodeURI(obj.state);
                    //     }
                    //     nvpreq= nvpreq + "&client_id=" + encodeURI(obj.clientId) + "&redirect_uri=" + encodeURI(obj.url);
                    //     var location = obj.host + "?" + nvpreq;
                    //     // alert("Ready to authorize a " + obj.model + " vehicle redirect to location: " + location);
                    //     window.location.href = location;
                    // }

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
                        }
                        if ( obj.state ) {
                            nvpreq = nvpreq + "&state=" + encodeURI(obj.state);
                        }
                        if ( obj.model ) {
                            nvpreq = nvpreq + "&make=" + obj.model;
                        }
                        if ( obj.appId ) {
                            nvpreq = nvpreq + "&application_id=" + obj.appId;
                        }
                        nvpreq= nvpreq + "&client_id=" + obj.clientId + "&redirect_uri=" + encodeURI(obj.url);
                        // alert("preparing to launch with nvpreq = "+ nvpreq);

                        // navigate over to the server to authorize
                        var location = obj.host + "?" + nvpreq;
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
        
        // this feature works but not on the last hub
        $("input.hubdel").click(function(evt) {
            var hubnum = $(this).attr("hubnum");
            var hubId = $(this).attr("hubid");
            var hubindex = $(this).attr("hubindex");
            var bodytag = "body";
            var pname = $("#showversion span#infoname").html();
            var pos = {position: "absolute", top: 100, left: 100, 
                       width: 600, height: 120, border: "4px solid"};
            // alert("Remove request for hub: " + hubnum + " hubID: " + hubId );

            createModal("modalhub","Remove Hub #" + hubnum + " hubID: " + hubId + "? <br>Are you sure?", bodytag , true, pos, function(ui, content) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    // remove it from the system
                    $.post(cm_Globals.returnURL, 
                        {useajax: "hubdelete", userid: cm_Globals.options.userid, pname: pname, hubid: hubId, id: hubindex},
                        function (presult, pstatus) {
                            if (pstatus==="success" && !presult.startsWith("error")) {
                                $("#newthingcount").html(presult);

                                setTimeout(function() {
                                    var location = cm_Globals.returnURL + "/reauth";
                                    window.location.href = location;
                                }, 3000);

                                // $("#authhub_"+hubindex).remove();
                                // $("#hubopt_"+hubindex).remove();
                                // $("#newthingcount").html(presult);
                            } else {
                                $("#newthingcount").html("error - could not remove hub #" + hubnum + " hub ID: " + hubId);
                                // console.log(presult);
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
        editTile(userid, thingid, pagename, str_type, tile, aid, bid, thingclass, hubid, hubType, customname, strhtml);
    });
    
    $("div.cmzlink").on("click",function(evt) {
        var taid = $(evt.target).attr("aid");
        var thing = "#" + taid;
        var aid = taid.substr(2);
        var pwsib = $(evt.target).siblings("div.overlay.password");
        var userid = cm_Globals.options.userid;
        if ( pwsib && pwsib.length > 0 ) {
            pw = pwsib.children("div.password").html();
            checkPassword(thing, "Tile editing", pw, false, runCustom);
        } else {
            runCustom(thing," ", false);
        }
        function runCustom(thing, name, ro) {
            var str_type = $(thing).attr("type");
            var tile = $(thing).attr("tile");
            var bid = $(thing).attr("bid");
            var hubid = $(thing).attr("hub");
            customizeTile(userid, tile, aid, bid, str_type, hubid);
        }
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
        var pname = $("#showversion span#infoname").html();

        createModal("modaladd","Remove: "+ tilename + " of type: "+thingtype+" from room "+panel+"?<br>Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "delthing", userid: userid, id: bid, type: thingtype, value: panel, 
                                          attr: "", hubid: hubid, tileid: tile, thingid: thingid, roomid: roomid, pname: pname},
                    function (presult, pstatus) {
                        // check for an object returned which should be a promise object
                        if (pstatus==="success" && ( typeof presult==="object" || (typeof presult === "string" && !presult.startsWith("error"))) ) {
                            // console.log( "delthing presult: ", presult );
                            $(thing).remove();
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
        var pname = $("#showversion span#infoname").html();
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
                    {useajax: "pagedelete", userid: cm_Globals.options.userid, id: roomnum, type: "none", value: roomname, roomid: roomid, attr: "none", pname: pname},
                    function (presult, pstatus) {
                        if (pstatus==="success" && !presult.startsWith("error")) {
                            // remove it visually
                            $("li[roomnum="+roomnum+"]").remove();
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
        var roomid = $("#panel-"+roomname).attr("roomid");
        // console.log("editing room: ", roomid, roomnum, roomname);
        editTile(cm_Globals.options.userid, roomid, roomname, "page", roomname, 0, 0, "", 0, "None", roomname);
    });
   
    $("#addpage").off("click");
    $("#addpage").on("click",function(evt) {
        // var clickid = $(evt.target).attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        var panelid = $("input[name='panelid']").val();
        var pname = $("#showversion span#infoname").html();
        createModal("modaladd","Add New Room to HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "pageadd", userid: cm_Globals.options.userid, id: "none", panelid: panelid, pname: pname},
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
    if ( pagename==="options" ) {
        if ( theval ) {
            var roomstr = 'table.roomoptions tr[type="'+theval+'"]';
        } else {
            roomstr = 'table.roomoptions tr';
        }
        $(roomstr).each(function() {
            if ( !theval ) {
                ischecked = $(this).prop("checked");
            }
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
        if ( theval ) {
            var catstr = "#catalog div.thing[type=\""+theval+"\"]";
        } else {
            catstr = "#catalog div.thing";
        }
        $(catstr).each(function(){
            if ( !theval ) {
                ischecked = $(this).prop("checked");
            }

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
    // $('input[name="huboptpick[]"]').each(updateHub);
    $('input[name="useroptions[]"]').each(updateClick);
    
    // upon click update the right rows
    $('input[name="useroptions[]"]').click(updateClick);

    // hub specific filter
    $('input[name="huboptpick"]').click(function() {
        // get the id of the hub type we just picked
        pickedhub = $(this).val();
        cm_Globals.hubId = pickedhub;
        setCookie("defaultHub", cm_Globals.hubId);

        // reset all filters using hub setting
        $('input[name="useroptions[]"]').each(updateClick);
    });

    $("div#thingfilters").click(function() {
        var filter = $("#filterup");
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
        
        // turn on the custom check box
        var custombox = $("input[name='useroptions[]'][value='" + stype + "']");
        if ( custombox ) {
            custombox.prop("checked",true);
            custombox.attr("checked",true);
        };
        
        // show the items of this type
        showType(true, stype, "-1"); // cm_Globals.hubId);
        
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
function updateTile(aid, presult) {

    // if ( !presult.time ) {
    //     console.log(">>>> presult: ", presult);
    // }
    // do something for each tile item returned by ajax call
    var isclock = false;
    
    // handle audio devices
    if ( presult["audioTrackData"] ) {
        var oldtrack = "";
        if ( $("#a-"+aid+"-trackDescription") ) {
            oldtrack = $("#a-"+aid+"-trackDescription").html();
        }
        if ( typeof presult["audioTrackData"] === "string" ) {
            var audiodata = JSON.parse(presult["audioTrackData"]);
        } else {
            audiodata = presult["audioTrackData"];
        }
        presult["trackDescription"] = audiodata["title"] || "None";
        presult["currentArtist"] = audiodata["artist"] || "";
        presult["currentAlbum"] = audiodata["album"] || "";
        presult["trackImage"] = audiodata["albumArtUrl"] || "";
        presult["mediaSource"] = audiodata["mediaSource"] || "";
        delete presult["audioTrackData"];
    }

    // change the key names for the legacy audio items
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
    
    // var dupcheck = {};
    // var swid = $("#t-"+aid).attr("bid");
    // var tileid = $("#t-"+aid).attr("tile");
    var bid = $("#t-"+aid).attr("bid");
    // $.each( presult, function( key, value ) {
    for (var key in presult) {
        var value = presult[key];
        var targetid = '#a-'+aid+'-'+key;
        var dothis = $(targetid);
        
        // replace newlines with breaks for proper html rendering
        if ( typeof value==="string" && value.indexOf("\n")!==-1 ) {
            value = value.replace(/\n/g, "<br>");
        }

        // skip objects except single entry arrays
        if ( dothis && ( typeof value==="object" || ( typeof value==="string" && value.startsWith("{") ) ) ) {
            dothis = false;
        }

        // only take action if this key is found in this tile
        if ( dothis ) {

            // push to this tile
            isclock = processKeyVal(targetid, aid, key, value);

            // push to all tiles that link to this item
            // we use bid to find linked tiles so the tile doesn't have to be on the screen for link to update
            var items = $('div.panel div[command="LINK"][linkbid="' + bid + '"][subid="' + key + '"]');
            // var items = $("div.user_hidden[command='LINK'][subid='"+key+"'][linkid='"+tileid+"']");

            if (items) {
                items.each( function(itemindex) {
                    var sibid = $(this).attr("aid");
                    var sibling = $(this).next();
                    if ( sibling.hasClass("arrow-dn") ) {
                        sibling = sibling.next();
                    }
                    if ( sibling && sibling.attr("aid")=== sibid ) {
                        // var linkaid = $(this).attr("aid");
                        // var linktargetid = '#a-'+linkaid+'-'+key;
                        var linkkey = sibling.attr("subid");
                        var linktargetid = "#" + sibling.attr("id");
                        isclock = isclock || processKeyVal(linktargetid, sibid, linkkey, value);
                    }
                });
            }
        }
    }
    
    // if we updated a clock skin render it on the page
    if ( isclock ) {
        CoolClock.findAndCreateClocks();
    }
}

function processKeyVal(targetid, aid, key, value) {

    // fix images to use width and height if custom items are in this tile
    // handle native track images - including audio devices above
    var oldvalue = $(targetid).html();
    var oldclass = $(targetid).attr("class");
    var isclock = false;

    // swap out blanks from old value and value
    if ( oldvalue && typeof oldvalue === "string" ) {
        oldvalue = oldvalue.trim();
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
    if ( key.startsWith("battery") ) {
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
            iconimg = "media/Weather/" + iconstr + ".png";
        }
        value = "<img src=\"" + iconimg + "\" alt=\"" + iconstr + "\" width=\"80\" height=\"80\">";
    } else if ( (key === "level" || key=== "onlevel" || key === "colorTemperature" || key==="volume" || key==="groupVolume" || key==="position") && $(targetid).slider ) {
        $(targetid).slider("value", value);
        $(targetid).attr("value",value);
        value = false;
        oldvalue = false;

    // handle button fields that are input values
    } else if ( key==="pushed" || key==="held" || key==="released" || key==="doubleTapped") {
        value = "<input type=\"number\" size=\"3\" min=\"1\" max=\"20\" class=\"buttonval\" value=\"" + value + "\">";
        // console.log(">>>> key: ", key, " button value: ", value, " targetid: ", targetid);

    // we now make color values work by setting the mini colors circle
    } else if ( key==="color") {
        $(targetid).html(value);
        $(targetid).attr("value", value);
        $(targetid).minicolors('value', {color: value});
        value = false;
        oldvalue = false;

    // special case for numbers for KuKu Harmony things
    } else if ( key.startsWith("_number_") && value.startsWith("number_") ) {
        value = value.substring(7);

    } else if ( key === "skin" && value.startsWith("CoolClock") ) {
        value = '<canvas id="clock_' + aid + '" class="' + value + '"></canvas>';
        isclock = ( oldvalue !== value );
    
    // handle updating album art info
    } else if ( key ==="trackImage" && value.startsWith("http") ) {
        var trackImage = value;
        if ( $("#a-"+aid+"-width") &&  $("#a-"+aid+"-width").html() && $("#a-"+aid+"-height") && $("#a-"+aid+"-height").html() ) {
            var wstr = " class='trackImage' width='" + $("#a-"+aid+"-width").html() + "' height= '" + $("#a-"+aid+"-height").html() + "' ";
        } else {
            wstr = " class='trackImage' width='120px' height='120px' ";
        }
        // alert("aid= " + aid + " image width info: " + wstr );
        value = "<img" + wstr + "src='" + trackImage + "'>";

    } else if ( key === "trackDescription" ) {
        if ( !oldvalue ) { 
            oldvalue = "None" ;
        }
        // this is the same as fixTrack in php code
        if ( !value || value==="None" ) {
            value = "None";
            try {
                $("#a-"+aid+"-currentArtist").html("");
                $("#a-"+aid+"-currentAlbum").html("");
                $("#a-"+aid+"-trackImage").html("");
            } catch (err) { }
        } 

    // add status of things to the class and remove old status
    } else if ( oldvalue && extra && 
            key!=="name" && key!=="trackImage" && 
            key!=="trackDescription" && key!=="mediaSource" &&
            key!=="currentArtist" && key!=="currentAlbum" &&
            $.isNumeric(extra)===false && 
            $.isNumeric(oldvalue)===false &&
            $(targetid).hasClass(oldvalue) ) 
    {
        if ( key !== oldvalue ) {
            $(targetid).removeClass(oldvalue);
        }
        $(targetid).addClass(extra);
    }

    // update the content 
    if (oldvalue || value) {
        try {
            $(targetid).html(value);
        } catch (err) {}
    }
    return isclock;
}

function refreshTile(aid, bid, thetype, hubid) {
    var pname = $("#showversion span#infoname").html();
    $.post(cm_Globals.returnURL, 
        {useajax: "doquery", userid: cm_Globals.options.userid, pname: pname, id: bid, type: thetype, value: "none", attr: "none", hubid: hubid} );
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

function getFormattedTime(fmttime, tz) {
    var old = new Date();
    var utc = old.getTime() + (old.getTimezoneOffset() * 60000);
    var d = new Date(utc - (60000*tz));        
    // d = new Date();

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

function clockUpdater(whichclock, forceget) {

    if ( whichclock !=="clockdigital" && whichclock !=="clockanalog" ) {
        return;
    }

    // console.log(">>>> clockUpdater, options: ", cm_Globals.options);

    // get the global clock devices if not previously set
    if ( cm_Globals[whichclock] && !forceget ) {
        updateClock(whichclock, cm_Globals[whichclock]);

    } else if ( forceget && cm_Globals.options && cm_Globals.options.rules ) {

        var tile = $("div.panel div.thing[bid='"+whichclock+"']");
        if ( tile ) {
            var thingid = $(tile).attr("thingid");
            var tileid = $(tile).attr("tile");
        } else {
            return;
        }
    
        var userid = cm_Globals.options.userid;
        if ( !userid ) { userid = 1; }
        var pname = $("#showversion span#infoname").html();
        if ( !pname ) { pname = "default"; }

        // make a mini configoptions object for just clocks
        var clockoptions = [];
        var opt1 = {userid: userid, configkey: "user_clockdigital", configval: cm_Globals.options.rules["user_clockdigital"]};
        var opt2 = {userid: userid, configkey: "user_clockanalog", configval: cm_Globals.options.rules["user_clockanalog"]};
        clockoptions.push(opt1);
        clockoptions.push(opt2);

        // console.log(">>>> force getting clock: ", cm_Globals.returnURL, whichclock, userid, pname, thingid, tileid);
        $.post(cm_Globals.returnURL, 
            {useajax: "getclock", userid: userid, pname: pname, id: whichclock, thingid: thingid, tileid: tileid, type: "clock", attr: clockoptions},
            function (presult, pstatus) {
                // console.log(">>>> forceget results: ", pstatus, presult);
                if ( pstatus==="success" && presult && typeof presult==="object" ) {
                    cm_Globals[whichclock] = presult;
                    updateClock(whichclock, cm_Globals[whichclock]);
                }
            }, "json"
        );
    }

    function updateClock(clocktype, clockdevice) {
        clockdevice.time = getFormattedTime(clockdevice.fmt_time, clockdevice.tzone);

        // only update the time elements
        var updobj = {time: clockdevice.time, date: clockdevice.date, weekday: clockdevice.weekday};

        // first update all the clock tiles
        $('div.panel div.thing[bid="'+clocktype+'"]').each(function() {
            var aid = $(this).attr("aid");
            if ( aid ) {
                updateTile(aid, updobj);
            }
        });
    }

}

function setupTimer(timertype, timerval, hubid) {

    // we now pass the unique hubId value instead of numerical hub
    // since the number can now change when new hubs are added and deleted
    var pname = $("#showversion span#infoname").html();
    var updarray = [timertype, timerval, hubid];
    updarray.myMethod = function() {

        var that = this;
        // console.log("hub #" + that[2] + " timer = " + that[1] + " timertype = " + that[0] + " priorOpmode= " + priorOpmode + " modalStatus= " + modalStatus);
        var err;

        if ( priorOpmode === "operate" && modalStatus === 0 ) {

            try {
                // just do the post and nothing else since the post call pushClient to refresh the tiles
                var thingid = that[0];
                $.post(cm_Globals.returnURL, 
                    {useajax: "doquery", userid: cm_Globals.options.userid, pname: pname, thingid: thingid, hubid: that[2]},
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
             ( subid==="groupVolume" ) || 
             ( subid==="colorTemperature" ) ||
             ( subid==="position" ) || 
             ( id && id.startsWith("s-") ) ) {
            return;
        }
        
        // var tile = '#t-'+aid;
        var thetype = $(that).attr("type");
        var thingname = $("#s-"+aid).html();
        
        // handle special control type tiles that perform javascript actions
        // if we are not in operate mode only do this if click is on operate
        if ( thetype==="control" && (priorOpmode==="operate" || subid==="operate") ) {
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
        if ( priorOpmode!=="operate" ) {
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
        if ( pw && typeof pw === "string" && pw!=="false" ) {
            checkPassword(that, thingname, pw, ro, processClick);
        } else {
            processClick(that, thingname, ro);
        }
        evt.stopPropagation();

    });
   
}

function checkPassword(tile, thingname, pw, ro, yesaction) {

    var userpw = "";
    var tpos = $(tile).offset();
    var ttop = (tpos.top > 95) ? tpos.top - 90 : 5;
    var pos = {top: ttop, left: tpos.left};
    var pname = $("#showversion span#infoname").html();
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
                yesaction(tile, thingname, ro);
            } else {
                userpw = $("#userpw").val();
                $.post(cm_Globals.returnURL, 
                    {useajax: "pwhash", userid: cm_Globals.options.userid, pname: pname, id: "none", type: "verify", value: userpw, attr: pw},
                    function (presult, pstatus) {
                        if ( pstatus==="success" && presult==="success" ) {
                            // console.log("Protected tile [" + thingname + "] access granted.");
                            yesaction(tile, thingname, ro);
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
function processClick(that, thingname, ro) {
    var aid = $(that).attr("aid");
    var theattr = $(that).attr("class");
    var subid = $(that).attr("subid");
    var realsubid = subid;
    var tile = '#t-'+aid;
    var thetype = $(tile).attr("type");
    var linktype = thetype;
    var linkval = "";
    var command = "";
    var bid = $(tile).attr("bid");
    var linkbid = bid;
    var hubid = $(tile).attr("hub");
    var linkhub = $(tile).attr("hubindex");
    var userid = cm_Globals.options.userid;
    var thingid = $(tile).attr("thingid");
    var tileid = $(tile).attr("tile");
    var hubtype = $(tile).attr('hubtype') || "";
    var pname = $("#showversion span#infoname").html();
    var targetid;
    if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
        var slen = subid.length;
        targetid = '#a-'+aid+'-'+subid.substring(0,slen-3);
    } else {
        targetid = '#a-'+aid+'-'+subid;
    }

    var thevalue = $(targetid).html();

    // if this is an edit field then do nothing
    if ( thevalue && typeof thevalue==="string" && (thevalue.startsWith("<input type=\"text\"") || thevalue.startsWith("<input type=\"number\"") ) ) {
        return;
    }

    // if any button edit field is clicked on do nothing since user is editing
    // if ( subid === "pushed" || subid==="released" || subid==="held" || subid==="doubleTapped" ) {
    //     return;
    // }

    // set attr to name for ISY hubs
    if ( thetype === "isy" ) {
        theattr = $("#a-"+aid+"-name").html();
    }
    var hint = $(tile).attr("hint");

    // all hubs now use the same doaction call name
    const ajaxcall = "doaction";

    // special case of thermostat clicking on things without values
    // send the temperature as the value
    if ( !thevalue && (thetype=="thermostat" || thetype==="isy") && ($("#a-"+aid+"-temperature")!==null) &&
         ( subid.endsWith("-up") || subid.endsWith("-dn") ) ) {
        thevalue = $("#a-"+aid+"-temperature").html();
    }

    // determine if this is a LINK or RULE by checking for sb-aid sibling element
    // this includes setting the bid of the linked tile if needed
    // new logic based on DB version
    var triggersubid = subid;
    if ( subid.endsWith("-dn") || subid.endsWith("up") ) {
        triggersubid = subid.substr(0,subid.length - 3);
    }
    var usertile =  $("#sb-"+aid+"-"+triggersubid);
    var linkval = thevalue;
    var linkid = 0;
    if ( usertile && usertile.attr("linkval") ) {
        command = usertile.attr("command");
        linkval = usertile.attr("linkval");
        linkbid = usertile.attr("linkbid");
        linkhub = usertile.attr("linkhub");
        linktype = usertile.attr("linktype");
        realsubid = usertile.attr("subid");
        if ( subid.endsWith("-dn") || subid.endsWith("up") ) {
            realsubid += subid.substr(subid.length-3);
        }
        linkid = usertile.attr("linkid");
        hint = usertile.attr("hint");
    }
    // console.log("triggersubid = ", triggersubid, " command = ", command, " usertile= ", usertile);

    if ( typeof linkval === "string" && 
         (linkval.startsWith("GET::") || linkval.startsWith("POST::") || linkval.startsWith("TEXT::") ||
          linkval.startsWith("PUT::") || 
          linkval.startsWith("RULE::") || linkval.startsWith("URL::")) )
    {
        var jcolon = linkval.indexOf("::");
        command = linkval.substr(0, jcolon);
        linkval = linkval.substr(jcolon+2);
    } else {
        // command = "";
        linkval = thevalue;
    }
    
    if ( command === "URL" ) {
        var userkey = "user_" + bid;
        for (var key in cm_Globals.options.rules ) {

            if ( key === userkey ) {
                var rules = cm_Globals.options.rules[key];
                rules.forEach(rule => {
                    if ( rule[0]==="URL" && rule[2]===subid ) {
                        var userval = rule[1];
                        try {
                            if ( !userval || !userval.startsWith("http") ) {
                                throw "URL value is empty";
                            }
                            window.open(userval,'_blank');
                        } catch(e) {
                            console.log("user provided URL failed to open: ", e);
                        }
                    }

                });
            }
        }
        return;
    }

    // no longer treat TEXT custom fields as passive since they could be relabeling of action fields which is fine
    // if they are not leaving them as an active hub call does no harm - it just returns false but you loose inspections
    // to compensate for loss of inspection I added any custom field starting with "label" or "text" subid will inspect
    var ispassive = (ro || subid==="custom" || subid==="temperature" || subid==="feelsLike" || subid==="battery" || //  (command==="TEXT" && subid!=="allon" && subid!=="alloff") ||
        subid==="presence" || subid==="motion" || subid==="contact" || subid==="status" || subid==="deviceType" || subid==="localExec" ||
        subid==="time" || subid==="date" || subid==="tzone" || subid==="weekday" || subid==="name" || subid==="skin" ||
        subid==="video" || subid==="frame" || subid=="image" || subid==="blank" || subid.startsWith("event_") || subid==="illuminance" ||
        (command==="TEXT" && subid.startsWith("label")) || (command==="TEXT" && subid.startsWith("text")) ||
        (thetype==="weather" && !subid.startsWith("_")) ||
        (thetype==="ford" && !subid.startsWith("_"))
    );

    // console.log("linkval = ", linkval," command = ", command, " subid: ", subid, " realsubid: ", realsubid, " passive: ", ispassive);

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

        if ( thevalue && (thevalue==="on" || thevalue==="off") ) {
            thevalue = thevalue==="on" ? "off" : "on";
        }
        // console.log(ajaxcall + ": thingname= " + thingname + " command= " + command + " bid= "+bid+" linkbid+ "+linkbid+" linkhub= " + linkhub + " type= " + thetype + " linktype= " + linktype + " subid= " + subid + " value= " + thevalue + " linkval= " + linkval + " attr="+theattr);

        $.post(cm_Globals.returnURL, 
            {useajax: ajaxcall, userid: userid, pname: pname, thingid: thingid, tileid: tileid, id: linkbid, type: linktype, value: thevalue, hint: hint,
                attr: subid, subid: realsubid, hubid: hubid, hubindex: linkhub, command: command, linkval: linkval},
            function(presult, pstatus) {
                if (pstatus==="success") {
                    // console.log( ajaxcall + ": POST returned:", presult );
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

    // process user provided allon or alloff fields that turn all lights and switches on or off
    } else if ( command==="TEXT" && (subid==="allon" || subid==="alloff") ) {
        var panel = $(tile).attr("panel");
        thevalue = addOnoff(targetid, subid, thevalue);
        $('div[panel="' + panel + '"] div.overlay.switch div').each(function() {
            var aid = $(this).attr("aid");
            var tile = '#t-'+aid;
            var thetype = $(tile).attr("type");
            var bid = $(tile).attr("bid");
            var hubid = $(tile).attr("hub");
            var linkhub = $(tile).attr("hubindex");
            var thingid = $(tile).attr("thingid");
            var tileid = $(tile).attr("tile");
            var roomid = $("#panel-"+panel).attr("roomid");
            // var command = "";
            // var linkval = "";
            var val = thevalue;

            // force use of command mode by setting attr to blank
            theattr = "";  // $(this).attr("class");

            // for ISY only process if uom_switch is 100 which means a light
            // and fix use of on/off to DON/DOF
            var uomid = "#a-" + aid + "-uom_switch";
            if ( thetype==="isy" ) {
                if ( $(uomid) && $(uomid).html() !== "100" ) {
                    val = false;
                } else if ( val==="on" ) {
                    val = "DON";
                }
                else if ( val==="off" ) {
                    val = "DOF";
                }
            }
            if ( val ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: ajaxcall, userid: userid, pname: pname, id: bid, thingid: thingid, tileid: tileid, type: thetype, value: val, roomid: roomid, hint: hint,
                     attr: theattr, subid: "switch", hubid: hubid, hubindex: linkhub, command: command, linkval: linkval} );
            }
        });

    } else if ( ispassive ) {
        var msg = "";
        msg += "thingname = " + thingname + "<br>";
        msg += "type = " + thetype + "<br>";
        msg += "hubtype = " + hubtype + "<br>";
        msg += "tileid = " + tileid + "<br>";
        if ( hint && hint !== hubtype ) {
            msg += "hint = "+hint + "<br>";
        }
        msg += "<hr>";
        $('div.overlay > div[aid="'+aid+'"]').each(function() {
            var inspectsubid = $(this).attr("subid");
            var strval = $(this).html();
            if ( strval ) {
                if ( inspectsubid==="battery" ) {
                    var batdiv = $(this).children().attr("style").substr(7);
                    msg += inspectsubid + " = " + batdiv + "<br>";
                } else if ( strval.indexOf("img src") !== -1 ) {
                    msg += inspectsubid + " =  (image)<br>";
                } else if ( inspectsubid==="level" || inspectsubid==="onlevel" || inspectsubid==="colorTemperature" || inspectsubid==="volume" || inspectsubid==="groupVolume" || inspectsubid==="position" ) {
                    msg += inspectsubid + " = " + $(this).children().attr("style").substr(6) + "<br>";
                } else if ( strval.length > 40 ) {
                    msg += inspectsubid + " ... <br>";
                } else {
                    msg += inspectsubid + " = " + $(this).html() + "<br>";
                }
            }
        });
        // console.log("Inspecting passive tile subid: ", subid, " type: ", thetype, " aid: ", aid, " msg: ", msg);
        var offset = $(that).offset();
        var pos = {top: offset.top, left: offset.left, width: "auto", height: "auto", zindex: 998};
        createModal("modalpopup", msg, "body", false, pos);

    } else {
        // invert value for lights since we want them to do opposite of state
        // this isn't needed for ST or HE but I put this here for ISY
        // in ST and HE the inversion is handled in the groovy code on attr
        // and the value is ignored unless attr is blank which it won't be here
        // but for ISY we pass the value directly to the hub so must be right
        // however, I still inverted the ST and HE values to support future update
        // where I might just look at thevalue for these hubs types as it should be
        // the attr action was a terrible workaround put in a much earlier version
        if ( (subid==="switch") && (thevalue==="on" || thevalue==="off")  ) {
            thevalue = thevalue==="on" ? "off" : "on";
            // } else if ( subid==="button" && thevalue==="held" ) {
            //     thevalue = "pushed";
        }

        // we grab the value in the input field to pass to the click routines
        else if ( thetype==="button" && (subid==="_push" || subid==="_hold" || subid=="_doubleTap" || subid==="_release") ) {
            var butmap = {"_push": "pushed", "_hold":"held", "_doubleTap": "doubleTapped", "_release": "released"};
            var findval = butmap[subid];
            thevalue = $(that).parent().parent().find("div[subid='" + findval + "'] > input").val();
            if ( !thevalue ) { thevalue = "1"; }
            // console.log(">>>> button pressed. value = ", thevalue, " findval = ", findval);
            // return;
        }

        // remove isy type check since it could be a link
        else if ( subid==="switch" && (thevalue==="DON" || thevalue==="DOF" )  ) {
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

        // set value to volume for volume triggers
        else if ( subid==="_volumeDown" || subid==="_volumeUp" ) {
            var targetvol = '#a-'+aid+'-volume';
            thevalue = $(targetvol).attr("value");
        }

        console.log("userid= ", userid, " thingid= ", thingid, " tileid= ", tileid, " thingname= ", thingname, " hint= ", hint,
                    " command= ", command, " bid= ", bid, " linkbid= ", linkbid, " linkid= ", linkid, " hub= ", hubid, " linkhub= ", linkhub,
                    " type= ", thetype, " linktype= ", linktype, " subid= ", subid, " value= ", thevalue, 
                    " linkval= ", linkval, " attr=", theattr);

        // create a visual cue that we clicked on this item
        $(targetid).addClass("clicked");
        setTimeout( function(){ $(targetid).removeClass("clicked"); }, 750 );

        // pass the call to main routine
        // if an object is returned then show it in a popup dialog
        // removed this behavior since it is confusing - only do it above for passive tiles
        // values returned from actions are pushed back to GUI from server via pushClient call
        // alert("API call: " + ajaxcall + " bid: " + bid + " type: " + thetype + " value: " + thevalue);

        $.post(cm_Globals.returnURL, 
            {useajax: ajaxcall, userid: userid, pname: pname, id: linkbid, thingid: thingid, type: linktype, value: thevalue, hint: hint,
                attr: theattr, subid: realsubid, hubid: hubid, hubindex: linkhub, tileid: tileid, command: command, linkval: linkval},
            function (presult, pstatus) {
                if (pstatus==="success") {
                    if ( presult && typeof presult === "object" ) {
                        // console.log("Success: ", presult);
                    } else if ( presult && typeof presult === "string" && !presult.startsWith("error") ) {
                        // console.log(presult);
                    } else {
                        console.log("Unrecognized return from POST call. result: ", presult);
                    }
                }
            }, "json"
        );
    } 
}
