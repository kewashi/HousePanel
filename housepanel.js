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
cm_Globals.tabs = true;
cm_Globals.snap = false;
cm_Globals.edited = false;
cm_Globals.reordered = false;
cm_Globals.hubs =  {};

var modalStatus = 0;
var modalWindows = {};
var priorOpmode = "Operate";
var pagename = "main";

// set a global socket variable to manage two-way handshake
// var webSocketUrl = null;
// var wsinterval = null;

// set this global variable to true to disable actions
// I use this for testing the look and feel on a public hosting location
// this way the app can be installed but won't control my home
// end-users are welcome to use this but it is intended for development only
// use the timers options to turn off polling
cm_Globals.disablepub = false;
cm_Globals.logwebsocket = false;
cm_Globals.enableclickedit = false;

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

function isNumeric(str) {
    var resp;
    try {
        if ( typeof str === "object") {
            str = str.toString();
        }
        resp = (typeof str === "number") || !isNaN(parseFloat(str));
    } catch (e) {
        resp = false;
    }
    return resp;
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
    if ( typeof obj !== "object" ) {
        return obj;
    }
    return JSON.parse(JSON.stringify(obj));
}

function findHub(hubid, id) {
    var thehub = cm_Globals.hubs[0];
    hubid = hubid.toString();
    cm_Globals.hubs.forEach( function(hub) {
        if ( (!id || id==="id") && hubid === hub["id"].toString() ) {
            thehub = hub;
        } else if ( hubid === hub[id].toString() ) {
            thehub = hub;
        }
    });
    return thehub;
}


// obtain options using an ajax api call
// could probably read Options file instead
// but doing it this way ensure we get what main app sees
function getOptions() {
    var amode = getCookie("opmode");
    priorOpmode = amode === "Sleep" ? amode : "Operate";
    try {
        var userid = $("#userid").val();
        var email = $("#emailid").val();
        var skin = $("#skinid").val();
        var config = $("#configsid").val();
        config = JSON.parse(config);

        // get panel and mode from main screen if it is there
        try {
            var pname = $("#showversion span#infoname").html();
            var modetarget = "div.overlay.themode > div.themode";
            if ( $(modetarget) && typeof $(modetarget).html() !== "undefined" ) {
                var themode = $(modetarget).html().trim();
            } else {
                themode = "Unknown";
            }
        } catch(e) {
            pname = "default";
            themode = "Unknown";
            console.log(e);
        }

        cm_Globals.options = {userid: userid, email: email, skin: skin, config: config, pname: pname, mode: themode, rules: {}};
        if ( cm_Globals.options.config.blackout ) {
            var blackout = cm_Globals.options.config.blackout;
            blackout = (blackout === "true") || (blackout === true) ? true : false;
        } else {
            blackout = false;
        }
        // console.log("Mode:", themode, " blackout: ", blackout);
        // handle black screen
        if ( (priorOpmode === "Sleep" || themode==="Night") && blackout ) {
            priorOpmode = "Sleep";
            execButton("blackout");
        } else {
            priorOpmode = "Operate";
            setCookie("opmode", priorOpmode);
        }

        // set the customization list
        $.post(cm_Globals.returnURL, 
            {useajax: "getoptions", userid: userid, pname: pname, id:"none", type:"none"},
            function (presult, pstatus) {
                if ( pstatus==="success" ) {
                    cm_Globals.options["rules"] = presult;
                } else {
                    console.log("error - failure reading custom options and rules from database for user = " + userid);
                }
            }, "json"
        );
    } catch(e) {
        console.log("error - failure setting up options", e);
        alert("Fatal Error - Cannot display HousePanel because something went wrong in setting up configuration options");
    }
}

// obtain options using an ajax api call
// could probably read Options file instead
// but doing it this way ensure we get what main app sees
function getHubs() {
    try {
        var userid = $("#userid").val();
        var pname = cm_Globals.options.pname;
        var config = cm_Globals.options.config;
        try {
            var fast_timer = parseInt(config.fast_timer, 10) * 1000;
            var slow_timer = parseInt(config.slow_timer, 10) * 1000;
        } catch(e) {
            fast_timer = 0;
            slow_timer = 0;
        }

        // read the hubs
        $.post(cm_Globals.returnURL, 
            {useajax: "gethubs", userid: userid, pname: pname, id:"none", type:"none"},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    cm_Globals.hubs = presult;
                    cm_Globals.hubs.forEach(hub => {
                        // setup all special tiles not tied to hubs to refresh as user given slow rate
                        if ( hub.hubtype === "None" && hub.hubid === "-1" ) {
                            setupTimer("slow", slow_timer, hub);
                        // all other hubs refresh at their token refresh rate or the user given fast rate if quicker
                        } else {
                            // if there is a hubrefresh code that will be used to refresh accesstoken
                            // otherwise the hub devices will just be retrieved from the hub
                            // if set to zero we force a refresh at the user provided fast refresh rate
                            var hubtimer = parseInt(hub.hubtimer, 10) * 1000;
                            if ( hubtimer === 0 || (hubtimer > fast_timer && fast_timer !== 0) ) {
                                hubtimer = fast_timer;
                            }
                            // alert("hub: " + hub.hubtype + " timer: " + hubtimer);
                            setupTimer("hub", hubtimer, hub);
                        }
                    });

                } else {
                    cm_Globals.hubs = {};
                    console.log("error - failure reading hubs from database for user = " + userid);
                }

                setupButtons();

            }, "json"
        );
    } catch(e) {
        console.log("error - failure setting up hubs", e);
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
        cm_Globals.returnURL = "http://localhost:8580";
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
        var tabcount = $("#roomtabs > li.ui-tabs-tab").length;

        $(document).on("keydown",function(e) {
            // console.log("priorOpmode: ", priorOpmode, " modalid: ", modalid, " cnt: ", modalWindows[modalid]);
            if ( priorOpmode === "Modal" ) {
                return;
            }

            if ( e.which===27  ){
                execButton("operate");
            } else if ( e.which >= 65 && e.which <= 90 ) {
                var letter = String.fromCharCode(e.which);
                switch (letter) {
                    case "O":
                        execButton("showoptions");
                        break;
                    case "F":
                        execButton("refreshpage");
                        break;
                    case "H":
                        execButton("userauth");
                        break;
                    case "I":
                        execButton("showid");
                        break;
                    case "T":
                        execButton("toggletabs");
                        break;
                    case "B":
                        execButton("blackout");
                        break;
                    case "S":
                        execButton("snap");
                        break;
                    case "R":
                        execButton("reorder");
                        break;
                    case "E":
                        execButton("edit");
                        break;
                    case "P":
                        execButton("operate");
                        break;
                    case "D":
                        execButton("showdoc");
                        break;
                    case "L":
                        execButton("rehome");
                        break;
                    default:
                        console.log("pressed letter: ", letter, " code: ", e.which);
                }
            }
        });

        $("div#hpmenu").on("tap", function(evt) {
            var pos = {top: 40, left: 10};
            evt.stopPropagation();

            var mc = '<div class="menubar">Main Menu</div>';
            mc +='<div id="m_showoptions" class="menuitem">Options</div>';
            mc +='<div id="m_refreshpage" class="menuitem">reFresh</div>';
            mc +='<div id="m_userauth" class="menuitem">Hub auth</div>';
            mc +='<div id="m_showid" class="menuitem">show Info</div>';
            var tabstr = cm_Globals.tabs ? "hide Tabs" : "show Tabs";
            mc +='<div id="m_toggletabs" class="menuitem">' + tabstr + '</div>';
            mc +='<div id="m_blackout" class="menuitem">Blackout</div>';
            var snapstr = cm_Globals.snap ? "unset Snap" : "set Snap";
            mc +='<div id="m_snap" class="menuitem">' + snapstr + '</div>';
            mc +='<div id="m_reorder" class="menuitem">Reorder</div>';
            mc +='<div id="m_edit" class="menuitem">Edit</div>';
            mc +='<div id="m_rehome" class="menuitem">rehome tiLes</div>';
            mc +='<div id="m_operate" class="menuitem">oPerate</div>';
            var good = createModal("modalpopup", mc, "body" , false, pos, function(ui, content) {
                var buttonid = $(ui).attr("id");
                if ( buttonid && $(ui).attr("class") === "menuitem" ) {
                    var buttonid = buttonid.substring(2);
                    execButton(buttonid);
                }
            });

            if (!good ) {
                closeModal("modalpopup");
            }
        });

        // enable double clicking anywhere to invoke or cancel edit mode
        if ( cm_Globals.enableclickedit ) {
            $("div.ui-tabs-panel div.panel").off("doubletap");
            $("div.ui-tabs-panel div.panel").on("doubletap", function(evt) {
                if ( $(this).hasClass("panel") ) {
                    if ( priorOpmode==="Operate" ) {
                        evt.stopPropagation();
                        execButton("edit");
                    } else if ( priorOpmode ==="Edit" || priorOpmode === "Reorder" ) {
                        evt.stopPropagation();
                        execButton("operate");
                    }
                }
            });
        }

        // prior and next tab clicks
        function nextTab() {
            var curTab = $("#roomtabs > li.ui-tabs-active");
            curTab = curTab.next().attr("aria-labelledby");
            if ( !curTab ) {
                var allTabs = $("#roomtabs > li.ui-tabs-tab");
                curTab = allTabs.first().attr("aria-labelledby")
            }
            try {
                $("#"+curTab).trigger("click");
            } catch (f) { }
        }
        function prevTab() {
            var curTab = $("#roomtabs > li.ui-tabs-active");
            curTab = curTab.prev().attr("aria-labelledby");
            if ( !curTab ) {
                var allTabs = $("#roomtabs > li.ui-tabs-tab");
                curTab = allTabs.last().attr("aria-labelledby");
            }
            try {
                $("#"+curTab).trigger("click");
            } catch (f) { }
        }
        // $("div.nextTab").on("click", function(evt) {
        //     nextTab();
        //     evt.stopPropagation();
        // });
        $("#dragregion").on("swiperight", function(evt, touchdata) {
            if ( priorOpmode==="Operate" && $(touchdata.startEvnt.target).hasClass("panel") ) {
                console.log(">>> touchdata: ", touchdata);
                nextTab();
            }
            evt.stopPropagation();
        });
        // $("div.prevTab").on("click", function(evt) {
        //     prevTab();
        //     evt.stopPropagation();
        // });
        $("#dragregion").on("swipeleft", function(evt, touchdata ) {
            if ( priorOpmode==="Operate" && $(touchdata.startEvnt.target).hasClass("panel") ) {
                console.log(">>> touchdata: ", touchdata);
                prevTab();
            }
            evt.stopPropagation();
        });

        // get default tab from cookie and go to that tab
        var defaultTab = getCookie( 'defaultTab' );
        if ( defaultTab && tabcount > 1 ) {
            try {
                $("#"+defaultTab).trigger("click");
            } catch (e) {
                defaultTab = $("#roomtabs > li.ui-tabs-tab").first().attr("aria-labelledby");
                setCookie('defaultTab', defaultTab);
                try {
                    $("#"+defaultTab).trigger("click");
                } catch (f) { }
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

        var unamere = /^\D\S{2,}$/;      // start with a letter and be three long at least
        // $("#uname").val("default");
        $("#emailid").focus();
        $("#loginform").on("keydown", function(evt) {
            if ( evt.which===27  ){
                $("#emailid").val("");
                $("#mobileid").val("");
                $("#pname").val("");
                $("#pword").val("");
                $("#panelpword").val("");
                $("#emailid").focus();
            }
        });

        $("#emailid").on("keydown",function(evt) {
            evt.stopPropagation();
            var unameval = $("#emailid").val();
            if ( evt.which===13 ){
                var msg = checkInpval("username", unameval, unamere);
                if ( msg ) {
                    $("#emailid").focus();
                    alert(msg);
                } else {
                    $("#mobilid").focus();
                }
            }
        });

        $("#moreinfo").off("tap");
        $("#moreinfo").on("tap",function(evt) {
            evt.stopPropagation();
            if ( $("#loginmore").hasClass("hidden") ) {
                $("#loginmore").removeClass("hidden");
                $(evt.target).html("Less...");
            } else {
                $("#loginmore").addClass("hidden");
                $(evt.target).html("More...");
            }
        });

        $("#newuser").off("tap");
        $("#newuser").on("tap",function(evt) {
            $("#loginform").addClass("hidden");
            $("#newuserform").removeClass("hidden");
        });

        $("#olduser").off("tap");
        $("#olduser").on("tap",function(evt) {
            evt.stopPropagation();
            $("#newuserform").addClass("hidden");
            $("#loginform").removeClass("hidden");
        });

        $("#revertolduser").off("tap");
        $("#revertolduser").on("tap",function(evt) {
            window.location.href = cm_Globals.returnURL + "/logout";
        });

        $("#forgotpw").off("tap");
        $("#forgotpw").on("tap",function(evt) {
            evt.stopPropagation();
            execForgotPassword();
        });

        $("#pword").on("keydown",function(evt) {
            evt.stopPropagation();
            if ( evt.which===13 ){
                $("#pname").val("default");
                $("#pname").focus();
            }
        });

        $("#pname").on("keydown",function(evt) {
            evt.stopPropagation();
            if ( evt.which===13 ){
                $("#pnumber").focus();
            }
        });

        $("#pnumber").on("keydown",function(evt) {
            evt.stopPropagation();
            if ( evt.which===13 ){
                $("#panelpword").focus();
            }
        });

        $("#panelpword").on("keydown",function(evt) {
            evt.stopPropagation();
            if ( evt.which===13 ){
                execButton("dologin");
            }
        });
    }

    // load things and options
    if ( pagename==="main" || pagename==="auth" || pagename==="options" ) {

        getOptions();
        getHubs();
        
        // disable return key
        $("body").off("keypress");
        $("body").on("keypress", function(e) {
            if ( e.keyCode===13  ){
                return false;
            }
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
    }
    
    // handle button setup for all pages
    if ( $("div.formbutton") ) {
        $("div.formbutton").on('click', function(evt) {
            var buttonid = $(this).attr("id");
            var textname = $(this).text();

            // do nothing for name field
            if ( textname === "name" ) {
                return;
            }

            if ( $(this).hasClass("confirm") || buttonid.startsWith("c__") ) {
                var pos = {top: 100, left: 100};
                createModal("modalexec","Perform " + textname + " operation... Are you sure?", "body", true, pos, function(ui, content) {
                    var clk = $(ui).attr("name");
                    closeModal("modalexec");
                    if ( clk==="okay" ) {
                        evt.stopPropagation();
                        execButton(buttonid);
                    }
                });
            } else {
                evt.stopPropagation();
                execButton(buttonid);
            }
        });
    }

    // this is button that returns to main HP page
    // it saves the default hub before returning if on the auth page
    if ( $("button.infobutton") ) {
        // $("button.infobutton").addClass("disabled").prop("disabled", true);
        // setTimeout(function() {
        //     $("button.infobutton").removeClass("disabled").prop("disabled", false);
        // }, 200);
        $("button.infobutton").on('click', function() {
            returnMainPage();
        });
    }

    // handle interactions for main page
    if ( pagename==="main" ) {
        setupTabclick();
        cancelDraggable();
        cancelSortable();
        cancelPagemove();
        initWebsocket();

        // run initial clock updater forcing read
        // moved this to the delay below to make time formats work
        // clockUpdater("clockdigital", true);
        // clockUpdater("clockanalog", true);

        // update times on the clocks every second 
        setInterval( function() { 
            clockUpdater("clockdigital", false);
            clockUpdater("clockanalog", false);
        }, 1000);

        // run clockdigital and clockanalog once every minute for rules
        setInterval( function() 
            { 
                clockUpdater("clockdigital", true);
                clockUpdater("clockanalog", true);
            }, 60000
        );

        // finally we wait a moment then setup page clicks
        // and display the clocks with the proper user defined fields if provided
        // not sure why it doesn't work when we make this call right away
        if ( !cm_Globals.disablepub ) {
            setTimeout(function() { 
                setupPage(); 
                setupSliders();
                setupColors();
                clockUpdater("clockdigital", true);
                clockUpdater("clockanalog", true);
            }, 200);
        }
    }

});

function getActiveTab() {
    var activetab = $("li.ui-tabs-tab.ui-tabs-active");
    if ( !activetab ) {
        activetab = $("li.ui-tabs-tab").first();
    }

    var panel = "";
    if ( activetab ) {
        var click1 = activetab.attr("aria-labelledby");
        panel = $("#"+click1).text();
        // activetab = activetab.attr("aria-controls");
    }
    return panel;
}

function returnMainPage() {
    if ( pagename=="auth" ) {
        var defhub = $("#pickhub").val();
        var hubtimer = $("input[name='hubtimer']").val();
        var hubindex = $("input[name='hubindex']").val();
        $.post(cm_Globals.returnURL, 
                {useajax: "setdefhub", userid: cm_Globals.options.userid, hubid: defhub, value: defhub, id: hubindex, attr: hubtimer}
        );
    }
    window.location.href = cm_Globals.returnURL;
}

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
        var webSocketPort = $("input[name='webSocketServerPort']").val();
        webSocketPort = parseInt(webSocketPort);

        if ( userid && webSocketUrl ) {

            // get the port from the panel name cookie
            var pname = getCookie("pname");
            if ( pname.substring(1,2)!==":" ) {
                pname = "1:" + pname;
            }
            var portnum = pname.substring(0,1);
            var port = webSocketPort + parseInt(portnum);
            webSocketUrl += ":" + port;
            $("#infoport").html("#"+portnum);
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

            if ( cm_Globals.logwebsocket ) {
                console.log(">>>> webSocket pushed: ", presult);
            }

            // reload page if signalled from server
            if ( bid==="reload" ) {

                // skip reload if we are asleep
                // if ( priorOpmode !== "Operate" ) {
                //     return;
                // }

                // only reload this page if the trigger is this page name, blank, or all
                if ( !thetype || thetype==="all" || thetype===pagename ) {

                    // reload all screens if that is requested
                    if ( typeof subid==="undefined" || subid==="" || subid==="/" ) {
                        var reloadpage =  cm_Globals.returnURL;
                        window.location.href = reloadpage;

                    } else {
                        if ( subid.substring(0,1)!=="/" ) {
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

            // changed this to use type correctly and to get thingid from the value passed
            } else if (bid==="setposition" ) {
                var thingid = pvalue.thingid;
                var thing = $("#t-"+thingid);
                // console.log("pushClient setposition: ", thingid, thetype, pvalue);
                if ( thing ) {
                    relocateTile(thing, thetype, pvalue);
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

                // remove reserved fields
                $.each(reservedcap, function(index, val) {
                    if ( pvalue[val] ) {
                        delete pvalue[val];
                    }
                });
                
                // change not present to absent for presence tiles
                // it was an early bad design decision to alter ST's value that I'm now stuck with
                if ( pvalue["presence"] && pvalue["presence"] ==="not present" ) {
                    pvalue["presence"] = "absent";
                }

                // handle operating state changes for thermostate
                if ( pvalue["thermostatOperatingState"] && pvalue["temperature"] ) {
                    var newstate = pvalue["thermostatOperatingState"];
                } else {
                    newstate = null;
                }

                // update all the tiles that match this type and id
                var panelItems = $('div.panel div.thing[bid="'+bid+'"]');
                try {
                    if ( panelItems ) {
                        panelItems.each(function() {
                            var aid = $(this).attr("aid");
                            updateTile(aid, pvalue);

                            // add class for heating mode for thermostats
                            if ( newstate ) {
                                var targettemp = $("#a-"+aid+"-temperature");
                                $(targettemp).removeClass("cooling");
                                $(targettemp).removeClass("heating");
                                $(targettemp).removeClass("idle");
                                $(targettemp).addClass(newstate);            
                            }
                        });
                    }
                    updateLink(bid, pvalue);
                } catch (e) {
                    console.log("Error updating tile with bid: ", bid, " pvalue: ", pvalue, " error: ", e);
                }

                // blank screen if night mode set
                if ( (typeof pvalue.themode !== "undefined")  && 
                     blackout===true && (priorOpmode === "Operate" || priorOpmode === "Sleep") ) {

                    // console.log("mode: ", pvalue.themode, " priorMode: ", priorOpmode);
                    cm_Globals.options.themode = pvalue.themode;
                    if ( pvalue.themode === "Night" ) {
                        execButton("blackout");
                        priorOpmode = "Sleep";
                    } else if ( $("#blankme") ) {
                        $("#blankme").off("tap");
                        $("#blankme").remove(); 
                        priorOpmode = "Operate";
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
            if ( !isNaN(zindex) && zindex > zmax ) { zmax = zindex; }
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
        return false; 
    }
    saveOpmode = priorOpmode;
    priorOpmode = "Modal";
    modalWindows[modalid] = 1;
    modalStatus = modalStatus + 1;
    // console.log("saveOpmode: ", saveOpmode, " modalid: ", modalid, " cnt: ", modalStatus);
    
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
    } else {
        pos = {width: 800, height: "auto"};
        styleinfo = " style=\"position: " + postype + ";";
        styleinfo += " width: 800px;";
        styleinfo += " height: auto;";
        styleinfo += "\"";
    }
    
    modalcontent = "<div id='" + modalid +"' class='modalbox'" + styleinfo + ">" + modalcontent;
    if ( addok ) {
        modalcontent = convertToModal(modalcontent, addok);
    }
    modalcontent = modalcontent + "</div>";

    // modalhook.prepend(modalcontent);
    $("#dragregion").append(modalcontent);
    
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
                // console.log("closing modal: ", modalid);
                closeModal(modalid);
            }
        });

        $("#"+modalid).on("tap",".dialogbtn", function(evt) {
            // if a handler is provided it must make the call to closeModal otherwise the default response does that and only that
            if ( responsefunction ) {
                responsefunction(this, modaldata);
            } else {
                // console.log("closing modal: ", modalid);
                closeModal(modalid);
            }
            evt.stopPropagation();
        });
    } else {

        if ( modalid==="menubox" ) {
            $("#"+modalid + " .menuitem").on("tap", function(evt) {
                closeModal(modalid);
                if ( responsefunction ) {
                    responsefunction(this, modaldata);
                }
            });
        }

        // body clicks turn off modals unless clicking on box itself
        // or if this is a popup window any click will close it
        $("body").off("singletap");
        $("body").on("singletap",function(evt) {
            if ( (evt.target.id === modalid && modalid!=="modalpopup" )  ) {
                // console.log("modal opt 1");
                evt.stopPropagation();
            } else {
                // console.log("modal opt 2");
                closeModal(modalid);
                if ( responsefunction ) {
                    responsefunction(evt.target, modaldata);
                }
                $("body").off("singletap");
            }
        });
    }
    return true;

}

function closeModal(modalid) {
    try {
        $("#"+modalid).remove();
    } catch(e) {}

    modalWindows[modalid] = 0;
    modalStatus = modalStatus - 1;
    if ( modalStatus < 0 ) { modalStatus = 0; }

    priorOpmode = saveOpmode;
    // console.log("priorOpmode = " + priorOpmode, " modalid: ", modalid, " modalStatus: ", modalStatus);
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
                var pname = cm_Globals.options.pname;

                var usertile =  $("#sb-"+aid+"-"+subid);
                var command = "";
                var linktype = thetype;
                var linkval = "";
                var linkbid = bid;
                var linkhub = hubindex;
                var realsubid = subid;
                var linkid = 0;
    
                if ( usertile && usertile.attr("command") ) {
                    command = usertile.attr("command");    // command type
                    linkval = usertile.attr("linkval");
                    linkbid = usertile.attr("linkbid");
                    linkhub = usertile.attr("linkhub");
                    linktype = usertile.attr("linktype");
                    realsubid = usertile.attr("subid");
                    linkid = usertile.attr("linkid");
                }
                if ( typeof linkval === "string" && 
                     (linkval.startsWith("GET::") || linkval.startsWith("POST::") || 
                      linkval.startsWith("PUT::") || linkval.startsWith("LINK::") || 
                      linkval.startsWith("RULE::") || linkval.startsWith("URL::")) )
                {
                    var jcolon = linkval.indexOf("::");
                    command = linkval.substring(0, jcolon);
                    linkval = linkval.substring(jcolon+2);
                } else {
                    command = "";
                    linkval = "";
                }
                // console.log("setupColors doaction: id: ", linkbid, " type: ", linktype, " value: ", hslstr, " hex: ", hexval, " hubid: ", linkhub);
                console.log("setupColors: userid= ", userid, " thingid= ", thingid, " tileid= ", tileid, " hint= ", hint,
                " command= ", command, " bid= ", bid, " linkbid= ", linkbid, " linkid= ", linkid, " hub= ", hubid, " linkhub= ", linkhub,
                " type= ", thetype, " linktype= ", linktype, " subid= ", subid, " value= ", hslstr, 
                " linkval= ", linkval, " attr=", hexval);

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
        var pname = cm_Globals.options.pname;
        
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
            command = linkval.substring(0, jcolon);
            linkval = linkval.substring(jcolon+2);
        // } else {
        //     command = "";
        //     linkval = "";
        }

        console.log("Slider action: command= ", command, " bid= ", bid, " linkbid= ", linkbid, " linkid= ", linkid, " hub= ", linkhub, " type= ", linktype, " subid= ", realsubid, " hint= ", hint, " value= ", thevalue, " linkval= ", linkval);
        $.post(cm_Globals.returnURL, 
            {useajax: "doaction", userid: userid, pname: pname, id: linkbid, thingid: thingid, type: linktype, value: thevalue, attr: subid, hint: hint,
            subid: realsubid, hubid: hubid, hubindex: linkhub, tileid: tileid, command: command, linkval: linkval});
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

        if ( $(this).resizable("instance") ) {
            $(this).resizable("destroy");
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
                var pgname = $(this).children().first().text();
                var roomid = $("#panel-"+pgname).attr("roomid");
                pages[k] = {id: roomid, rorder: k, rname: pgname};
                k++;
                updateSortNumber(this, k.toString());
            });
            var userid = cm_Globals.options.userid;
            var pname = cm_Globals.options.pname;
            $.post(cm_Globals.returnURL, 
                {useajax: "setorder", userid: userid, pname: pname, id: "none", type: "rooms", value: pages},
                function (presult, pstatus) {
                    if (pstatus==="success" ) {
                        cm_Globals.reordered = true;
                        console.log("setorder: ", presult );
                    }
                }, "json"
            );
        }
    });
}

function setupSortable() {
    
    // loop through each room panel
    cm_Globals.reordered = false;
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
            var userid = cm_Globals.options.userid;
            var pname = cm_Globals.options.pname;
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
                    {useajax: "setorder", userid: userid, pname: pname, id: "none", type: "things", value: tilenums},
                    function (presult, pstatus) {
                        if (pstatus==="success" ) {
                            cm_Globals.reordered = true;
                            console.log("setorder: ", presult );
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
    var delx = 0;
    var dely = 0;
    cm_Globals.edited = false;

    // save original style sheet so we can revert if resizing or edits are cancelled
    var customCSSfile = document.getElementById('customtiles');
    if ( customCSSfile ) {
        et_Globals.savedSheet = customCSSfile.sheet;
    } else {
        saveCSSFile(cm_Globals.options.userid, str_type, 0, "", false);
        et_Globals.savedSheet = "";
    }

    // the active things on a panel
    thingDraggable( $("div.panel div.thing"), cm_Globals.snap, "parent" );
    
    setupFilters();
        
    // show the catalog
    $("#catalog").show();

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

    thingDroppable();

    function thingDraggable(thing, snap, container) {
        var snapgrid = false;
    
        if ( snap ) {
            snapgrid = [20, 20];
        }
        thing.draggable({
            revert: "invalid",
            grid: snapgrid,
            containment: container,    
            start: function(evt, ui) {

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
                    startPos.priorStart = "relative";
                    startPos.position = "relative";
                } else {
                    // $(evt.target).css({"position":startPos.position, "left": startPos.left, "top": startPos.top} );
                    startPos.left = parseInt($(evt.target).position().left);
                    startPos.top  = parseInt($(evt.target).position().top);
                    delx = evt.pageX - startPos.left;
                    dely = evt.pageY - startPos.top;
                    startPos.priorStart = $(evt.target).css("position");
                    // startPos.position = "absolute";
                }
            },
            stop: function(evt, ui) {
                var thing = evt.target; // ui.draggable;
                console.log("Stopped dragging: ", $(evt.target).attr("type") );

                startPos.left = evt.pageX - delx;   // parseInt($(evt.target).offset().left);
                startPos.top  = evt.pageY - dely;   // parseInt($(evt.target).offset().top);
                var panel = $(thing).attr("panel");
                var tile = $(thing).attr("tile");
                var thingid = $(thing).attr("thingid");
                var bid = $(thing).attr("bid");
                var thingtype = $(thing).attr("type");0
                $(thing).css("z-index", startPos["z-index"] );

                // revert back to relative if we dragged outside panel to top
                // remove this because we now have a reset button and we might want to place stuff on the edges
                if ( startPos.top < 0 ) {
                    startPos.top = 0;
                }
                if ( startPos.left < 0 ) {
                    startPos.left = 0;
                }
                var zmax = getMaxZindex(panel);
                startPos["z-index"] = zmax;
                startPos.position = "absolute";
                $(thing).css(startPos);
                cm_Globals.edited = true;
                
                // now post back to housepanel to save the position
                // also send the dragthing object to get panel name and tile pid index
                $.post(cm_Globals.returnURL, 
                    {useajax: "setposition", userid: cm_Globals.options.userid, pname: cm_Globals.options.pname, 
                     id: bid, type: thingtype, attr: startPos, tileid: tile, thingid: thingid},
                    function (presult, pstatus) {
                        if (pstatus==="success") {
                            console.log("setposition: ", presult, "id",bid,"type",thingtype, "attr",startPos, "tile",tile,"thingid",thingid);
                        }
                    }
                );

            }
        });

        thing.resizable({
            distance: 5,
            containment: "document",
            maxHeight: 600,
            maxWidth: 900,
            grid: snapgrid,
            autoHide: true,
            handles: {'se': '.ui-resizable-se'},
            stop: function(evt, ui) {
                cm_Globals.edited = true;
                var thing = evt.target;
                var tile = $(thing).attr("tile");
                var thingtype = $(thing).attr("type");0
                var newsize = ui.size;                
                var target = getCssRuleTarget(thingtype, 'wholetile', tile, "thistile");
                var rule = "width: " + newsize.width.toString() + "px; " +
                           "height: " + newsize.height.toString() + "px;";
                addCSSRule(target, rule, false);
                saveTileEdit(cm_Globals.options.userid, thingtype, tile);
            }
        });
    }
    
    // enable filters and other stuff if successful
    function thingDroppable() {
    
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
                    // get panel of active page - now do this easier using tags
                    var panel = getActiveTab();
                    if ( panel ) {
                        var container = $("#panel-"+panel);
                        // var lastthing = $("div.panel-"+panel+" div.thing").last();
                        var roomid = $("#panel-"+panel).attr("roomid");
                        var pname = cm_Globals.options.pname;
                        pos = {position: "absolute", top: evt.pageY, left: evt.pageX, width: 300, height: "auto"};
                        var zmax = getMaxZindex(panel);
                        startPos["z-index"] = zmax;
                        // if we drop it anywhere other than near last tile, make it relative
                        // otherwise make it absolute and drop it where we pointed
                        // var lastThing = $("div.thing[panel="+panel+"][style*='relative']").last();
                        // var lastTop = parseInt( $(lastThing).position().top );
                        // var lastLeft = parseInt( $(lastThing).position().left );
                        // var thingTop = evt.pageY;
                        // var thingLeft = evt.pageX;
                        // console.log("Y, X, LastY, LastX, id: ", thingTop, thingLeft, lastTop, lastLeft, $(lastThing).attr("bid") );
                        // if ( (Math.abs( thingTop - lastTop) > 150) || (Math.abs(thingLeft - lastLeft) > 150) ) {
                        //     startPos.top = thingTop;
                        //     startPos.left = thingLeft;
                        //     startPos.position = "absolute";
                        // }

                        createModal("modaladd","Add: "+ thingname + " of Type: "+thingtype+" to Room: "+panel+"?<br /><br />Are you sure?", "body", true, pos, function(ui, content) {
                            var clk = $(ui).attr("name");
                            if ( clk==="okay" ) {
                                cm_Globals.edited = true;
                                // add it to the system
                                // the ajax call must return a valid "div" block for the dragged new thing
                                $.post(cm_Globals.returnURL, 
                                    {useajax: "addthing", userid: userid, pname: pname, id: bid, type: thingtype, value: panel, panelid: panelid, 
                                                            attr: startPos, hubid: hubid, hubindex: hubindex, roomid: roomid, pname: pname},
                                    function (presult, pstatus) {
                                        if (pstatus==="success" && !presult.startsWith("error") ) {
                                            console.log( "Added " + thingname + " of type " + thingtype + " and bid= " + bid + " to room " + panel, " pos: ", startPos);
                                            $("div.panel-"+panel).append(presult);
                                            var newthing = $("div.panel-"+panel+" div.thing").last();
                                            $(newthing).css( startPos );
                                            thingDraggable( newthing, cm_Globals.snap, container );
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
                            closeModal("modaladd");
                        });
                    } 
                }
            }
        });
    }
}

function relocateTile(thing, thingtype, tileloc) {

    // force positions of relative tiles back to zero
    if ( tileloc.position && tileloc.position==="relative") {
        tileloc.left = 0;
        tileloc.top = 0;
        var panel = $(thing).attr("panel");
        var zmax = 1;
        if ( thingtype === "bulb" ) {
            zmax = getMaxZindex(panel);
        }
        tileloc["z-index"] = zmax;
    }

    try {
        var zpos = "relative";
        if ( tileloc.position ) {
            zpos = tileloc.position;
            $(thing).css("position", tileloc.position);
        }
        var zleft = 0;
        if ( tileloc.left ) {
            zleft = tileloc.left;
            $(thing).css("left", tileloc.left);
        }
        var ztop = 0;
        if ( tileloc.top ) {
            ztop = tileloc.top;
            $(thing).css("top",tileloc.top);
        }
        var zidx = 1;
        if ( tileloc["z-index"] ) {
            zidx = tileloc["z-index"];
            $(thing).css("z-index", tileloc["z-index"]);
        }
        // console.log("relocate: ", zpos, zleft, ztop, zidx);
        if ( zpos === "relative" ) {
            var stylestr = `position: ${zpos}; left: ${zleft}; top: ${ztop}; z-index: ${zidx}`;
            $(thing).attr("style",stylestr);
        }
    } catch(e) { 
        console.log("error - Tile reposition error: ", e); 
    }

}

function rehomeTiles() {

    var startPos = {top: 0, left: 0, "z-index": 1, position: "relative"};
    var pid = $("li[aria-selected='true']").attr("aria-labelledby");
    var panel = $("#"+pid).html();
    // console.log("panel: ", pid, panel);

    $("div.thing[panel="+panel+"]").each( function() {

        var bid = $(this).attr("bid");
        var thingtype = $(this).attr("type");
        var tile = $(this).attr("tile");
        var thingid = $(this).attr("thingid");
        var pname = cm_Globals.options.pname;

        // console.log(bid, thingtype, tile, thingid, pname, startPos);
        $.post(cm_Globals.returnURL, 
            {useajax: "setposition", userid: cm_Globals.options.userid, pname: pname, id: bid, type: thingtype, attr: startPos, tileid: tile, thingid: thingid},
            function (presult, pstatus) {
                console.log(presult);
            }
        );

    });

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
    if ( body && typeof body === "object" ) { 
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
        // alert("email: " + emailname + " mobile: " + mobile);
        $.post(cm_Globals.returnURL, 
            {useajax: "forgotpw", email: emailname, mobile: mobile}, 
            function(presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult === "object" && presult.id ) {
                    var pstyle = "position: absolute; border: 6px black solid; background-color: green; color: white; font-size: 14px; left: 550px; top: 10px; width: 400px; height: 100px; padding-top: 50px; text-align: center;";
                    var pos = {style: pstyle};
                    var userid = presult.id;
                    // console.log("user: ", presult);
                    createModal("loginfo","Login reset code sent and printed to log for user# " + userid + "<br>On the next screen please provide that code <br>along with the new password information.<br>", "body", "Done", pos, function(ui) {
                        closeModal("loginfo");
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
                    var usertype = parseInt(presult.usertype);
                    if ( !usertype || usertype === 0 ) {
                        createModal("loginfo","New user created. Please validate using code in log file or sent to mobile: <b>" + mobile+ "</b> or <b>" + emailname + "</b> to activate this account.<br><br>", "body", "Done", pos, function(ui) {
                            window.location.href = cm_Globals.returnURL + "/activateuser?userid="+userid;
                        });
                    } else {
                        createModal("loginfo","New user created. Please login using the email ["  + emailname + "], phone [" + mobile + "], and password you created to log into this account.<br><br>", "body", "Done", pos, function(ui) {
                            window.location.href = cm_Globals.returnURL;
                        });
                    }
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
                    // console.log("validatepassword = ", presult);
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

    // console.log("buttonid: ", buttonid, " priorOpmode: ", priorOpmode, " modalStatus: ", modalStatus, " edited? ", cm_Globals.edited);
    if ( buttonid==="optSave") {

        // var fobj = formToObject("filteroptions");
        var oobj = formToObject("optionspage");

        // try {
            // dynoPost("filteroptions", fobj, function(presult, pstatus) {
        dynoPost("saveoptions", oobj, function(presult, pstatus) {
            if ( pstatus!=="success" ) {
                // console.log(pstatus, " result: ", presult, " optionsobj: ", oobj);
                alert("Options page failed to save properly");
                window.location.href = cm_Globals.returnURL;
            } else {
                // console.log("results: ", presult, " optionsobj: ", oobj);
                if ( typeof presult === "object" && presult.result === "logout" ) {
                    window.location.href = cm_Globals.returnURL + "/logout?pname=" + presult.pname;
                } else {
                    window.location.href = cm_Globals.returnURL;
                }
            }
        });
        //     });
        // } catch (e) {
        //     console.log("Options page failed to save properly", e);
        //     alert("Options page failed to save properly");
        //     window.location.href = cm_Globals.returnURL;
        // }

    } else if ( buttonid==="optCancel" ) {
        // do nothing but reload the main page
        window.location.href = cm_Globals.returnURL;

    } else if ( buttonid==="optReset" ) {
        // reset the forms on the options page to their starting values
        $("#optionspage")[0].reset();
        // $("#filteroptions")[0].reset();

    } else if ( buttonid==="createuser" ) {
        execCreateUser();

    } else if ( buttonid==="newuservalidate" ) {
        execValidateUser();

    } else if ( buttonid==="newpassword") {
        execValidatePassword();

    } else if ( buttonid==="dologin") {

        if ( !checkLogin() ) { return; }

        var genobj = formToObject("loginform");
        // console.log(genobj);

        dynoPost("dologin", genobj, function(presult, pstatus) {
            if ( pstatus === "success" && presult && typeof presult === "object" ) {
                // console.log("login successful for user: ",  presult["users_email"], " and panel: ", presult["panels_pname"]);
                var pstyle = "position: absolute; border: 6px black solid; background-color: blue; color: white; font-weight: bold; font-size: 24px; left: 560px; top: 220px; width: 600px; height: 220px; padding-top: 20px;";
                var pos = {style: pstyle};
                createModal("loginfo","User Email: " + presult["users_email"] + "<br>Username: " + presult["users_uname"] + "<br>Logged into panel: " + presult["panels_pname"] + "<br>With skin: " + presult["panels_skin"] + "<br><br>Proceed? ", 
                    "body", true, pos, function(ui) {
                        var clk = $(ui).attr("name");
                        if ( clk==="okay" ) {
                            window.location.href = cm_Globals.returnURL;
                        }
                        closeModal("loginfo");
                    });
                // window.location.href = cm_Globals.returnURL;
            } else {
                // console.log("not logged in. ", presult);
                var pstyle = "position: absolute; border: 6px black solid; background-color: red; color: white; font-weight: bold; font-size: 24px; left: 560px; top: 220px; width: 600px; height: 180px; padding-top: 50px;";
                var pos = {style: pstyle};
                createModal("loginfo","Either the User and Password pair are invalid, or the requested Panel and Password pair are invalid. <br><br>Please try again.", "body", false, pos);
                setTimeout(function() {
                    closeModal("loginfo");
                },2000);
                // window.location.href = cm_Globals.returnURL;
            }
        });

    } else if ( buttonid === "blackout"  && (priorOpmode==="Operate" || priorOpmode==="Sleep") ) {
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
        setCookie("opmode", priorOpmode);
        $("div.maintable").after("<div id=\"blankme\"></div>");

        // if timer is zero or less than 1 second just do a black screen
        if ( phototimer < 1000 ) {
            $("#blankme").css( {"height":h+"px", "width":w+"px", 
            "position":"absolute", "background-color":"black",
            "left":"0px", "top":"0px", "z-index":"9999" } );
        
        // if timer provided make call to get list of photos to cycle through
        // and if this fails fall back to the same simple black screen
        } else {
            var pname = cm_Globals.options.pname;

            // alert("phototimer = " + phototimer + " pname = " + pname);

            $.post(cm_Globals.returnURL, 
                {useajax: "getphotos", userid: cm_Globals.options.userid, pname: pname}, 
                function(presult, pstatus) {
                    if ( presult && typeof presult == "object" ) {
                        var photos = presult;
                        var pnum = 0;
                        $("#blankme").css( {"height":h+"px", "width":w+"px", 
                        "position":"absolute", "background-color":"black", "background-size":"contain",
                        "background-image": "url('" + photos[pnum] + "')",
                        "left":"0px", "top":"0px", "z-index":"9999" } );
                        photohandle = setInterval(function() {
                            pnum++;
                            if ( typeof photos[pnum] === "undefined" ) {
                                pnum = 0;
                            }
                            $("#blankme").css( {"height":h+"px", "width":w+"px", 
                            "position":"absolute", "background-color":"black", "background-size":"contain",
                            "background-image": "url('" + photos[pnum] + "')",
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
        $("#blankme").off("singletap");
        $("#blankme").on("singletap", function(evt) {
            if ( photohandle ) {
                clearInterval(photohandle);
            }
            $("#blankme").remove(); 
            priorOpmode = "Operate";
            setCookie("opmode",priorOpmode);
            evt.stopPropagation();
        });
    } else if ( buttonid === "toggletabs" && priorOpmode==="Operate" ) {
        toggleTabs();
    } else if ( buttonid === "rehome" && priorOpmode==="Operate" ) {
        rehomeTiles();
        // window.location.href = cm_Globals.returnURL;
    } else if ( buttonid === "reorder" && priorOpmode==="Operate" ) {
        $("#quickedit").html("P");
        setupSortable();
        setupPagemove();
        priorOpmode = "Reorder";
        setCookie("opmode", priorOpmode);
    } else if ( buttonid === "edit" && priorOpmode==="Operate") {
        // console.log("Edit button: ", buttonid, " opmode: ", priorOpmode);
        $("#showversion").hide();
        $("#quickedit").html("P");
        addEditLink();
        setupDraggable();
        priorOpmode = "Edit";
        setCookie("opmode", priorOpmode);
    } else if ( buttonid==="operate" ) {

        // if modal box is open and we are editing or customizing, do nothing
        // if ( (priorOpmode!=="Operate" && modalStatus!==0) || priorOpmode==="Operate") {
        //     // $("#mode_"+priorOpmode).prop("checked",true);
        //     return;
        if ( priorOpmode === "Reorder" ) {
            $("#quickedit").html("R");
            cancelSortable();
            cancelPagemove();
            if ( cm_Globals.reordered ) {
                window.location.href = cm_Globals.returnURL;
            }
        } else if ( priorOpmode === "Edit" ) {
            $("#showversion").show();
            $("#quickedit").html("E");
            cancelDraggable();
            delEditLink();
            if ( cm_Globals.edited ) {
                updateFilters();
                window.location.href = cm_Globals.returnURL;
            }
        } else {
            // console.log("Operate command has no effect in mode: ", priorOpmode);
            return;
        }
        priorOpmode = "Operate";
        setCookie("opmode", priorOpmode);
        
    } else if ( buttonid==="showdoc" && priorOpmode==="Operate") {
        window.open("https://housepanel.net",'_blank');
        return;
    } else if ( buttonid==="snap" && priorOpmode==="Operate" ) {
        // $("#mode_Snap").prop("checked");
        cm_Globals.snap =  ! cm_Globals.snap;

    } else if ( buttonid==="refreshpage" && priorOpmode==="Operate" ) {
        var pstyle = "position: absolute; background-color: blue; color: white; font-weight: bold; font-size: 24px; left: 300px; top: 300px; width: 600px; height: 100px; margin-left: 50px; margin-top: 50px;";
        var rstyle = "position: absolute; background-color: blue; color: white; font-weight: normal; font-size: 24px; left: 200px; top: 200px; width: 800px; height: 250px; margin-left: 50px; margin-top: 50px;";
        createModal("modalpopup", "Screen will reload when hub refresh is done...","body", false, {style: pstyle});
        dynoPost(buttonid, "", function(presult, pstatus) {
            setTimeout(function() {
                closeModal("modalpopup");
                createModal("modalpopup", presult, "body", false, {style: rstyle});
                setTimeout(function() {
                    window.location.href = cm_Globals.returnURL;
                },4000);
            },2000);
        });
    
    // remaining menu buttons
    } else if ( (buttonid==="showid" || buttonid==="userauth" || buttonid==="showoptions") && priorOpmode==="Operate" ) {
        window.location.href = cm_Globals.returnURL + "/" + buttonid;

    // default is to call main node app with the id as a path
    } else {
        if ( priorOpmode!=="Operate") {
            console.log("command not supported while editing or customizing: ", buttonid);
        } else {
            console.log("command not supported: ", buttonid);
        }
        // window.location.href = cm_Globals.returnURL + "/" + buttonid;
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

function setupButtons() {

    if ( pagename==="main" ) {

        // prevent mode from changing when editing a tile
        // $("div.modeoptions").on("click","input.radioopts",function(evt){
        //     var opmode = $(this).attr("id");
        //     evt.stopPropagation();
        //     execButton(opmode);
        // });
        $("#quickedit").on("tap", function(e) {
            if ( priorOpmode === "Operate" ) {
                var letter = $("#quickedit").html();
                switch (letter) {
                    case "T":
                        execButton("toggletabs");
                        break;
                    case "R":
                        execButton("reorder");
                        break;
                    case "E":
                        execButton("edit");
                        break;
                    case "P":
                        execButton("operate");
                        break;
                    default:
                        execButton("operate");
                }
            } else {
                execButton("operate");
            }
        });
        
        $("#showversion").on("tap", function(e) {
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

    } else if ( pagename==="options") {
        setupCustomCount();
        setupFilters();
        var pos = {position: "absolute", top: 100, left: 100, width: 600, height: 120, border: "4px solid"};
        // $("#showpanelname").hide();
        $("#userpanel").on("change", function(evt) {
            var panelid = $(this).val();
            var panelname = $("#userpanel option[value='"+panelid+"']").html();
            $("#panelname").val(panelname);
            // $("#delPanel").html("Delete Panel");
        });
        $("#delPanel").on("tap", function(evt) {
            const pname = $("#panelname").val();
            createModal("modalhub","Delete Panel: " + pname + " Are you sure?", "body" , true, pos, function(ui) {
                var clk = $(ui).attr("name");
                closeModal("modalhub");
                if ( clk==="okay" ) {
                    alert("Removing panel: " + pname);
                    $.post(cm_Globals.returnURL, 
                        {useajax: "delpanel", userid: cm_Globals.options.userid, pname: pname}
                    );
                }
            });
        });
        $("#usePanel").on("tap", function(evt) {
            const pname = $("#panelname").val();
            createModal("modalhub","Activate and switch to Panel: " + pname + " Are you sure?", "body" , true, pos, function(ui) {
                var clk = $(ui).attr("name");
                closeModal("modalhub");
                if ( clk==="okay" ) {
                    alert("Using panel: " + pname);
                    $.post(cm_Globals.returnURL, 
                        {useajax: "usepanel", userid: cm_Globals.options.userid, pname: pname}
                    );
                }
            });
        });
        $("#delUser").on("tap", function(evt) {
            const uname = $("#unameid").val();
            const emailname = $("#emailid").val();
            const userid = cm_Globals.options.userid;
            createModal("modalhub","Remove User #" + userid + " uname: " + uname + " email: " + emailname + " Are you sure?", "body" , true, pos, function(ui) {
                var clk = $(ui).attr("name");
                closeModal("modalhub");
                if ( clk==="okay" ) {
                    alert("Removing user: " + uname + " | " + emailname);
                    $.post(cm_Globals.returnURL, 
                        {useajax: "deluser", userid: cm_Globals.options.userid, uname: uname, email: emailname}
                    );
                }
            });
        });
        $(document).on("keydown", function(evt) {
            if ( evt.which === 27 ) {
                window.location.href = cm_Globals.returnURL;
            }
        });
        $("div.filteroption div, div.filteroption table").on("keydown", function(evt) {
            if ( evt.which === 27 ) {
                window.location.href = cm_Globals.returnURL;
            }
        });


    } else if ( pagename==="auth" ) {

        // populate the clientSecret field that could have funky characters
        // var funkysecret = $("input[name='csecret']").val();
        // $("input[name='clientsecret']").val(funkysecret);
        $("#newthingcount").html("Select a hub to re-authorize or select the 'New' hub to add a hub");
        var hubId = $("#pickhub").val();
        setupAuthHub(hubId);

        // now we use the DB index of the hub to ensure it is unique
        $("#pickhub").on('change',function(evt) {
            var hubId = $(this).val();
            setupAuthHub(hubId);
            evt.stopPropagation(); 
        });

        // set a new hub to authorize based on the type
        // note that types can only be set when a new hub is being added
        $("select[name='hubtype']").on('change', function(evt) {
            var hubType = $(this).val();
            var hideaccess = $("#hideaccess_hub");
            var hubTarget = $("input[name='hubhost']");
            var hubhost = hubTarget.val();
            var hubname = $("input[name='hubname']").val();
            var clientid = $("input[name='clientid']").val();
            var clientsecret = $("input[name='clientsecret']").val();
            var useraccess = $("input[name='useraccess']").val();
            var userendpt = $("input[name='userendpt']").val();
            var hubtimer = $("input[name='hubtimer']").val();
            var hub = {id: 0, hubhost: "", hubname: hubname, clientid: clientid, clientsecret: clientsecret, useraccess: useraccess, userendpt: userendpt, hubid: "new",
                       hubtimer: hubtimer, hubaccess: "", hubendpt: "", hubrefresh: ""};
            var clientLabel = "Client ID: ";
            var secretLabel = "Client Secret: ";
            $("#inp_hubid").hide();
            $("#inp_clientid").show();
            $("#inp_clientsecret").show();
            hideaccess.hide();

            if ( hubType==="NewSmartThings" ) {
                hub.hubhost = "https://api.smartthings.com";
                hub.hubtimer = 0;
                $("#inp_clientid").hide();
                $("#inp_clientsecret").hide();
                hub.hubname = "SmartThings Home";
                hubTarget.prop("disabled", true);
                $("#newthingcount").html("Ready to authorize your new SmartThings API account. Account access information required in cfg file");
            } else if ( hubType==="Sonos" ) {
                hub.hubhost = "https://api.sonos.com";
                hub.hubtimer = 0;
                $("#inp_clientid").hide();
                $("#inp_clientsecret").hide();
                hub.hubname = "Sonos";
                hubTarget.prop("disabled", true);
                $("#newthingcount").html("Ready to authorize your Sonos account. The hub name can be set to anything or the name Sonos will be assigned.");
            } else if ( hubType==="Hubitat" ) {
                hub.hubhost = "https://oauth.cloud.hubitat.com";
                hub.hubname = "Hubitat Home";
                hubTarget.prop("disabled", false);
                hideaccess.show();
                $("#newthingcount").html("Ready to authorize your Hubitat hub. For local use, change Hub API above to your hub's local IP. The hub name will be obtained automatically.");
            } else if ( hubType==="Ford" || hubType==="Lincoln" ) {
                hub.hubhost = "https://dah2vb2cprod.b2clogin.com";
                hub.hubtimer = 0;
                hub.hubname = hubType + " Vehicle";
                hubTarget.prop("disabled", true);
                $("#newthingcount").html("Ready to authorize your Ford or Lincoln vehicle. Account access information required in cfg file");
            } else if ( hubType==="ISY" ) {
                hub.hubhost = "https://192.168.xxx.yyy:8443";
                hub.hubname = "ISY Home";
                hubTarget.prop("disabled", false);
                clientLabel = "Username: ";
                secretLabel = "Password: ";
                $("#newthingcount").html("To authorize your Universal Devices ISY account, enter your ISY username and password and set the IP last two digits.");
            } else {
                hideaccess.show();
                hubTarget.prop("disabled", false);
            }
            $("#labelclientId").html(clientLabel);
            $("#labelclientSecret").html(secretLabel);
            $("input[name='hubindex']").val(hub.id);
            $("input[name='hubhost']").val(hub.hubhost);
            $("input[name='hubname']").val(hub.hubname);
            $("input[name='clientid']").val(hub.clientid);
            $("input[name='clientsecret']").val(hub.clientsecret);
            $("input[name='useraccess']").val(hub.useraccess);
            $("input[name='userendpt']").val(hub.userendpt);
            $("input[name='hubid']").val(hub.hubid);
            $("input[name='hubtimer']").val(hub.hubtimer);
            $("input[name='hubaccess']").val(hub.hubaccess);
            $("input[name='hubendpt']").val(hub.hubendpt);
            $("input[name='hubrefresh']").val(hub.hubrefresh);
        });
        
        // this clears out the message window
        $("#newthingcount").on('click',function(evt) {
            $("#newthingcount").html("");
        });
        
        // handle auth submissions
        // add on one time info from user
        $("input.hubauth").on("click",function(evt) {
            try {
                var formData = formToObject("hubform");
            } catch(err) {
                evt.stopPropagation(); 
                alert("Something went wrong when trying to authenticate your hub...\n" + err.message);
                return;
            }
            
            // tell user we are authorizing hub...
            $("#newthingcount").html("Authorizing hub: " + formData.hubname).fadeTo(400, 0.1 ).fadeTo(400, 1.0).fadeTo(400, 0.1 ).fadeTo(400, 1).fadeTo(400, 0.1 ).fadeTo(400, 1).fadeTo(400, 0.1 ).fadeTo(400, 1).fadeTo(400, 0.1 ).fadeTo(400, 1);

            // make an api call and process results
            // some hubs return devices on server and pushes results later
            // others return a request to start an OATH redirection flow
            formData["api"] = "hubauth";
            formData.hubtype = $("select[name='hubtype']").val();
            formData.hubhost = $("input[name='hubhost']").val();
            $.post(cm_Globals.returnURL, formData,  function(presult, pstatus) {
                // console.log("hubauth: ", presult);
                // alert("wait... presult.action = " + presult.action);

                if ( pstatus==="success" && typeof presult==="object" && presult.action ) {
                    var obj = presult;

                    // for hubs that have auth info in the config file we do nothing but notify user of retrieval
                    if ( obj.action === "things" ) {
                        $("#newthingcount").html("Hub " + obj.hubName + " of type (" + obj.hubType+") authorized " + obj.numdevices + " devices");
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

                    else if ( obj.action === "error" ) {
                        $("#newthingcount").html(obj.reason);
                    }
                } else {
                    if (typeof presult==="string" ) {
                        $("#newthingcount").html(presult);
                    } else {
                        $("#newthingcount").html("Something went wrong with hub auth request");
                        console.log("hub auth error: ", presult);
                    }
                }
            });
            evt.stopPropagation();
        });
        
        // this feature works but not on the last hub
        $("input.hubdel").on("click", function(evt) {
            var hubId = $("input[name='hubid']").val();
            if ( !hubId || hubId==="-1" ) return;
            var hub = findHub(hubId, "hubid");
            if ( !hub ) return;

            var hubname = hub.hubname;
            var hubindex = hub.id;
            var bodytag = "body";
            var pname = cm_Globals.options.pname;
            var pos = {position: "absolute", top: 100, left: 100, 
                       width: 600, height: 120, border: "4px solid"};
            var msg = "Remove hub: " + hubname + "<br>hubID: " + hubId + "? <br><br>Are you sure?";

            createModal("modalhub", msg, bodytag , true, pos, function(ui, content) {
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    // remove it from the system
                    $.post(cm_Globals.returnURL, 
                        {useajax: "hubdelete", userid: cm_Globals.options.userid, pname: pname, hubid: hubId, id: hubindex},
                        function (presult, pstatus) {
                            if (pstatus==="success" && typeof presult === "string") {
                                $("#newthingcount").html(presult);
                                setTimeout(function() {
                                    var location = cm_Globals.returnURL + "/reauth";
                                    window.location.href = location;
                                }, 3000);
                            } else {
                                $("#newthingcount").html("error - could not remove hub: " + hubname + " hub ID: " + hubId);
                                // console.log(presult);
                            }
                        }
                    );
                    closeModal("modalhub");
                }
            });
            
            evt.stopPropagation(); 
        });
    
    }
}

function setupAuthHub(hubId) {
    var hub = findHub(hubId,"hubid");
    var hubindex = hub.id;

    // replace all the values
    $("input[name='hubindex']").val(hubindex);
    $("input[name='hubhost']").val(hub.hubhost);
    $("input[name='clientid']").val(hub.clientid);
    $("input[name='clientsecret']").val(hub.clientsecret);
    $("input[name='useraccess']").val(hub.useraccess);
    $("input[name='userendpt']").val(hub.userendpt);
    $("input[name='hubname']").val(hub.hubname);
    $("input[name='hubid']").val(hub.hubid);
    $("input[name='hubtimer']").val(hub.hubtimer);
    $("input[name='hubaccess']").val(hub.hubaccess);
    $("input[name='hubendpt']").val(hub.hubendpt);
    $("input[name='hubrefresh']").val(hub.hubrefresh);
    $("select[name='hubtype']").val(hub.hubtype);
    var clientLabel = "Client ID: ";
    var secretLabel = "Client Secret: ";
    var hideaccess = $("#hideaccess_hub");
    $("#inp_hubid").hide();
    hideaccess.hide();
    $("#inp_clientid").show();
    $("#inp_clientsecret").show();

    if ( hubId==="new" ) {
        $("select[name='hubtype']").val("Hubitat").prop("disabled", false);
        $("input[name='hubhost']").prop("disabled", false);
        $("input[name='hubname']").prop("disabled", false);
        $("input[name='hubhost']").val("https://oauth.cloud.hubitat.com");
        $("input[name='hubname']").val("Hubitat Home");
        $("input.hubauth").removeClass("hidden");
        $("input.hubdel").addClass("hidden");
        hideaccess.show();
        $("#newthingcount").html("Fill out the fields below, starting with selecting a hub type to add a new hub");
    } else if ( hubId==="-1" ) {
        $("select[name='hubtype']").prop("disabled", true);
        $("input[name='hubhost']").prop("disabled", true);
        $("input[name='hubname']").prop("disabled", true);
        $("input.hubdel").addClass("hidden");
        $("input.hubauth").addClass("hidden");
        $("#inp_clientid").hide();
        $("#inp_clientsecret").hide();
        hideaccess.hide();
        $("#newthingcount").html("This \"hub\" is reserved for things not associated with a real hub. It cannot be altered, removed, or authorized. " +
                                 "You can change the Refresh timer before returning to main page to change how often special tiles get updated."
        );
    } else {
        // existing hubs, don't allow type to be changed
        $("select[name='hubtype']").prop("disabled", true);
        $("input[name='hubhost']").prop("disabled", false);
        $("input[name='hubname']").prop("disabled", false);
        $("input.hubauth").removeClass("hidden");
        $("input.hubdel").removeClass("hidden");
        $("#newthingcount").html("Re-authorize or delete the " + hub.hubname + " (" + hub.hubtype + ") hub/account here. " +
                                 "You can change the Refresh timer before returning to main page to change how often " + hub.hubtype + " tiles get updated."
        );
        if ( hub.hubtype === "ISY" ) {
            clientLabel = "Username: ";
            secretLabel = "Password: ";    
        } else if ( hub.hubtype === "Ford" || hub.hubtype === "Lincoln" ) {
            $("input[name='hubhost']").prop("disabled", true);
        } else if ( hub.hubtype === "Hubitat" ) {
            hideaccess.show();
        } else if ( hub.hubtype === "Sonos" ) {
            $("input[name='hubhost']").prop("disabled", true);
            $("#inp_clientid").hide();
            $("#inp_clientsecret").hide();
        } else if ( hub.hubtype === "NewSmartThings" ) {
            $("#inp_clientid").hide();
            $("#inp_clientsecret").hide();
            $("input[name='hubhost']").prop("disabled", true);
        }
    }
    $("#labelclientId").html(clientLabel);
    $("#labelclientSecret").html(secretLabel);
}

function addEditLink() {

    // add links to edit and delete this tile
    $("div.panel > div.thing").each(function() {
        var editdiv = "<div class=\"editlink\" aid=" + $(this).attr("id") + "> </div>";
        var cmzdiv = "<div class=\"cmzlink\" aid=" + $(this).attr("id") + ">" + $(this).attr("tile")  + "</div>";
        var deldiv = "<div class=\"dellink\" aid=" + $(this).attr("id") + "> </div>";
        // var resetdiv = "<div class=\"rstlink\" aid=" + $(this).attr("id") + ">R</div>";
        var sizediv = "<div class=\"sizelink ui-resizable-handle ui-resizable-se\"> </div>";
        $(this).append(cmzdiv).append(editdiv).append(deldiv).append(sizediv);
    });
    $("div.panel > div.thing[style*='absolute']").each(function() {
        var resetdiv = "<div class=\"rstlink\" aid=" + $(this).attr("id") + ">R</div>";
        $(this).append(resetdiv);
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

    $("div.editlink").off("click");
    $("div.editlink").on("click",function(evt) {
        evt.stopPropagation();
        var taid = $(evt.target).attr("aid");
        var thing = "#" + taid;
        var aid = taid.substring(2);
        var str_type = $(thing).attr("type");
        var tile = $(thing).attr("tile");
        var strhtml = $(thing).html();
        var thingclass = $(thing).attr("class");
        var pagename = $(thing).attr("panel")
        var bid = $(thing).attr("bid");
        var hubid = $(thing).attr("hub");
        var hubindex = $(thing).attr("hubindex");
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
        // cm_Globals.edited = true;

        editTile(userid, thingid, pagename, str_type, tile, aid, bid, thingclass, hubid, hubindex, hubType, customname, strhtml);
    });
    
    $("div.cmzlink").off("click");
    $("div.cmzlink").on("click",function(evt) {
        evt.stopPropagation();
        var taid = $(evt.target).attr("aid");
        var thing = "#" + taid;
        var aid = taid.substring(2);
        var pwsib = $(evt.target).siblings("div.overlay.password");
        var userid = cm_Globals.options.userid;
        if ( pwsib && pwsib.length > 0 ) {
            pw = pwsib.children("div.password").html();
            checkPassword(thing, "Tile customize", pw, false, "", runCustom);
            priorOpmode = "Edit";
        } else {
            runCustom(thing," ", false);
        }
        function runCustom(thing, name, ro, thevalue) {
            var str_type = $(thing).attr("type");
            var tile = $(thing).attr("tile");
            var bid = $(thing).attr("bid");
            var hubid = $(thing).attr("hub");
            customizeTile(userid, tile, aid, bid, str_type, hubid);
        }
    });
    
    $("div.dellink").off("click");
    $("div.dellink").on("click",function(evt) {
        evt.stopPropagation();
        var regheight = parseInt($("#dragregion").height() * 0.7);
        var thing = "#" + $(evt.target).attr("aid");
        var thingtype = $(thing).attr("type");
        var tile = $(thing).attr("tile");
        var bid = $(thing).attr("bid");
        var panel = $(thing).attr("panel");
        var tilename = $(thing).find(".thingname").text();
        var offset = $(thing).offset();
        var thigh = offset.top + parseInt($(thing).height());
        var twide = $(thing).width();
        var tleft = offset.left - 600 + twide;
        if ( tleft < 10 ) { tleft = 10; }
        thigh = (thigh > regheight) ? regheight : thigh;
        var pos = {top: thigh, left: tleft, width: 600, height: 80};
        var roomid = $("#panel-"+panel).attr("roomid");
        var thingid = $(thing).attr("thingid");
        var hubid = $(thing).attr("hub");
        var userid = cm_Globals.options.userid;
        var pname = cm_Globals.options.pname;

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
            closeModal("modaladd");
        });
        
    });

    $("div.rstlink").off("click");
    $("div.rstlink").on("click",function(evt) {
        var taid = $(evt.target).attr("aid");
        var thing = "#" + taid;
        var str_type = $(thing).attr("type");
        var tile = $(thing).attr("tile");
        var thingid = $(thing).attr("thingid");
        var panel = $(thing).attr("panel");

        evt.stopPropagation();

        // remove custom size settings for this tile
        var target = getCssRuleTarget(str_type, 'wholetile', tile, "thistile");
        var rule1 = "width:";
        var rule2 = "height:";
        removeCSSRule(target, tile, rule1, "thistile");
        removeCSSRule(target, tile, rule2, "thistile");

        // reset the position of just this tile to be relative and save the reset widths
        var startPos = {top: 0, left: 0, "z-index": 1, position: "relative"};
        if (str_type==="bulb") {
            var zmax = getMaxZindex(panel) + 1;
            startPos["z-index"] = zmax;    
        }

        $.post(cm_Globals.returnURL, 
            {useajax: "setposition", userid: cm_Globals.options.userid, type: str_type, attr: startPos, tileid: tile, thingid: thingid},
            function (presult, pstatus) {
                if ( pstatus === "success" ) {
                    console.log(presult);
                    saveTileEdit(cm_Globals.options.userid, str_type, tile);
                }
            }
        );
    });

    $("#roomtabs div.delpage").off("click");
    $("#roomtabs div.delpage").on("click",function(evt) {
        var roomnum = $(evt.target).attr("roomnum");
        var roomname = $(evt.target).attr("roomname");
        var roomid = $("#panel-"+roomname).attr("roomid");
        var clickid = $(evt.target).parent().attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        var pname = cm_Globals.options.pname;
        createModal("modaldel","Remove Room #" + roomnum + " with Name: " + roomname +" from HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
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
                        if (pstatus==="success" && (typeof presult !== "string" || !presult.startsWith("error")) ) {
                            // remove it visually
                            $("li[roomnum="+roomnum+"]").remove();
                        }
                    }
                );
            }
            closeModal("modaldel");
        });
        
    });
    
    $("#roomtabs div.editpage").off("click");
    $("#roomtabs div.editpage").on("click",function(evt) {
        var roomnum = $(evt.target).attr("roomnum");
        var roomname = $(evt.target).attr("roomname");
        var roomid = $("#panel-"+roomname).attr("roomid");
        // console.log("editing room: ", roomid, roomnum, roomname);
        editTile(cm_Globals.options.userid, roomid, roomname, "page", roomname, 0, 0, "", "-1", 0, "None", roomname);
    });
   
    $("#addpage").off("click");
    $("#addpage").on("click",function(evt) {
        // var clickid = $(evt.target).attr("aria-labelledby");
        var pos = {top: 100, left: 10};
        var panelid = $("input[name='panelid']").val();
        var pname = cm_Globals.options.pname;
        createModal("modaladd","Add New Room to HousePanel. Are you sure?", "body" , true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: "pageadd", userid: cm_Globals.options.userid, id: "none", panelid: panelid, pname: pname},
                    function (presult, pstatus) {
                        if (pstatus==="success" && typeof presult === "object" ) {
                            // console.log("Added room: ", presult);
                            window.location.href = cm_Globals.returnURL;
                        } else {
                            console.log("status: ", pstatus, " result: ", presult);
                        }
                    }
                );
            }
            closeModal("modaladd");
        });
        
    });    

    $("#catalog").show();
    
}

function delEditLink() {
    $("div.editlink").each(function() {
       $(this).remove();
    });
    $("div.cmzlink").each(function() {
       $(this).remove();
    });
    $("div.dellink").each(function() {
       $(this).remove();
    });
    $("div.rstlink").each(function() {
        $(this).remove();
     });
     $("div.sizelink").each(function() {
        $(this).remove();
     });
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
    $('input[name="useroptions[]"]').on("click", updateClick);

    // hub specific filter
    $('input[name="huboptpick"]').on("click", function() {
        // get the id of the hub type we just picked
        pickedhub = $(this).val();
        cm_Globals.hubId = pickedhub;
        setCookie("defaultHub", cm_Globals.hubId);

        // reset all filters using hub setting
        $('input[name="useroptions[]"]').each(updateClick);
    });

    $("div#thingfilters").on("click", function() {
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
    
    $("#allid").on("click", function() {
        $('input[name="useroptions[]"]').each(function() {
            $(this).prop("checked",true);
            $(this).attr("checked",true);
        });
        
        // update the main table using standard logic
        $('input[name="useroptions[]"]').each(updateClick);
    });
    
    $("#noneid").on("click", function() {
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
    cm_Globals.tabs = ! cm_Globals.tabs;
    if ( cm_Globals.tabs ) {
        $("#roomtabs").removeClass("hidden");
        $("#hpmenu").css("float","left");
    } else {
        $("#roomtabs").addClass("hidden");
        $("#hpmenu").css("float","none");
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

    // do nothing if this is not an objvect
    if ( !aid || !presult || typeof presult !== "object" ) {
        return;
    }
    
    var isclock = false;
    
    // do something for each tile item returned by ajax call
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
            // fix value if it is a command
            var pn = parseInt($(targetid).attr("pn"));
            if ( (isNaN(pn) || pn > 0) && key.startsWith("_") ) {
                value = key.substring(1);
            }
            isclock = isclock || processKeyVal(targetid, aid, key, value);
        }        
    }
    
    // if we updated a clock skin render it on the page
    if ( isclock ) {
        CoolClock.findAndCreateClocks();
    }
}

function updateLink(bid, pvalue) {

    // do nothing if this is not an objvect
    if ( !bid || !pvalue || typeof pvalue !== "object" ) {
        return;
    }
    
    // handle links - this new logic will update links even when source tile is not on a page
    var items = $('div.panel div[command="LINK"][linkbid="'+bid+'"]');
    if (items) {
        try {
            var isclock = false;
            items.each( function() {
                var sibid = $(this).attr("aid");
                var sibling = $(this).next();
                if ( sibling && sibling.hasClass("arrow-dn") ) {
                    sibling = sibling.next();
                }
                if ( sibling ) {
                    var linktargetid = "#" + sibling.attr("id");
                    var key = $(linktargetid).attr("subid");
                    var value = pvalue[key];
                    if ( typeof value === "undefined" ) {
                        key = $(this).attr("linktype");
                        value = pvalue[key];
                    }

                    // fix value if it is a command
                    var pn = parseInt($(linktargetid).attr("pn"));
                    if ( (isNaN(pn) || pn > 0) && key.startsWith("_") ) {
                        value = key.substring(1);
                    }
                    isclock = isclock || processKeyVal(linktargetid, sibid, key, value);
                }
            });
            // if we updated a clock skin render it on the page
            if ( isclock ) {
                CoolClock.findAndCreateClocks();
            }
        } catch (e) {
            console.log("Error updating linked tile with bid: ", bid, " pvalue: ", pvalue, " error: ", e);
        }
    }
}

function processKeyVal(targetid, aid, key, value) {

    // fix images to use width and height if custom items are in this tile
    // handle native track images - including audio devices above
    var oldvalue = $(targetid).html();
    var isclock = false;

    // swap out blanks from old value and value
    if ( oldvalue && typeof oldvalue === "string" ) {
        oldvalue = oldvalue.trim();
    }

    // remove spaces from class
    if ( value && typeof value === "string" ) {
        value = value.trim();
    }
    var extra = value;

    // remove the old class type and replace it if they are both
    // single word text fields like open/closed/on/off
    // this avoids putting names of songs into classes
    // also only do this if the old class was there in the first place
    // also handle special case of battery and music elements
    if ( key.startsWith("battery") ) {
        var powmod = parseInt(value);
        powmod = powmod - (powmod % 10);
        value = "<div style=\"width: " + powmod.toString() + "%\" class=\"ovbLevel L" + powmod.toString() + "\"></div>";

    // if we are updating a command, change text to the command name
    } else if ( key.startsWith("_") ) {
        value = key.substring(1);

    // // handle weather icons that were not converted
    } else if ( key==="weatherCode" && !isNaN(+value)  ) {
        $.post(cm_Globals.returnURL, 
            {api: "weathericon", userid: cm_Globals.options.userid, type: "tomorrowio", value: value},
            function (presult, pstatus) {
                if ( pstatus==="success" ) {
                    console.log("weatherCode result: ", presult);
                    $(targetid).html(presult);
                }
            }
        );
        return isclock;

    } else if ( (key==="weatherIcon" || key==="forecastIcon") && !isNaN(+value) ) {
        $.post(cm_Globals.returnURL, 
            {api: "weathericon", userid: cm_Globals.options.userid, type: "hubitat", value: value},
            function (presult, pstatus) {
                if ( pstatus==="success" ) {
                    $(targetid).html(presult);
                }
            }
        );
        return isclock;
    //     var iconimg;
    //     if ( Number.isNaN(icondigit) ) {
    //         iconimg = value;
    //     } else {
    //         var iconstr = icondigit.toString();
    //         if ( icondigit < 10 ) {
    //             iconstr = "0" + iconstr;
    //         }
    //         iconimg = "media/Weather/" + iconstr + ".png";
    //     }
    //     value = "<img src=\"" + iconimg + "\" alt=\"" + iconstr + "\" width=\"80\" height=\"80\">";
    } else if ( (key === "level" || key=== "onlevel" || key==="volume" || key==="groupVolume" || key==="position") && $(targetid).slider ) {
        $(targetid).slider("value", value);
        $(targetid).attr("value",value);
        value = false;
        oldvalue = false;

    // handle button fields that are input values
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
    } else {
        if ( typeof oldvalue === "string" ) {
            oldvalue = oldvalue.replace(/ /g,"_");
        }
        if ( typeof extra === "string" ) {
            extra = extra.replace(/ /g,"_");
        }
        if ( oldvalue && extra && 
            key!=="name" && key!=="trackImage" && key!=="temperature" &&
            key!=="trackDescription" && key!=="mediaSource" &&
            key!=="currentArtist" && key!=="currentAlbum" &&
            isNumeric(extra)===false && 
            isNumeric(oldvalue)===false &&
            $(targetid).hasClass(oldvalue) ) 
        {
            if ( key !== oldvalue ) {
                $(targetid).removeClass(oldvalue);
            }
            $(targetid).addClass(extra);
        }
    }

    // update the content 
    if (oldvalue || value) {
        try {
            $(targetid).html(value);
        } catch (err) {}
    }
    return isclock;
}

function refreshTile(tileid, aid, bid, thetype, hubid) {
    var pname = cm_Globals.options.pname;
    try {
        $.post(cm_Globals.returnURL, 
            {api: "doquery", userid: cm_Globals.options.userid, pname: pname, id: bid, tileid: tileid, type: thetype, hubid: hubid},
            function (presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult==="object" ) {
                    updateTile(aid, presult);
                    updateLink(bid, presult);
                }
            }, 
        "json");
        

    } catch(e) { }
}

// refresh tiles on this page when switching to it
function setupTabclick() {
    $("a.ui-tabs-anchor").on("click",function() {
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
    // var d = new Date();

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
        var pname = cm_Globals.options.pname;
        if ( !pname ) { pname = "default"; }

        // make a mini configoptions object for just clocks
        var clockoptions = [];
        var opt1 = {userid: userid, configkey: "user_clockdigital", configval: cm_Globals.options.rules["user_clockdigital"]};
        var opt2 = {userid: userid, configkey: "user_clockanalog", configval: cm_Globals.options.rules["user_clockanalog"]};
        clockoptions.push(opt1);
        clockoptions.push(opt2);

        $.post(cm_Globals.returnURL, 
            {useajax: "getclock", userid: userid, pname: pname, id: whichclock, thingid: thingid, tileid: tileid, type: "clock", attr: clockoptions},
            function (presult, pstatus) {
                if ( pstatus==="success" && presult && typeof presult==="object" ) {
                    cm_Globals[whichclock] = presult;
                    updateClock(whichclock, cm_Globals[whichclock]);
                }
            }, "json"
        );
    }

    function updateClock(clocktype, clockdevice) {
        // we have to do this to get real-time secones display
        clockdevice.time = getFormattedTime(clockdevice.fmt_time, clockdevice.tzone);

        // only update the time elements
        var updobj = {time: clockdevice.time, date: clockdevice.date, weekday: clockdevice.weekday};

        // update all the clock tiles for this type
        $('div.panel div.thing[bid="'+clocktype+'"]').each(function() {
            var aid = $(this).attr("aid");
            updateTile(aid, updobj);
        });
        updateLink(clocktype, updobj);

    }

}

function setupTimer(timertype, timerval, hub) {

    // we now pass the unique hubId value instead of numerical hub
    // since the number can now change when new hubs are added and deleted
    if ( !hub || !timerval || timerval < 1000 ) {
        return;
    }
    var hubid = hub.hubid;
    var updarray = [timertype, timerval, hubid];
    updarray.myMethod = function() {

        var that = this;
        if ( priorOpmode === "Operate" ) {
            try {
                // just do the post and nothing else since the post call pushClient to refresh the tiles
                var tType = that[0];
                var hubid = that[2];
                $("div[hub='" + hubid+"']").each( function() {
                    var tileid = $(this).attr("tile");
                    var aid = $(this).attr("aid");
                    var bid = $(this).attr("bid");
                    var thetype = $(this).attr("type");
                    refreshTile(tileid, aid, bid, thetype, hubid);
                });

            } catch(err) {
                console.error ("Polling error", err.message);
            }
        }

        // repeat the method above indefinitely
        // console.log("timer: ", that[0], that[1], that[2], priorOpmode);
        setTimeout(function() {updarray.myMethod();}, that[1]);
    };

    // wait before doing first one
    setTimeout(function() {updarray.myMethod();}, timerval);
}

// setup clicking on the action portion of this thing
// this used to be done by page but now it is done by sensor type
function setupPage() {

    $("div.thing div.overlay.name").off("doubletap");
    $("div.thing div.overlay.name").on("doubletap", function(evt) {
    // $("div.panel div.thing[tile]").on("doubletap", function(evt) {
        evt.stopPropagation();

        if ( priorOpmode=="Operate" ) {
            var thing = $(this).parent();
            var aid = $(thing).attr("aid");
            var str_type = $(thing).attr("type");
            var tile = $(thing).attr("tile");
            var strhtml = $(thing).html();
            var thingclass = $(thing).attr("class");
            var pagename = $(thing).attr("panel")
            var bid = $(thing).attr("bid");
            var hubid = $(thing).attr("hub");
            var hubindex = $(thing).attr("hubindex");
            var hubType = $(thing).attr("hubtype");
            var thingid = $(thing).attr("thingid");
            var userid = cm_Globals.options.userid;
            try {
                var customname = $("#a-"+aid+"-name").html();
            } catch(e) {
                customname = $("#s-"+aid).html();
            }
            strhtml = strhtml.replace(/ id="/g, " id=\"x_");
            editTile(userid, thingid, pagename, str_type, tile, aid, bid, thingclass, hubid, hubindex, hubType, customname, strhtml);
        }
    });

    $("div.thing div.thingname").off("tap");
    $("div.thing div.thingname").on("tap", function(evt) {
        var thevalue = $(this).html()
        processClick(this, thevalue, true, thevalue);
        evt.stopPropagation();
    });

    $("div.thing div.overlay > div").off("singletap");
    $("div.thing div.overlay > div").on("singletap", function(evt) {

        var that = this;
        var aid = $(this).attr("aid");
        var subid = $(this).attr("subid");
        var id = $(this).attr("id");
        try {
            var pn = parseInt($(this).attr("pn"));
            if ( isNaN(pn) ) { pn = 0; }
        } catch(e) {
            pn = 0;
        }
        
        // avoid doing click if the target was the title bar
        // also skip sliders using class method to get all of them
        if ( ( typeof aid==="undefined" ) || 
             ( $(this).hasClass("ui-slider") ) ||
             ( id && id.startsWith("s-") ) ) {
            return;
        }
        
        // var tile = '#t-'+aid;
        var doconfirm = $(this).hasClass("confirm") || subid.startsWith("c__");
        var trigger = subid;
        if ( subid.startsWith("c__") ) {
            trigger = subid.substring(3);
        }
        var thetype = $(that).attr("type");
        var thingname = $("#s-"+aid).html();
        var targetid = '#a-'+aid+'-'+subid;
        if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
            var slen = subid.length;
            targetid = '#a-'+aid+'-'+subid.substring(0,slen-3);
        }
        var thevalue = $(targetid).html();
        
        // handle special control type tiles that perform javascript actions
        // if we are not in operate mode only do this if click is on operate
        // also skip links to web calls that have the control type
        if ( subid!=="name" && thetype==="control" && (priorOpmode==="Operate" || subid==="operate") && 
             !thevalue.startsWith("URL::") && !thevalue.startsWith("POST::") && !thevalue.startsWith("GET::") && !thevalue.startsWith("PUT::") && !thevalue.startsWith("RULE::") ) {
            evt.stopPropagation();
            if ( doconfirm ) {
                var pos = {top: 100, left: 100};
                createModal("modalexec","<p>Perform " + trigger + " operation ... Are you sure?</p>", "body", true, pos, function(ui) {
                    var clk = $(ui).attr("name");
                    closeModal("modalexec");
                    if ( clk==="okay" ) {
                        execButton(trigger);
                    }
                });
            } else {
                execButton(trigger);
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

        // check for clicking on a password field
        // or any other field of a tile with a password sibling
        // this can only be true if user has added one using tile customizer
        var pw = false;
        if ( subid==="password" ) {
            pw = false;
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
        if ( pw!==false && typeof pw === "string" && pw!=="false" ) {
            checkPassword(that, thingname, pw, ro, thevalue, processClick);
        
        // handle buttons by searching for sibling that has number of buttons listed
        // this won't be found if the button is a link so we just make user put in a number
        } else if ( subid==="_push" || subid==="_hold" || subid==="_doubleTap" || subid==="_release" ) {
                    // subid==="pushed" || subid==="held" || subid==="doubleTapped" || subid==="released" ) {
            var numbtnid = '#a-'+aid+'-numberOfButtons';
            if ( $(numbtnid) && isNumeric($(numbtnid).html()) ) {
                var numButtons = parseInt($(numbtnid).html());
                var thelist = [];
                for (var i = 1; i <= numButtons; i++) {
                   thelist.push(i.toString());
                }                
                processClickWithList(that, thingname, ro, subid, thelist, "Button #");
            } else {
                processClickWithValue(that, thingname, ro, subid, "", 1);
            }

        // various known special cases where we select from a list
        } else if ( subid === "_setMotion") {
            processClickWithList(that, thingname, ro, subid, ["active","inactive"]);

        } else if ( subid === "thermostatMode" || subid==="_setThermostatMode") {
            processClickWithList(that, thingname, ro, "_setThermostatMode", ["heat","cool","auto","off"]);

        } else if ( subid === "thermostatFanMode" || subid==="_setThermostatFanMode") {
            processClickWithList(that, thingname, ro, "_setThermostatFanMode", ["auto","on","circulate"]);

        } else if ( subid === "_setChirp") {
            processClickWithList(that, thingname, ro, subid, ["ding-dong","harp","navi","wind-chime","none"]);
       
        } else if ( subid === "_startPositionChange") {
            processClickWithList(that, thingname, ro, subid, ["open","close"]);
       
        } else if ( subid === "_startLevelChange") {
            processClickWithList(that, thingname, ro, subid, ["up","down"]);

        } else if ( subid === "themode" ) {
            processClickWithList(that, thingname, ro, subid, ["Day","Evening","Night","Away"]);
       
        // handle commands that have parameters required
        // this is signalled by the value set otherwise the command value is the command string name
        } else if ( subid.startsWith("_") && isNumeric(thevalue) ) {
            var numParams = parseInt(thevalue);
            if ( isNaN(numParams) ) { numParams = 0; }
            processClickWithValue(that, thingname, ro, subid, "", numParams);

        } else if ( pn > 0 ) {
            processClickWithValue(that, thingname, ro, subid, "", pn);

        // items that require one parameter
        } else if ( subid==="color" || 
                    (subid.startsWith("Int_") && !subid.endsWith("-up") && !subid.endsWith("-dn") )|| 
                    (subid.startsWith("State_") && !subid.endsWith("-up") && !subid.endsWith("-dn") ) ||
                    subid==="heatingSetpoint" || subid==="coolingSetpoint" || subid==="_docmd" ||
                    subid==="_setHeatingSetpoint" || subid==="_setCoolingSetpoint" ||
                    subid==="ecoHeatPoint" || subid==="ecoCoolPoint" ||
                    (thetype==="variables" && subid!=="name" && !thevalue.startsWith("RULE::")) || 
                    subid==="hue" || subid==="saturation" ) {
            processClickWithValue(that, thingname, ro, subid, thevalue, 1);
        } else {

            if ( doconfirm && !ro ) {
                var tpos = $(that).offset();
                var ttop = (tpos.top > 125) ? tpos.top - 120 : 5;
                var pos = {top: ttop, left: tpos.left};
                createModal("modalexec","<p>Perform " + trigger + " operation</p><p>Are you sure?</p>", "body", true, pos, function(ui) {
                    var clk = $(ui).attr("name");
                    closeModal("modalexec");
                    if ( clk==="okay" ) {
                        evt.stopPropagation();
                        processClick(that, thingname, ro, thevalue);
                    }
                });
            } else {
                evt.stopPropagation();
                processClick(that, thingname, ro, thevalue);
            }
        }
        evt.stopPropagation();

    });
   
}

function checkPassword(tile, thingname, pw, ro, thevalue, yesaction) {

    var userpw = "";
    var tpos = $(tile).offset();
    var ttop = (tpos.top > 95) ? tpos.top - 90 : 5;
    var pos = {top: ttop, left: tpos.left};
    var pname = cm_Globals.options.pname;
    var htmlcontent;
    if ( pw==="" ) {
        htmlcontent = "<p>Operate action for: " + thingname + "</p><p>Are you sure?</p>";
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
                yesaction(tile, thingname, ro, thevalue);
            } else {
                userpw = $("#userpw").val();
                $.post(cm_Globals.returnURL, 
                    {useajax: "pwhash", userid: cm_Globals.options.userid, pname: pname, id: "none", type: "verify", value: userpw, attr: pw},
                    function (presult, pstatus) {
                        if ( pstatus==="success" && presult==="success" ) {
                            // console.log("Protected tile [" + thingname + "] access granted.");
                            yesaction(tile, thingname, ro, thevalue);
                        } else {
                            console.log("Protected tile [" + thingname + "] access denied.");
                        }
                    }
                );

            }
        } else {
            console.log("Protected tile [" + thingname + "] access cancelled.");
        }
        closeModal("modalexec");
    },
    // after box loads set focus to pw field
    function(hook, content) {
        $("#userpw").focus();
        
        // set up return key to process and escape to cancel
        $("#userpw").off("keydown");
        $("#userpw").on("keydown",function(e) {
            if ( e.which===13  ){
                $("#modalokay").trigger("click");
            }
            if ( e.which===27  ){
                $("#modalcancel").trigger("click");
            }
        });
    });
}

function processClickWithValue(tile, thingname, ro, subid, thevalue, numParams) {

    if ( numParams <= 0 ) {
        processClick(tile, thingname, ro, thevalue, "");
        return;
    }

    var tpos = $(tile).offset();
    var ttop = (tpos.top > 125) ? tpos.top - 120 : 5;
    var pos = {top: ttop, left: tpos.left};
    var htmlcontent;
    htmlcontent = "<p>Enter new value for tile: " + thingname + "</p>";
    if ( numParams > 1 ) {
        htmlcontent = htmlcontent + "<p>For: " + subid + "</p>";
        thevalue = "";
    }
    htmlcontent += "<div class='ddlDialog'>";
    
    for (var i = 1; i <= numParams; i++) {
        var id = "newsubid" + i.toString()
        if ( numParams > 1 ) {
            var prefix = "Param #" + i.toString();
        } else {
            prefix = subid;
        }
        htmlcontent += "<p><label for='" + id + "'>" + prefix + ": </label>";
        htmlcontent += "<input class='ddlDialog' id='" + id + "' type='text' size='20' value='" + thevalue + "' /></p>";
     }                
    htmlcontent += "</div>";
    
    createModal("modalexec", htmlcontent, "body", true, pos, 
    function(ui) {
        var clk = $(ui).attr("name");
        // priorOpmode = "Operate";
        if ( clk==="okay" ) {
            thevalue = "";
            for (var i = 1; i <= numParams; i++) {
                var id = "#newsubid" + i.toString()
                thevalue = thevalue + $(id).val();
                if ( i < numParams ) {
                    thevalue = thevalue + "|";
                }
            }
            processClick(tile, thingname, ro, thevalue, "");
        }
        closeModal("modalexec");
    },
    // after box loads set focus to field
    function(hook, content) {
        // priorOpmode = "Modal";
        $("#newsubidValue").focus();
        $("#newsubidValue").off("keydown");
        $("#newsubidValue").on("keydown",function(e) {
            if ( e.which===13  ){
                // priorOpmode = "Operate";
                $("#modalokay").trigger("click");
            }
            if ( e.which===27  ){
                // priorOpmode = "Operate";
                $("#modalcancel").trigger("click");
            }
        });
    });
}

function processClickWithList(tile, thingname, ro, subid, thelist, prefix = "") {
    var tpos = $(tile).offset();
    var ttop = (tpos.top > 125) ? tpos.top - 120 : 5;
    var pos = {top: ttop, left: tpos.left};
    var htmlcontent;
    htmlcontent = "<p>Select value from list for tile: " + thingname + "</p>";
    htmlcontent += "<div class='ddlDialog'><label for='picklist'>" + subid + ":</label>";
    htmlcontent += "<select id=\"picklist\" name=\"picklist\" class=\"picklist\">";
    thelist.forEach(function(val) {
        htmlcontent += "<option value=\"" + val + "\">" + prefix + val + "</option>";
    });
    htmlcontent += "</select></div>";
    
    createModal("modalpick", htmlcontent, "body", true, pos, 
    function(ui) {
        var clk = $(ui).attr("name");
        // priorOpmode = "Operate";
        if ( clk==="okay" ) {
            thevalue = $("#picklist").val();
            processClick(tile, thingname, ro, thevalue, "", subid);
        }
        closeModal("modalpick");
    },
    // after box loads set focus to field
    function(hook, content) {
        $("#picklist").focus();
        $("#picklist").off("keydown");
        $("#picklist").on("keydown",function(e) {
            if ( e.which===13  ){
                $("#modalokay").trigger("click");
            }
            if ( e.which===27  ){
                $("#modalcancel").trigger("click");
            }
        });
    });
}

// function stripOnoff(thevalue) {
//     var newvalue = thevalue.toLowerCase();
//     if ( newvalue==="on" || newvalue==="off" ) {
//         return " ";
//     } else if ( newvalue.endsWith("on") ) {
//         thevalue = thevalue.substring(0, thevalue.length-2);
//     } else if ( newvalue.endsWith("off") ) {
//         thevalue = thevalue.substring(0, thevalue.length-3);
//     }
//     if ( thevalue.substr(-1)!==" " && thevalue.substr(-1)!=="_" && thevalue.substr(-1)!=="-" && thevalue.substr(-1)!=="|" ) {
//         thevalue+= " ";
//     }
//     return thevalue;
// }

function addOnoff(targetid, subid, thevalue) {
    // thevalue = stripOnoff(thevalue);
    // if ( $(targetid).hasClass("on") ) {
    //     $(targetid).removeClass("on");
    //     $(targetid).addClass("off");
    //     $(targetid).html(thevalue+"On");
    //     thevalue = "off";
    // } else if ( $(targetid).hasClass("off") )  {
    //     $(targetid).removeClass("off");
    //     $(targetid).addClass("on");
    //     $(targetid).html(thevalue+"Off");
    //     thevalue = "on";
    // } else {
    //     if ( subid==="allon") {
    //         $(targetid).addClass("on");
    //         $(targetid).html(thevalue+"Off");
    //         thevalue = "on";
    //     } else if (subid==="alloff" ) {
    //         $(targetid).addClass("off");
    //         $(targetid).html(thevalue+"On");
    //         thevalue = "off";
    //     }
    // }

    // var thevalue;
    if ( subid==="allon") {
        thevalue = "on";
    } else if (subid==="alloff" ) {
        thevalue = "off";
    } else {
        thevalue = "toggle";
    }
    if ( !$(targetid).hasClass(thevalue) ) {
        $(targetid).addClass(thevalue);
    }
    return thevalue;
}

// the aid value is now exactly equal to thingid -- both are the index key in the DB
// for the main things table that holds the index keys for devices shown on pages
// tileid below is the index in the devices table to the absolute device information
function processClick(that, thingname, ro, thevalue, theattr = true, subid  = null) {
    var aid = $(that).attr("aid");
    if ( theattr===true ) {
        theattr = $(that).attr("class");
    } else if ( theattr===false ) {
        theattr = "";
    }
    if ( !subid ) {
        subid = $(that).attr("subid");
    }
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
    var pname = cm_Globals.options.pname;
    var targetid;
    if ( !subid ) {
        return;
    }

    if ( subid.endsWith("-up") || subid.endsWith("-dn") ) {
        var slen = subid.length;
        targetid = '#a-'+aid+'-'+subid.substring(0,slen-3);
    } else {
        if ( subid==="thingname" ) {
            targetid = "#s-"+aid;
        } else {
            targetid = '#a-'+aid+'-'+subid;
        }
    }

    // var thevalue = $(targetid).html();

    // if this is an edit field then do nothing
    if ( thevalue && typeof thevalue==="string" && (thevalue.startsWith("<input type=\"text\"") || thevalue.startsWith("<input type=\"number\"") ) ) {
        return;
    }

    // if any button edit field is clicked on do nothing since user is editing
    // if ( subid === "pushed" || subid==="released" || subid==="held" || subid==="doubleTapped" ) {
    //     return;
    // }

    // set attr to name for ISY hubs
    // if ( thetype === "isy" ) {
    //     theattr = $("#a-"+aid+"-name").html();
    // }
    var hint = $(tile).attr("hint");

    // all hubs now use the same doaction call name
    const ajaxcall = "doaction";

    // special case of thermostat clicking on things without values
    // send the temperature as the value
    if ( !thevalue && (thetype==="thermostat") && ($("#a-"+aid+"-temperature")!==null) &&
         ( subid.endsWith("-up") || subid.endsWith("-dn") ) ) {
        thevalue = $("#a-"+aid+"-temperature").html();
    }

    // determine if this is a LINK or RULE by checking for sb-aid sibling element
    // this includes setting the bid of the linked tile if needed
    // new logic based on DB version
    var usertile =  $("#sb-"+aid+"-"+subid);
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
            realsubid += subid.substring(subid.length-3);
        }
        linkid = usertile.attr("linkid");
        hint = usertile.attr("hint");
    }

    if ( typeof linkval === "string" && 
         (linkval.startsWith("GET::") || linkval.startsWith("POST::") || linkval.startsWith("TEXT::") ||
          linkval.startsWith("PUT::") || 
          linkval.startsWith("RULE::") || linkval.startsWith("URL::")) )
    {
        var jcolon = linkval.indexOf("::");
        command = linkval.substring(0, jcolon);
        linkval = linkval.substring(jcolon+2);
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
    var ispassive = (ro || subid==="thingname" || subid==="custom" || subid==="temperature" || subid==="feelsLike" || subid==="battery" || //  (command==="TEXT" && subid!=="allon" && subid!=="alloff") ||
        subid==="presence" || subid.startsWith("motion") || subid.startsWith("contact") || subid==="status_" || subid==="status" || subid==="deviceType" || subid==="localExec" ||
        subid==="time" || subid==="date" || subid==="tzone" || subid==="weekday" || subid==="name" || subid==="skin" || subid==="thermostatOperatingState" ||
        subid==="pushed" || subid==="held" || subid==="doubleTapped" || subid==="released" || subid==="numberOfButtons" || subid==="humidity" ||
        subid==="video" || subid==="frame" || subid=="image" || subid==="blank" || subid.startsWith("event_") || subid==="illuminance" ||
        (subid.startsWith("label")) || (subid.startsWith("text")) ||
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

        // reverse the values of on and off in upper and lower case
        if ( thevalue && (thevalue==="on" || thevalue==="off") ) {
            thevalue = thevalue==="on" ? "off" : "on";
        } else if ( thevalue  && (thevalue==="ON" || thevalue==="OFF") ) {
            thevalue = thevalue==="OFF" ? "OFF" : "ON";
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
    } else if ( subid==="allon" || subid==="alloff" ) {
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

            // force use of command mode by setting attr to blank
            theattr = "";
            if ( thevalue ) {
                $.post(cm_Globals.returnURL, 
                    {useajax: ajaxcall, userid: userid, pname: pname, id: bid, thingid: thingid, tileid: tileid, type: thetype, value: thevalue, roomid: roomid, hint: hint,
                     attr: theattr, subid: "switch", hubid: hubid, hubindex: linkhub, command: command, linkval: linkval} );
            }
        });

    } else if ( ispassive ) {
        var msg = "";
        msg += "thingname = " + thingname + "<br>";
        msg += "type = " + thetype + "<br>";
        msg += "hubtype = " + hubtype + "<br>";
        msg += "hubindex = " + linkhub + "<br>";
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
                    var batdiv = $(this).children().attr("style").substring(7);
                    msg += inspectsubid + " = " + batdiv + "<br>";
                } else if ( strval.indexOf("img src") !== -1 ) {
                    msg += inspectsubid + " =  (image)<br>";
                } else if ( inspectsubid==="level" || inspectsubid==="onlevel" || inspectsubid==="colorTemperature" || inspectsubid==="volume" || inspectsubid==="groupVolume" || inspectsubid==="position" ) {
                    msg += inspectsubid + " = " + $(this).attr("value") + "<br>";
                    // msg += inspectsubid + " = " + $(this).children().attr("style").substring(6) + "<br>";
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
        // console.log(msg);
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
        if ( subid.startsWith("switch") && (thevalue==="on" || thevalue==="off")  ) {
            thevalue = thevalue==="on" ? "off" : "on";
        }

        // remove isy type check since it could be a link
        else if ( subid.startsWith("switch") && (thevalue==="DON" || thevalue==="DOF" )  ) {
            thevalue = thevalue==="DON" ? "DOF" : "DON";
        }

        // invert open and close for doors and valves and set commaned
        else if ( (subid.startsWith("door") || subid.startsWith("valve")) && (thevalue==="open" || thevalue==="closed") ) {
            thevalue = thevalue==="open" ? "close" : "open";
        }

        // invert motion and set commaned
        else if ( subid.startsWith("motion") && (thevalue==="active" || thevalue==="inactive") ) {
            thevalue = thevalue==="active" ? "inactive" : "active";
        }

        // invert and set lock command
        else if ( subid.startsWith("lock") && (thevalue==="locked" || thevalue==="unlocked") ) {
            thevalue = thevalue==="locked" ? "unlock" : "lock";
        }

        // set value to volume for volume triggers
        else if ( subid==="_volumeDown" || subid==="_volumeUp" ) {
            var targetvol = '#a-'+aid+'-volume';
            thevalue = $(targetvol).attr("value");
        }

        console.log("userid= ", userid, " thingid= ", thingid, " tileid= ", tileid, " hint= ", hint,
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
        // alert("API call: " + ajaxcall + " bid: " + bid + " type: " + thetype + " value: " + thevalue + " subid: " + realsubid + " hint: " + hint + " hubid: " + hubid);

        $.post(cm_Globals.returnURL, 
            {useajax: ajaxcall, userid: userid, pname: pname, id: linkbid, thingid: thingid, type: linktype, value: thevalue, hint: hint,
                attr: theattr, subid: realsubid, hubid: hubid, hubindex: linkhub, tileid: tileid, command: command, linkval: linkval},
            function (presult, pstatus) {
                if (pstatus==="success") {
                    if ( presult && typeof presult === "object" ) {
                        console.log("Success: ", presult);
                    } else {
                        console.log(presult);
                    }
                }
            }, "json"
        );
    } 
}
