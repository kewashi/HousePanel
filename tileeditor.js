/* Tile Editor for HousePanel
 * 
 * Inspired by @nitwit on SmartThings forum
 * rewritten by Ken Washington @kewashi on the forum
 * 
 * Designed for use only with HousePanel
 * (c) Ken Washington 2017 - 2024
 * 
 */
var DEBUGte = false;
var et_Globals = {};
et_Globals.savedSheet = "";
et_Globals.priorIcon = "none";
et_Globals.tileCount = 0;
et_Globals.clipboard = [];

function editTile(userid, thingid, pagename, str_type, thingindex, uid, bid, thingclass, hubindex, hubType, customname, htmlcontent) {  
    var returnURL = cm_Globals.returnURL;
    et_Globals.id = bid;          // roomnum for pages
    et_Globals.hubindex = hubindex;
    et_Globals.hubType = hubType;
    et_Globals.pagename = pagename;
    et_Globals.roomnum = bid ? bid : 0;
    et_Globals.userid = userid;
    et_Globals.thingid = thingid;
    et_Globals.uid = uid;
    et_Globals.insubmenu = false;

    if ( str_type==="page" ) {
        et_Globals.wholetarget = getCssRuleTarget(str_type, "panel", pagename, "thistile");
    } else {
        et_Globals.wholetarget = getCssRuleTarget(str_type, "wholetile", thingindex, "thitile");
    }

    var dialog_html = `<div id='tileDialog' class='tileDialog' str_type='${str_type}' thingindex='${thingindex}' uid='${uid}'>`;
    if ( str_type==="page" ) {
        dialog_html += "<div class='editheader' id='editheader'>Editing Page #" + et_Globals.roomnum + 
                   ", Name: " + et_Globals.pagename + "</div>";
        
    } else {
        dialog_html += "<div class='editheader' id='editheader'>Editing Tile #" + uid + 
                   ", Type: " + str_type + "</div>";
    }

    // option on the left side
    dialog_html += "<div id='colorpicker'>";
    dialog_html += itempicker("", "");
    dialog_html += "</div>";

    // the middle section
    dialog_html += editSection(str_type, thingindex);
    
    // icons on the right side
    dialog_html += iconlist();
    
    // tileEdit display on the far right side 
    dialog_html += "<div id='tileDisplay' class='tileDisplay'>";
    dialog_html += "<div id='subsection'></div>";
    dialog_html += "<div id='editInfo' class='editInfo'>or Click Below</div>";
    
    // we either use the passed in content or make an Ajax call to get the content
    var jqxhr = null;
    if ( str_type==="page" ) {
        var roomnum = et_Globals.roomnum;
        jqxhr = $.post(returnURL, 
            {api: "pagetile", userid: userid, thingid: thingid, id: roomnum, type: 'page', value: pagename, pagename: pagename, attr: customname, hpcode: cm_Globals.options.hpcode},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    htmlcontent = presult;
                }
            }
        );
        
    } else if ( htmlcontent ) {
        htmlcontent = "<div class=\"" + thingclass + "\" id='te_wysiwyg'>" + htmlcontent + "</div>";
    } else {
        htmlcontent = "<div id='error' class='error'>Edit dialog cannot be displayed</div>";
    }
    dialog_html += "</div>";
    
    // * DIALOG_END *
    dialog_html += "</div>";
    
    // create a function to display the tile
    var dodisplay = function() {
        var pos = {top: 20, left: 20, zindex: 998};
        createModal("modaledit", dialog_html, "body", true, pos, 
            // function invoked upon leaving the dialog
            function(ui, content) {
                if ( et_Globals.insubmenu ) {
                    return;
                }

                $("document").off("keydown");
                // $("body").off("keypress");
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    saveTileEdit(userid, str_type, thingindex);
                } else if ( clk==="cancel" ) {
                    cancelTileEdit();
                }
                et_Globals.tileCount = 0;
                closeModal("modaledit");
            },
            // function invoked upon starting the dialog
            function() {

                // load the clipboard
                et_Globals.insubmenu = false;
                $.post(cm_Globals.returnURL,
                    {api: "clipboard", userid: userid, type: str_type, tile: thingindex, value: "", attr: "load", hpcode: cm_Globals.options.hpcode},
                    function (presult, pstatus) {
                        if (pstatus==="success" ) {
                            et_Globals.clipboard = presult;
                            $("#clipboard").val(et_Globals.clipboard.length + " items");
                        } else {
                            et_Globals.clipboard = [];
                        }
                    },"json"
                );

                if ( str_type==="page" ) {
                    setTimeout( function() {
                        var id = $("#x_tabon").attr("aria-labelledby");
                        $("#"+id).trigger("click");
                    }, 500);
                }

                $(document).on("keydown",function(e) {
                    if ( et_Globals.insubmenu ) {
                        return;
                    }
                    // console.log(e.which, typeof e.which);
                    if ( e.which===13  ){
                        saveTileEdit(et_Globals.userid, str_type, thingindex);
                        et_Globals.tileCount = 0;
                        closeModal("modaledit");
                        // $("#modalokay").trigger("click");
                    }
                    if ( e.which===27  ){
                        cancelTileEdit();
                        et_Globals.tileCount = 0;
                        closeModal("modaledit");
                        // $("#modalcancel").trigger("click");
                    }
                });
                $("#modaledit").draggable();
                
            }
        );
    };
    
    if ( jqxhr ) {
        jqxhr.done(function() {
            dodisplay();
            $("#editInfo").after(htmlcontent);
            et_Globals.tileCount++;
            if ( str_type==="page" ) {
                $("#x_tabs").tabs();
            }
            setupClicks(str_type, thingindex);
        });
    } else {
        dodisplay();
        $("#editInfo").after(htmlcontent);
        et_Globals.tileCount++;
        setupClicks(str_type, thingindex);
    }
    
}

$.fn.isAuto = function(dimension){
    // will detect auto widths including percentage changes
    return ( (dimension==="width" || dimension==="height") && this.css(dimension) === "auto" );
};

function getOnOff(str_type, subid, val) {
    var onoff;
    var hubType = et_Globals.hubType;

    // handle the cases for custom tiles that could have any subid starting with valid names
    // get rid of flash since the state actually never gets set by the Hubitat hub
    if ( subid.startsWith("switch" ) ) {
        if ( str_type==="isy" || str_type==="isysub" ) {
            onoff = ["DON","DOF"];
        } else {
            onoff = ["on","off"];
        }
    } else if ( subid.startsWith("ecoMode") ) {
        onoff = ["ON","OFF"];
    } else if ( subid.startsWith("momentary") ) {
        onoff = ["on","off"];
    } else if ( subid.startsWith("underbedLightState") ) {
        onoff = ["Auto","On","Off"];
    } else if ( subid.startsWith("underbedLightBrightness") ) {
        onoff = ["Off","Low","Medium","High"];
    } else if ( subid.startsWith("button") ) {
        onoff = ["pushed","held","released","doubleTapped"];
    } else if ( subid.startsWith("contact" ) || subid.startsWith("valve" ) ) {
        onoff = ["open","closed"];
    } else if ( subid.startsWith("door" ) ) {
        onoff = ["open","closed", "opening", "closing","unknown"];
    } else if ( subid.startsWith("lock" ) ) {
        onoff = ["locked","unlocked","unknown"];
    } else if ( subid.startsWith("motion") ) {
        onoff = ["active","inactive"];
    } else if ( subid.startsWith("roomState") ) {
        onoff = ["occupied", "unoccupied"];
    } else if ( subid.startsWith("roomActivity") ) {
        onoff = ["towards", "away", "enter", "leave"];
    } else if ( subid.startsWith("water") ) {
        onoff = ["dry","wet"];
    } else if ( subid.startsWith("smoke") ) {
        onoff = ["clear","tested","detected"];
    } else if ( subid.startsWith("carbonMonoxide") ) {
        onoff = ["clear","tested","detected"];
    } else if ( subid.startsWith("windowShade") || subid.startsWith("windowBlind") ) {
        onoff = ["open","closed","opening","closing","partially_open","unknown"];
    } else if ( subid.startsWith("pistonName" ) ) {
        onoff = ["firing","idle"];
    } else if ( subid.startsWith("thermostatFanMode" ) ) {
        if ( str_type==="isy" || str_type==="isysub" ) {
            onoff = ["Auto", "On", "Circulate"];
        } else {
            onoff = ["auto","on","followschedule","circulate"];
        }
    } else if ( subid.startsWith("thermostatMode" ) ) {
        onoff = ["heat","cool","auto","off","emergency_heat"];
    } else if ( str_type==="thermostat" && subid.startsWith("temperature" ) ) {
        onoff = ["idle","heating","cooling","off"];
    } else if ( subid.startsWith("thermostatOperatingState" ) ) {
        onoff = ["idle","heating","cooling","off","fan_only","pending_heat","pending_cool"];
    } else if ( subid.startsWith("musicstatus" ) || subid.startsWith("playbackStatus") ) {
        onoff = ["stopped","paused","playing"];
    } else if ( subid.startsWith("musicmute" ) || (str_type==="audio" && subid.startsWith("mute")) ) {
        onoff = ["muted","unmuted"];
    } else if ( subid.startsWith("presence_type" ) ) {
        onoff = ["enter","leave","approach","away","left_enter","left_leave","right_enter","right_leave"];
    } else if ( subid.startsWith("presence" ) ) {
        onoff = ["present","absent","not_present","unknown"];
    } else if ( str_type==="hsm" && subid.startsWith("state") ) {
        onoff = ["armedAway", "armingAway", "armedHome", "armingHome", "armedNight", "armingNight", "disarmed", "allDisarmed"];
    } else if ( subid.startsWith("themode" ) ) {
        onoff = [];
        // get all the unique modes supported by this location
        $("div.mode-thing").find("div.overlay > div.mode").each( function(index) {
            var subid = $(this).attr("subid");
            if ( subid.startsWith("_") ) {
                var locmode = $(this).html();
                if ( locmode!=="query" && locmode!=="" && !onoff.includes(locmode) ) {
                    onoff.push(locmode);
                }
            }
        });
        if ( onoff.length === 0 ) {
            onoff = ["Away","Home","Night"];
        }
    } else {
        if ( val==="on" && subid!=="_on" && subid!=="_off" ) {
            onoff = ["on","off"];
        } else if ( val==="off" && subid!=="_on" && subid!=="_off" ) {
            onoff = ["off","on"];
        } else if ( val==="DON" ) {
            onoff = ["DON","DOF"];
        } else if ( val==="DOF" ) {
            onoff = ["DOF","DON"];
        } else {
            onoff = [];
        }
    }
    onoff.push("");
    return onoff;
}

function getCssRuleTarget(str_type, subid, thingindex, userscope) {

    // get the scope to use
    var scope = $("#scopeEffect").val();
    var overlay = false;
    if ( userscope==="overlay") {
        overlay = true;
    } else if (userscope && userscope!=="overlay") {
        scope = userscope;
    }

    function getScope() {
        // start with alltile and allpage assumptions
        var tg = "div.thing";
        // add on assumption for the next four options
        if ( scope==="typetile" || scope==="typepage" || scope==="thistile" || scope==="thispage" || scope==="overlay" || scope==="wholetile") { 
            tg+= "." + str_type + "-thing"; 
        }
        // finally if we are asking for a specific tile add that specifier
        if ( scope==="thistile" || scope==="thispage" || scope==="wholetile" ) { 
            tg+= '.p_'+thingindex; 
        }
        return tg;
    }

    var target = "";

    if ( str_type==="page" ) {

        var pagename = et_Globals.pagename;
        // var pagename = thingindex;
        // console.log(">>>>> ", et_Globals.pagename, thingindex);
        if ( subid==="tab" ) {
            // target = "li.ui-tabs-tab.ui-state-default";
            if ( scope==="thistile" ) { 
                target = `.ui-tabs .ui-tabs-nav li.tab-${pagename}.ui-tabs-tab`;
            } else {
                target = ".ui-tabs .ui-tabs-nav li.ui-tabs-tab";                
            }

        } else if ( subid==="tabon" ) {
            // target = "li.ui-tabs-tab.ui-state-default.ui-tabs-active";
            if ( scope==="thistile" ) { 
                target = `.ui-tabs .ui-tabs-nav li.tab-${pagename}.ui-tabs-tab.ui-tabs-active.ui-state-active`;
            } else {
                target = ".ui-tabs .ui-tabs-nav li.ui-tabs-tab.ui-tabs-active.ui-state-active";
            }

        } else if ( subid==="panel" ) {
            target = "#dragregion div.panel";
            if ( scope==="thistile" ) { target+= '.panel-'+ pagename; }
        
        } else if ( subid==="name" ) {
            if ( scope==="thistile" ) { 
                target = `.ui-tabs .ui-tabs-nav li.tab-${pagename}.ui-tabs-tab a.ui-tabs-anchor`;
            } else {
                target = ".ui-tabs .ui-tabs-nav li.ui-tabs-tab a.ui-tabs-anchor";
            }
        
        } else if ( subid==="nameon" ) {
            if ( scope==="thistile" ) { 
                target = `.ui-tabs .ui-tabs-nav li.tab-${pagename}.ui-tabs-tab.ui-tabs-active a.ui-tabs-anchor`;
            } else {
                target = ".ui-tabs .ui-tabs-nav li.ui-tabs-tab.ui-tabs-active a.ui-tabs-anchor";
            }

        } else {
            target = null;
        }

    } else if ( overlay ) {
        target = getScope();
        
        // handle music controls special case
        if ( subid.startsWith("music-") ) {
            target+= " div.overlay.music-controls";
        } else if ( subid.endsWith("-dn") || subid.endsWith("-up") ) {
            target+= " div.overlay." + subid.substring(0,subid.length-3);
        } else {
            target+= " div.overlay." + subid;
        }
        if ( scope==="thistile" || scope==="thispage" ) { 
            target+= '.v_'+thingindex;
        }

    } else if ( subid==="head" ) {
        target = getScope();

        target += " div.thingname";
        if ( scope==="typetile" || scope==="typepage" || scope==="thistile" || scope==="thispage" ) { 
            target +=  "." + str_type; 
        }
        if ( scope==="thistile" || scope==="thispage" ) { 
            target+= '.t_'+thingindex;
        }

    // handle special case when whole tile is being requested
    } else if ( subid==="wholetile" ) {
        target = getScope();
    
    // main handling of type with subid specific case
    // starts just like overlay but adds all the specific subid stuff
    } else {
        target = getScope();
        
        // handle music controls special case
        if ( subid.startsWith("music-") ) {
            target+= " div.overlay.music-controls";
        } else if ( subid.endsWith("-dn") || subid.endsWith("-up") ) {
            target+= " div.overlay." + subid.substring(0,subid.length-3);
        } else {
            target+= " div.overlay." + subid;
        }

        // narrow down to this tile if requested
        if (scope==="thistile" || scope==="thispage" ) {
            target+= '.v_'+thingindex;
        }

        // check for items with arrows around them or sliders so we just use overlap group for those
        var skipdiv = $(target + " div."+subid+".p_"+thingindex);
        var skiparrow = ( skipdiv && (skipdiv.hasClass("arrow-it") || skipdiv.hasClass("ui-slider")) );

        // add the specific target inside overlay for things without arrows and non sliders
        // if ( subid!=="level" && subid!=="volume" && subid!=="onlevel" && subid!=="position" ) {
        if ( !skiparrow ) {
            target+= " div." + subid;
            if ( scope==="thistile" || scope==="thispage" ) {
                target+= '.p_'+thingindex;
            }
        }

        // get the on/off state
        // set the target to determine on/off status
        // we always use the very specific target to this tile
        if ( skiparrow || subid==="name" || subid==="track" || subid==="weekday" || subid.startsWith("music-") ||
             subid==="color" || subid==="level" || subid==="volume" || subid==="onlevel" || subid==="position" ||
             subid==="cool" || subid==="heat" || subid==="stream" ) {
            on = "";
        } else {
            var on = $("#onoffTarget").html();
            if ( on && !isNumeric(on) && (on.indexOf(" ") === -1) ) {
                on = "."+on;
            } else {
                on = "";
            }
        }
        target = target + on;
    }

    // make this work only for this page if that option is selected
    // the target will always start with "div." so we strip off the div
    if ( et_Globals.pagename && str_type!=="page" && scope==="thispage" || scope=="typepage" || scope==="allpage" ) {
        target = "div." + et_Globals.pagename + target.substring(3);
    }

    // debug print of how we got the target
    if ( DEBUGte ) {
        console.log("csstarget: type= ", str_type, " subid= ", subid, " tile= ", thingindex, " scope= ", scope, " target: ", target);
    }

    return target;
}

function toggleTile(target, str_type, subid, setvalue) {
    var ostarget = target;
    var swval = $(target).html();
    $('#onoffTarget').html("");
    if ( swval ) {
        swval = swval.replace(" ","_");
    }
    if ( str_type === "thermostat" && subid==="temperature" ) {
        ostarget = "#a-" + et_Globals.thingid + "-thermostatOperatingState";
        swval = $(ostarget).html();
    }

    if ( typeof swval==="string" && swval.startsWith("LINK::") ) {
        var ipos = swval.lastIndexOf("::");
        var linkid = swval.substring(ipos+2);
        var linkaid = $("div.thing[tile='"+linkid+"']").attr("thingid");
        swval = $("#a-"+linkaid+"-"+subid).html();
    }

    if ( typeof swval === "undefined" ) {
        swval = "";
    }
    
    // activate the icon click to use this
    var onoff = getOnOff(str_type, subid, swval);
    var newsub = 0;
    if ( onoff && onoff.length > 1 ) {
        for ( var i=0; i < onoff.length; i++ ) {
            var oldsub = onoff[i];
            
            if ( oldsub && $(target).hasClass(oldsub) ) { 
                $(target).removeClass(oldsub); 
            }
            if ( oldsub && $(target).hasClass(oldsub.toLowerCase()) ) { 
                $(target).removeClass(oldsub.toLowerCase()); 
            }
        
            if ( setvalue && (oldsub.toLowerCase() === swval.toLowerCase()) ) {
                newsub = i+1;
                if ( newsub >= onoff.length ) { newsub= 0; }
                $(target).addClass( onoff[newsub] ); 
                $(target).html( onoff[newsub] );
                if ( ostarget !== target ) {
                    $(ostarget).html( onoff[newsub] );
                }
                $('#onoffTarget').html(onoff[newsub]);
                break;
            }
        }
    }
};

// activate ability to click on icons
function setupIcons(category) {

    $("#iconList").off("click","img");
    $("#iconList").on("click","img", function() {

        // if we are in manage mode then clicking on an image selects it for removal
        if ( $("#uplButtons").hasClass("hidden") && ! $("#mngButtons").hasClass("hidden") ) {
            var chkbool = $(this).prev().prop("checked") ? false : true;
            $(this).prev().prop("checked", chkbool);
        // otherwise we pick it to set the icon image
        } else {
            var str_type = $("#tileDialog").attr("str_type");
            var thingindex = $("#tileDialog").attr("thingindex");
            
            var img = $(this).attr("show") || $(this).attr("src");
            var subid = $("#subidTarget").html();
            var strIconTarget = getCssRuleTarget(str_type, subid, thingindex);
            if ( DEBUGte ) {
                console.log("Clicked on img= "+img+" Category= "+category+" strIconTarget= "+strIconTarget+" type= "+str_type+" subid= "+subid+" index= "+thingindex);
            }
            iconSelected(category, strIconTarget, img, str_type, thingindex);
        }
    });

}

function checkboxHandler(idselect, onaction, offaction, overlay, isreset = false) {
    $(idselect).off('change');
    $(idselect).on("change",function() {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();

        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var cssOverlayTarget = getCssRuleTarget(str_type, subid, thingindex, "overlay");
        // var cssOverlayTarget = "div.overlay." + subid + ".v_" + thingindex;

        if($(idselect).is(':checked')){
            // if we're activating overlay, we turn off the non-overlay actions and turn on the overlay actions
            if ( overlay ) {
                onaction.forEach(function(act) {
                    addCSSRule(cssOverlayTarget, act, isreset);
                });
            // if not overlay, just do the on actions on the target
            } else {
                onaction.forEach(function(act) {
                    addCSSRule(cssRuleTarget, act, isreset);
                });
            }
        } else {
            offaction.forEach(function(act) {
                if (overlay ) {
                    addCSSRule(cssOverlayTarget, act, isreset);
                } else {
                    addCSSRule(cssRuleTarget, act, isreset);
                }
            });
        }
    });
}

function initOnceBinds(str_type, thingindex) {

    // set scope trigger only once here
    $("#scopeEffect").off('change');
    $("#scopeEffect").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var uid = $("#tileDialog").attr("uid");
        var subid = $("#subidTarget").html();
        initColor(str_type, subid, thingindex, uid);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });

    // act on triggers from picking an item from the list
    $("#subidselect").off('change');
    $("#subidselect").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var uid = $("#tileDialog").attr("uid");
        var subid = $(event.target).val();

        if ( str_type!=="page" ) {
            var target = getCssRuleTarget(str_type, subid, thingindex);
            var targetid = "#x_a-"+$(target).attr("aid")+"-"+subid;
            toggleTile(targetid, str_type, subid, false);
        }
        initColor(str_type, subid, thingindex, uid);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });

    // set up triggers for edits to change based on what is clicked
    var trigger = "div"; // div." + str_type + ".p_"+thingindex;
    // var trigger = "div." + str_type + ".p_"+thingindex;
    $(`#tileDisplay div.thing.${str_type}-thing`).off('click', trigger);
    $(`#tileDisplay div.thing.${str_type}-thing`).on('click', trigger, function(event) {
        var target = event.target;
        var uid = $("#tileDialog").attr("uid");
        if ( ! $(target).attr("aid") ) {
            target = $(target).parent();
            if ( ! $(target).attr("aid") ) {
                return;
            }
        }
        var subid = $(target).attr("subid");
        var taid = $(target).attr("aid");
        var targetid = "#"+$(target).attr("id");
        var ustr_type = $("#t-"+taid).attr("type");
        var uthingindex = $("#t-"+taid).attr("tile");
        var uuid = $("#t-"+taid).attr("uid");

        if ( ustr_type && uthingindex ) {
            str_type = ustr_type;
            thingindex = uthingindex;
            uid = uuid;
        }

        $("#tileDialog").attr("str_type",str_type);
        $("#tileDialog").attr("thingindex",thingindex);
        if ( !subid ) {
            subid = (str_type==="page") ? "panel" : $("#subidTarget").html();
        }
        
        // update everything to reflect current tile
        $("#subidselect").val(subid);
        toggleTile(targetid, str_type, subid, true);
        initColor(str_type, subid, thingindex, uid);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });

}

function initDialogBinds(str_type, thingindex) {

    // set up all the check boxes

    // function checkboxHandler(idselect, onaction, offaction, overlay, isreset = false) {
    checkboxHandler("#invertIcon",["filter: invert(1);"],["filter: invert(0);"], false);
    checkboxHandler("#absPlace",["position: absolute;","margin-left: 0px;","margin-top: 0px;","margin-right: 0px;","margin-bottom: 0px;","top: 0px;","left: 0px;","right: 0px;","bottom: 0px;"],
                                ["position: relative;","margin-left: 0px;","margin-top: 0px;","margin-right: 0px;","margin-bottom: 0px;","top: 0px;","left: 0px;","right: 0px;","bottom: 0px;"], false);
    // checkboxHandler("#isHidden", ["display: none;"], ["display: block;"], true);

    // border style handling
    $("#borderType").off('change');
    $("#borderType").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var borderstyle = $(this).val();
        if ( borderstyle!=="" ) {
            if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" || subid==="colorTemperature" ) {
                var sliderbox= cssRuleTarget + " .ui-slider";
                var sliderbox2= sliderbox + " span.ui-slider-handle";
                addCSSRule(sliderbox, borderstyle);
                addCSSRule(sliderbox2, borderstyle);
            } else {
                addCSSRule(cssRuleTarget, borderstyle);
            }
        }
        event.stopPropagation();
    });
    
    // font size handling
    $("#editFont").off('change');
    $("#editFont").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var fontsize = $(this).val();
        var fontstr= "font-size: " + fontsize;
        addCSSRule(cssRuleTarget, fontstr);
        event.stopPropagation();
    });

    $("#editEffect").off('change');
    $("#editEffect").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var editEffect = getBgEffect( $(this).val() );
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var priorEffect = "background-image: " + $(cssRuleTarget).css("background-image");
        var idx = priorEffect.indexOf(", linear-gradient");
        if ( idx !== -1 ) {
            priorEffect = priorEffect.substring(0,idx);
        }
        editEffect = priorEffect + editEffect;
        addCSSRule(cssRuleTarget, editEffect);
        event.stopPropagation();
    });

    $("#fontEffect").off('change');
    $("#fontEffect").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var fontstyle = $(this).val();
        var fontstr = "";
        if ( fontstyle.startsWith("sans" ) ) {
            fontstr+= "font-family: \"Droid Sans\", Arial, Helvetica, sans-serif; ";
        } else if ( fontstyle.startsWith("serif" ) ) {
            fontstr+= "font-family: \"Raleway\", \"Times New Roman\", Times, serif; ";
        } else if ( fontstyle.startsWith("mono" ) ) {
            fontstr+= "font-family: Courier, monospace; ";
        } else {
            fontstr+= "font-family: \"Droid Sans\", Arial, Helvetica, sans-serif; ";
        }
        
        // handle italics
        if ( fontstyle.endsWith("i" ) ) {
            fontstr+= "font-style: italic; ";
        } else {
            fontstr+= "font-style: normal; ";
        }
        
        // handle bolding
        if ( fontstyle.endsWith("b") || fontstyle.endsWith("bi") ) {
            fontstr+= "font-weight: bold; ";
        } else {
            fontstr+= "font-weight: normal; ";
        }
        addCSSRule(cssRuleTarget, fontstr);
        event.stopPropagation();
    });

    // alignment handling
    $("#alignEffect").off('change', "input");
    $("#alignEffect").on('change', "input", function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var aligneffect = $(this).val();
        var fontstr= "text-align: " + aligneffect;
        addCSSRule(cssRuleTarget, fontstr);
        event.stopPropagation();
    });

    // alignment handling uses the overlay target
    $("#inlineEffect").off('change', "input");
    $("#inlineEffect").on('change', "input", function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        const overlayTarget = getCssRuleTarget(str_type, subid, thingindex, "overlay");
        const cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var inlineffect = $(this).val();
        const fontstr= "display: " + inlineffect;
        addCSSRule(overlayTarget, fontstr);
        addCSSRule(cssRuleTarget, "display: inline-block; vertical-align: middle;");
        event.stopPropagation();
    });
    
    $("#iconleft").off('change');
    $("#iconleft").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var aligneffect = $(this).val();
        var fontstr= "background-position-x: " + aligneffect + "%";
        addCSSRule(cssRuleTarget, fontstr);
        event.stopPropagation();
    });

    $("#icontop").off('change');
    $("#icontop").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var aligneffect = $(this).val();
        var fontstr= "background-position-y: " + aligneffect + "%";
        addCSSRule(cssRuleTarget, fontstr);
        event.stopPropagation();
    });
    
    // resets the entire tile now like it was designed to do
    $("#editCustom").off('click');
    $("#editCustom").on('click', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var pos = {top: event.pageY - 350, left: event.pageX + 150};
        var scopemap = scopeMap(str_type);
        var scope = $("#scopeEffect").val();
        const scopestr = scopemap[scope].substring(0,scopemap[scope].length-1);
        var msg = `<div class='editheader'>Enter custom CSS formatting</div>`;
        msg += "<input type='text' id='customFormatText' style='width:400px;' placeholder='Enter custom CSS formatting here' /><br />";
        msg += (subid==="wholetile" || subid==="panel") ? `Custom CSS will apply to ${scopemap[scope]}?` : `Custom CSS will apply only to <b>${subid}</b> elements on <b>${scopestr}</b>?`;
        msg += "<br />Note: Multiple CSS rules can be added. Each rule must end with a semicolon (;)<br />Example: <b><small><em>color: red; font-size: 20px;</em></small></b>";
        createModal("customtag", msg, "body", true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
                event.stopPropagation();
                const addtext = $("#customFormatText").val();
                console.log("Adding custom CSS rule: ", addtext, " to target: ", cssRuleTarget);

                // check for valid input expected by CSS
                // this check does not prevent the user from entering invalid CSS properties or values
                if ( addtext.indexOf(":") !== -1 && addtext.indexOf(";") !== -1 ) {
                    addCSSRule(cssRuleTarget, addtext);
                } else {
                    alert("Invalid CSS formatting entered. Please ensure entry is in format: \"field: value; field2: value2;\" that includes at least one ':' and one ';' character.");
                }
            }
            et_Globals.insubmenu = false;
            closeModal("customtag");
        }, function() {
            et_Globals.insubmenu = true;
            $("#customtag").draggable();
        });
    });
    
    // resets the entire tile now like it was designed to do
    $("#editReset").off('click');
    $("#editReset").on('click', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var pos = {top: event.pageY - 350, left: event.pageX + 150};
        var scopemap = scopeMap(str_type);
        var scope = $("#scopeEffect").val();
        const scopestr = scopemap[scope].substring(0,scopemap[scope].length-1);
        var msg = (subid==="wholetile" || subid==="panel") ? `Reset everything on ${scopemap[scope]}?` : `Reset only ${subid} elements on ${scopestr}?`;
        createModal("picksubid", msg, "body", true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                event.stopPropagation();
                resetCSSRules(str_type, thingindex, subid);
            }
            et_Globals.insubmenu = false;
            closeModal("picksubid");
        }, function() {
            et_Globals.insubmenu = true;
            $("#picksubid").draggable();
        });
    });
    
    $("#clipboard").prop("disabled", true);
    $("#clipboard").css("background-color","gray");
    $("#editCopy").off('click');
    $("#editCopy").on('click', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rules = copyCSSRule(str_type, thingindex);
        event.stopPropagation();

        // show what was copied
        var pstyle = "position: absolute; border: 6px black solid; background-color: white; color: black; font-size: 14px; left: 330px; top: 75px; width: 600px; height: auto; padding: 10px;";
        var pos = {style: pstyle};
        var msg = "<strong>Clipboard update request:</strong>" + " (" + rules.length + " items)<br /><hr>";
        if ( rules.length === 0 ) {
            msg += "No custom formatting detected.";
            msg+= "<br>By selecting Okay, you will clear the clipboard, which currently has " + et_Globals.clipboard.length + " items.";
        } else {
            rules.forEach(function(rule) {
                msg += "<strong>"+rule.target + "</strong><br>{ " + rule.rule + " }<br>";
            });
        }
        msg += "<hr><br>";
            
        createModal("popupinfo", msg, "body", true, pos, function(ui, content) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                et_Globals.clipboard = rules;
                saveClipboard(et_Globals.userid, str_type, thingindex, rules);
            }   
            et_Globals.insubmenu = false;
            closeModal("popupinfo");
        }, function() {
            et_Globals.insubmenu = true;
            $("#popupinfo").draggable();
        });
    });
    
    $("#editPaste").off('click');
    $("#editPaste").on('click', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rules = pasteCSSRule(et_Globals.clipboard, str_type, thingindex);
        if ( DEBUGte ) {
            console.log("rules pasted: ", rules);
        }
        event.stopPropagation();
    });

    $('#noIcon').off('change');
    $('#noIcon').on('change', function() {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var strEffect = getBgEffect();
        
        if( $("#noIcon").is(':checked') ){
            et_Globals.priorIcon = $(cssRuleTarget).css("background-image");
            addCSSRule(cssRuleTarget, "background-image: none" + strEffect + ";");
        } else {
            if ( et_Globals.priorIcon!=="none" ) {
                addCSSRule(cssRuleTarget, "background-image: " + et_Globals.priorIcon + strEffect + ";");
            }
        }
    });
        
    // new button to process the name change
    $("#processName").off("click");
    $("#processName").on("click", function (event) {
        updateNames(et_Globals.userid, et_Globals.thingid, str_type, thingindex);
        event.stopPropagation();
    });

    $("#iconSrc").off('change');
    $("#iconSrc").on('change', function (event) {
        getIcons();	
        event.stopPropagation();
    });

    $("#imgmanage").off("click");
    $("#imgmanage").on("click", function(event) {
        // console.log(">>>> manage image not yet implemented.");
        $("#uplButtons").addClass("hidden");
        $("#mngButtons").removeClass("hidden");
        $("#iconSrc").prop("disabled", true);
        $("#noIcon").prop("disabled", true);
        $("div.iconcat img.icon").each(function() {
            var num = $(this).attr("num");
            $(this).before('<input type="checkbox" num="'+num+'" class="delCheckbox" />')
        });
        event.stopPropagation();
    });

    $("#imgcancel").off("click");
    $("#imgcancel").on("click", function(event) {
        $("#uplButtons").removeClass("hidden");
        $("#mngButtons").addClass("hidden");
        $("#iconSrc").prop("disabled", false);
        $("#noIcon").prop("disabled", false);
        $("div.iconcat input.delCheckbox").each(function() {
            $(this).remove();
        });
        event.stopPropagation();
    });

    $("#imgdelete").off("click");
    $("#imgdelete").on("click", function(event) {
        $("#uplButtons").removeClass("hidden");
        $("#mngButtons").addClass("hidden");
        $("#iconSrc").prop("disabled", false);
        $("#noIcon").prop("disabled", false);
        var imagestodel = [];
        $("div.iconcat input.delCheckbox").each(function() {
            if ( $(this).prop("checked") === true ) {
                imagestodel.push($(this).next().attr("src"));
            }
        });
        event.stopPropagation();

        // now remove them from the disk
        if ( imagestodel.length > 0 ) {
            delImages(imagestodel);
        }
    });

    $("#imgupload").off("click");
    $("#imgupload").on("click", function(event) {
        $("#uplButtons").addClass("hidden");
        $("#iconSrc").prop("disabled", true);
        $("#noIcon").prop("disabled", true);
        uploadImage();
        event.stopPropagation();
    });
    
    $("#bgSize").off('change');
    $("#bgSize").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        updateSize(str_type, subid, thingindex);
        event.stopPropagation();
    });
    
    $("#autoBgSize").off('change');
    $("#autoBgSize").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
       
        if ( $("#autoBgSize").is(":checked") ) {
            $("#bgSize").prop("disabled", true);
        } else {
            $("#bgSize").prop("disabled", false);
        }
        updateSize(str_type, subid, thingindex);
        event.stopPropagation();
    });
    
    $("#bgRepeat").off('change');
    $("#bgRepeat").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rule = "background-repeat: " + $("#bgRepeat").val() + ";";
        addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        event.stopPropagation();
    });

    // set overall tile height
    $("#tileHeight").off('change');
    $("#tileHeight").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#tileHeight").val() );
        var rule = "height: " + newsize.toString() + "px;";
        // alert('type = ' + str_type + " rule= " + rule);
        if ( str_type==="page" ) {
            addCSSRule(getCssRuleTarget(str_type, 'panel', thingindex), rule);
        } else {
            addCSSRule(getCssRuleTarget(str_type, 'wholetile', thingindex), rule);
        }
        event.stopPropagation();
    });

    // set overall tile width and header and overlay for all subitems
    $("#tileWidth").off('change');
    $("#tileWidth").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#tileWidth").val() );
        var rule = "width: " + newsize.toString() + "px;";
        if ( str_type==="page" ) {
            addCSSRule(getCssRuleTarget(str_type, 'panel', thingindex), rule);
        } else {
            addCSSRule(getCssRuleTarget(str_type, 'wholetile', thingindex), rule);
        }
        event.stopPropagation();
    });

    // set float options
    $("#floatOpts").off('change');
    $("#floatOpts").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newfloat = $("#floatOpts").val();
        var rule = "float: " + newfloat + ";";
        if ( str_type!=="page" ) {
            addCSSRule(getCssRuleTarget(str_type, 'wholetile', thingindex), rule);
        }
        event.stopPropagation();
    });

    // set overall tile width and header and overlay for all subitems
    $("#autoTileHeight").off('change');
    $("#autoTileHeight").on('change', function(event) {
        var rule;
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        if($("#autoTileHeight").is(':checked')) {
            rule = "height: auto;";
            $("#tileHeight").prop("disabled", true);
            $("#tileHeight").css("background-color","gray");
        } else {
            var newsize = parseInt( $("#tileHeight").val() );
            if ( !newsize || newsize <=0 ) {
                newsize = 150;
                if ( str_type==="page" ) { newsize = 600; }
            }
            rule = "height: " + newsize.toString() + "px;";
            $("#tileHeight").prop("disabled", false);
            $("#tileHeight").css("background-color","white");
        }
        if ( str_type==="page" ) {
            addCSSRule(getCssRuleTarget(str_type, 'panel', thingindex), rule);
        } else {
            addCSSRule(getCssRuleTarget(str_type, 'wholetile', thingindex), rule);
        }
        event.stopPropagation();
    });
    
    $("#autoTileWidth").off('change');
    $("#autoTileWidth").on('change', function(event) {
        var rule;
        // var midrule;
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        if($("#autoTileWidth").is(':checked')) {
            rule = "width: auto;";
            // midrule = "width: 72px;";
            $("#tileWidth").prop("disabled", true);
            $("#tileWidth").css("background-color","gray");
        } else {
            var newsize = parseInt( $("#tileWidth").val() );
            if ( !newsize || newsize <=0 ) {
                newsize = 120;
                if ( str_type==="page" ) { newsize = 1200; }
            }
            rule = "width: " + newsize.toString() + "px;";
            $("#tileWidth").prop("disabled", false);
            $("#tileWidth").css("background-color","white");
            var midsize = newsize - 64;
            // midrule = "width: " + midsize.toString() + "px;";
        }
        if ( str_type==="page" ) {
            addCSSRule(getCssRuleTarget(str_type, 'panel', thingindex), rule);
        } else {
            addCSSRule(getCssRuleTarget(str_type, 'wholetile', thingindex), rule);
        }
        event.stopPropagation();
    });

    // set overall tile width and header and overlay for all subitems
    $("#editHeight").off('change');
    $("#editHeight").on('change', function(event) {
        var newsize = parseInt( $("#editHeight").val() );
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        if ( subid !== "wholetile" ) {
            var target = getCssRuleTarget(str_type, subid, thingindex);
            var rule = "height: " + newsize.toString() + "px;";
            if ( subid==="temperature" || subid==="feelsLike" ) {
                var halfnew = newsize - 5;
                rule += " line-height: " + halfnew.toString() + "px;";
            }
            addCSSRule(target, rule);
        }
        event.stopPropagation();
    });

    // set overall tile width and header and overlay for all subitems
    $("#editWidth").off('change');
    $("#editWidth").on('change', function(event) {
        var newsize = parseInt( $("#editWidth").val() );
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        if ( subid !== "wholetile" ) {
            var target = getCssRuleTarget(str_type, subid, thingindex);

            // just change the icon if this is a track image
            if ( subid==="trackImage" ) {
                target = target + " img.trackImage";
            }
            var rule = "width: " + newsize.toString() + "px;";
            addCSSRule(target, rule);

        }
        event.stopPropagation();
    });

    // set the item height
    $("#autoHeight").off('change');
    $("#autoHeight").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rule;
        if ( $("#autoHeight").is(":checked") ) {
            // special handling for default temperature circles
            if ( subid==="temperature" || subid==="feelsLike" || subid==="temperatureApparent" ) {
                rule = "height: 50px; line-height: 45px;";
            } else {
                rule = "height: auto;";
            }
            $("#editHeight").prop("disabled", true);
            $("#editHeight").css("background-color","gray");
        } else {
            var newsize = parseInt( $("#editHeight").val() );
            // special handling for default temperature circles
            $("#editHeight").prop("disabled", false);
            $("#editHeight").css("background-color","white");
            if ( newsize === 0 ) {
                if ( subid==="temperature" || subid==="feelsLike" || subid==="temperatureApparent" ) {
                    rule = "height: 50px; line-height: 45px;";
                } else {
                    rule = "height: 17px;";
                }
            } else {
                newsize = newsize.toString() + "px;";
                rule = "height: " + newsize;
            }
        }
        if ( subid !== "wholetile" ) {
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation();
    });

    // set the item width
    $("#autoWidth").off('change');
    $("#autoWidth").on('change', function(event) {
        var subid = $("#subidTarget").html();
        if ( subid !== "wholetile" ) {
            var str_type = $("#tileDialog").attr("str_type");
            var thingindex = $("#tileDialog").attr("thingindex");
            var rule;
            if ( $("#autoWidth").is(":checked") ) {
                // special handling for default temperature circles
                if ( subid==="temperature" || subid==="feelsLike" ) {
                    rule = "width: 50px;";
                } else if ( str_type==="page" && subid==="panel") {
                    rule = "width: 100%; padding-left: 0px; padding-right: 0px;";
                } else if ( str_type==="page") {
                    rule = "width: auto;";
                } else {
                    rule = "width: 100%;";
                }
                $("#editWidth").prop("disabled", true);
                $("#editWidth").css("background-color","gray");
                if ( str_type==="page" && subid!=="panel" ) {
                    addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
                    addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
                } else {
                    var wtarget = getCssRuleTarget(str_type, subid, thingindex);
                    if ( subid==="trackImage" ) {
                        wtarget = wtarget + " img.trackImage";
                    }
                    addCSSRule(wtarget, rule);
                }
            } else {
                var newsize = parseInt( $("#editWidth").val() );
                $("#editWidth").prop("disabled", false);
                $("#editWidth").css("background-color","white");
                if ( isNaN(newsize) || newsize === 0 ) {
                    if ( subid==="temperature" || subid==="feelsLike" ) {
                        rule = "width: 50px;";
                    } else if ( str_type==="page" && subid==="panel") {
                        rule = "width: 100%; padding-left: 0px; padding-right: 0px;";
                    } else if ( str_type==="page") {
                        rule = "width: auto;";
                    } else {
                        rule = "width: 100%;";
                    }
                } else {
                    newsize = newsize.toString() + "px;";
                    // rule = "width: " + newsize + " display: inline-block;";
                    rule = "width: " + newsize;
                }
                if ( str_type==="page" && (subid==="tab" || subid==="tabon") ) {
                    addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
                    addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
                } else {
                    var wtarget = getCssRuleTarget(str_type, subid, thingindex);
                    if ( subid==="trackImage" ) {
                        wtarget = wtarget + " img.trackImage";
                    }
                    addCSSRule(wtarget, rule);
                }
            }
        }
        event.stopPropagation();
    });

    // set margin top for selected item
    $("#topMargin").off('change');
    $("#topMargin").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#topMargin").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule;
        if ( str_type==="page" && subid === "panel" ) {
            rule = "background-position-y: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" && str_type!=="page" ) {
                rule = "top: " + newsize;
            } else {
                rule = "margin-top: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation();
    });

    // set margin bottom for selected item
    $("#botMargin").off('change');
    $("#botMargin").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#botMargin").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule;
        if ( str_type==="page" && subid === "panel" ) {
            if ( newsize !== "0px;" ) newsize = "-" + newsize;
            rule = "background-position-y: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" && str_type!=="page" ) {
                rule = "bottom: " + newsize;
            } else {
                rule = "margin-bottom: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation();
    });

    // set top padding for selected item
    $("#topPadding").off('change');
    $("#topPadding").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#topPadding").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule = "padding-top: " + newsize;
        addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        event.stopPropagation();
    });

    // set bottom padding for selected item
    $("#botPadding").off('change');
    $("#botPadding").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#botPadding").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule = "padding-bottom: " + newsize;
        addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        event.stopPropagation();
    });

    // set left margin for selected item
    $("#leftMargin").off('change');
    $("#leftMargin").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#leftMargin").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule;
        if ( str_type==="page" && subid === "panel" ) {
            rule = "background-position-x: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" && str_type!=="page" ) {
                rule = "left: " + newsize;
            } else {
                rule = "margin-left: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation();
    });

    // set right margin for selected item
    $("#rightMargin").off('change');
    $("#rightMargin").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#rightMargin").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule;
        if ( str_type==="page" && subid === "panel" ) {
            if ( newsize !== "0px;" ) newsize = "-" + newsize;
            rule = "background-position-x: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" && str_type!=="page" ) {
                rule = "right: " + newsize;
            } else {
                rule = "margin-right: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation();
    });

    // set left padding for selected item
    $("#leftPadding").off('change');
    $("#leftPadding").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#leftPadding").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule = "padding-left: " + newsize;
        addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        event.stopPropagation();
    });

    // set right padding for selected item
    $("#rightPadding").off('change');
    $("#rightPadding").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#rightPadding").val() );
        if ( !newsize || isNaN(newsize) ) { 
            newsize = "0px;";
        } else {
            newsize = newsize.toString() + "px;";
        }
        var rule = "padding-right: " + newsize;
        addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        event.stopPropagation();
    });

    function txtModify(before_after) {
        var txt = $("#" + before_after + "Text").val();

        // surround the txt with quotes unless it already has them
        if ( !txt.startsWith('"') && !txt.startsWith("'") ) {
            txt = "\"" + txt + "\"";
        }
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rule = "content: " + txt + ";";
        if ( subid !== "wholetile" && (subid !== "panel" || str_type!=="page") ) {
            var csstag = getCssRuleTarget(str_type, subid, thingindex) + "::" + before_after;
            addCSSRule(csstag, rule, false, before_after);
        }

    }

    // set padding for selected item
    $("#beforeText").off('change');
    $("#beforeText").on('change', function(event) {
        txtModify("before");
        event.stopPropagation();
    });

    // set padding for selected item
    $("#afterText").off('change');
    $("#afterText").on('change', function(event) {
        txtModify("after");
        event.stopPropagation();
    });
    
}

function iconlist() {
    var dh = "";
	dh += "<div id='editicon'>";

    // icon selector
	dh += "<div class='radiogroup' id='iconChoices'>";
	dh += "<select name=\"iconSrc\" id=\"iconSrc\" class=\"ddlDialog\"></select>";
	dh += "<input type='checkbox' id='noIcon'>";
	dh += "<label class=\"iconChecks\" for=\"noIcon\">None</label>";
	dh += "</div>";

    // uplaod and manage buttons
    dh += "<div class='hidden' id='uplButtons'>";
    dh += "<button class='tebutton' id ='imgupload'>Upload</button>";
    dh += "<button  class='tebutton' id='imgmanage'>Manage</button>"
	dh += "</div>";

    dh += "<div class='hidden' id='mngButtons'>";
    dh += "<button  class='tebutton' id='imgdelete'>Delete</button>"
    dh += "<button  class='tebutton' id='imgcancel'>Cancel</button>"
	dh += "</div>";

    // icon placement
    dh += "<div class='radiogroup'>";
    dh += "<label for=\"iconleft\">Pos-x: </label><input size='6' type=\"number\" id=\"iconleft\" min='0' max='100' step='10' value=\"50\"/>";
    dh += "<label for=\"icontop\" >Pos-y: </label><input size='6' type=\"number\" id=\"icontop\" min='0' max='100' step='10' value=\"50\"/>";
    dh += "</div>";

    // icon size
    dh += "<div class='radiogroup'>";
    dh += "<label for='bgSize'>Icon size: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"bgSize\" value=\"80\"/>";
    dh += "<input type='checkbox' id='autoBgSize'><label class=\"iconChecks\" for=\"autoBgSize\">Auto?</label>";
    dh += "</div>";

    // icon repeat
    dh += "<div class='radiogroup'>";
    dh += "<label for='bgRepeat'>Icon Repeat: </label>";
    dh += "<select name='repeatops' id=\"bgRepeat\" class='ddlDialog'>";
    dh += "<option value=\"no-repeat\" selected>No Repeat</option>";
    dh += "<option value=\"repeat-x\">Repeat X</option>";
    dh += "<option value=\"repeat-y\">Repeat Y</option>";
    dh += "<option value=\"repeat\">Repeat X & Y</option>";
    dh += "</select>";
    dh += "</div>";

    // icon list placeholder
	dh += "<div id='iconList'></div>";

	dh += "</div>";
    return dh;
}

function scopeMap(str_type) {
    if ( str_type==="page" ) {
        var str = {
            "thistile": "This page",
            "thispage": "This page",
            "typetile": "This page",
            "typepage": "This page",
            "alltile": "All pages",
            "allpage": "All pages"
        };
    } else {
        str = {
            "thistile": `This ${str_type} tile, All pages`,
            "thispage": `This ${str_type} tile, This page`,
            "typetile": `All ${str_type} tiles, All pages`,
            "typepage": `All ${str_type} tiles, This page`,
            "alltile": `All tiles, All pages`,
            "allpage": `All tiles, This page`
        };
    }
    return str;
}

function scopeSection(str_type) {
    var dh = "";
    dh += "<div class='colorgroup'><div class='sizeText'>Effect Scope</div>";
    dh += "<select name=\"scopeEffect\" id=\"scopeEffect\" class=\"ddlDialog\">";
    var scopemap = scopeMap(str_type);
    for (scope in scopemap) {
        if ( (scope==="thistile" && et_Globals.pagename!=="floorplan") || (scope==="thispage" && et_Globals.pagename==="floorplan") || (scope==="thistile" && str_type==="page") ) {
            dh += `<option value="${scope}" selected>${scopemap[scope]}</option>`;
        } else {
            dh += `<option value="${scope}">${scopemap[scope]}</option>`;
        }
    }
    dh += "</select></div>";
    return dh;
}

function editSection(str_type, thingindex) {
    var dh = "";

    var subid = setsubid(str_type);
    var target = getCssRuleTarget(str_type, subid, thingindex);
    var targetwhole = getCssRuleTarget(str_type, subid, thingindex, "wholetile"); //  "div.thing."+str_type+"-thing";
    
    dh += "<div id='editSection'>";

    dh += "<div class='colorgroup'><div class='sizeText' id=\"labelName\"></div><input name=\"editName\" id=\"editName\" class=\"ddlDialog\" value=\"" + "" +"\"></div>";
    dh += "<div class='colorgroup'><button class='tebutton' id='processName'>Save Name</button></div>";
    dh += scopeSection(str_type);


    var th = $(target).css("height");
    var tw = $(target).css("width");
    if ( th==="auto" || !th || th.indexOf("px") === -1 ) { 
        th= 0; 
    } else {
        th = parseInt(th);
    }
    if ( tw==="auto" || !tw || tw.indexOf("px") === -1 ) { 
        tw= 0; 
    } else {
        tw = parseInt(tw);
    }
    
    var h = $(target).css("height");
    var w = $(target).css("width");
    if ( h==="auto" || !h || !h.hasOwnProperty("indexOf") || h.indexOf("px") === -1 ) { 
        h= 0; 
    } else {
        h = parseInt(h);
    }
    if ( w==="auto" || !w || !w.hasOwnProperty("indexOf") ||  w.indexOf("px") === -1 ) { 
        w= 0; 
    } else {
        w = parseInt(w);
    }
    
    dh += "<div class='sectionbreak'></div>";
    dh += "<div class='editSection_input sizeText'>Overall Tile Size</div>";

    dh += "<div class='editSection_inline'>";
    dh += "<label class=\"iconChecks\" for=\"autoTileHeight\">Auto H?</label><input class='autochk' type='checkbox' id='autoTileHeight'>";
    dh += "<label for='tileHeight'>Tile H: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"tileHeight\" value=\"" + th + "\"/>";
    dh += "</div>";

    dh += "<div class='editSection_inline'>";
    dh += "<label class=\"iconChecks\" for=\"autoTileWidth\">Auto W?</label><input class='autochk' type='checkbox' id='autoTileWidth'>";
    dh += "<label for='tileWidth'>Tile W: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"tileWidth\" value=\"" + tw + "\"/>";
    dh += "</div>";


    dh += "<div class='editSection_input'>";
    var curFloat = $(targetwhole).css("float");
    var floats = ["none", "left", "right"];
    var fe = "<label for='floatOpts'>Tile Float: </label>";
    fe += "<select name=\"floatOpts\" id=\"floatOpts\" class=\"ddlDialog\">";
    floats.forEach (function(key) {
        if ( curFloat && curFloat===key ) {
            fe += "<option value=\"" + key + "\" selected>" + key + "</option>";
        } else {
            fe += "<option value=\"" + key + "\">" + key + "</option>";
        }
    });
    fe += "</select>";
    dh += fe;
    dh += "</div>";

    dh += "<div class='sectionbreak'></div>";
    dh += "<div class='editSection_input sizeText'>Item Size & Position</div>";

    dh += "<div class='editSection_inline'>";
    dh += "<label class=\"iconChecks\" for=\"autoHeight\">Auto H?</label><input class='autochk' type='checkbox' id='autoHeight'>";
    dh += "<label for='editHeight'>Item H: </label>";
    dh += "<input size='4' type=\"number\" min='5' max='1600' step='5' id=\"editHeight\" />";
    dh += "</div>";
    
    dh += "<div class='editSection_inline'>";
    dh += "<label class=\"iconChecks\" for=\"autoWidth\">Auto W?</label><input class='autochk' type='checkbox' id='autoWidth'>";
    dh += "<label for='editWidth'>Item W: </label>";
    dh += "<input size='4' type=\"number\" min='5' max='1600' step='5' id=\"editWidth\" />";
    dh += "</div>";

    // font size (returns px not pt)
    dh += "<div class='editSection_inline'>";
    dh += "<label for='topMargin'>Top Margin:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"topMargin\" value=\"\"/>";
    dh += "<label for='botMargin'>Bot Margin:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"botMargin\" value=\"\"/>";
    dh += "</div>";
    dh += "<div class='editSection_inline'>";
    dh += "<label for='leftMargin'>Left Margin:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"leftMargin\" value=\"\"/>";
    dh += "<label for='rightMargin'>Right Margin:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"rightMargin\" value=\"\"/>";
    dh += "</div>";
    dh += "<div class='editSection_inline'>";
    dh += "<label for='topPadding'>Top Padding:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"topPadding\" value=\"\"/>";
    dh += "<label for='botPadding'>Bot Padding:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"botPadding\" value=\"\"/>";
    dh += "</div>";
    dh += "<div class='editSection_inline'>";
    dh += "<label for='leftPadding'>Left Padding:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"leftPadding\" value=\"\"/>";
    dh += "<label for='rightPadding'>Right Padding:</label>";
    dh += "<input size='2' type=\"number\" min='0' max='1600' step='5' id=\"rightPadding\" value=\"\"/>";
    dh += "</div>";

    dh += "<div class='sectionbreak'></div>";
    dh += "<div class='editSection_input sizeText'>Item Labels</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='beforeText' class=\"fixw\">Text Before:</label>";
    dh += "<input size='12' id=\"beforeText\" value=\"\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='afterText' class=\"fixw\">Text After:</label>";
    dh += "<input size='12' id=\"afterText\" value=\"\"/>";
    dh += "</div>";

    dh += "<div class='editSection_input'>";
    dh += "<label for='clipboard' class=\"fixw\">Clipboard:</label>";
    dh += "<input size='12' id=\"clipboard\" readonly value=\"\"/>";
    dh += "</div>";

    dh += "</div>";
    
    return dh;
}

function itempicker(subid, onoff) {
    var dh = "";
    dh += "<div class='colorgroup'>";
    dh += "<div class='editSection_input sizeText'>Feature Selected</div>";
    dh += "<div id='subidTarget' class='dlgtext'>" + subid + "</div>";
    dh += "<div id='onoffTarget' class='dlgtext'>" + onoff + "</div>";
    dh+= "</div>";
    return dh;
}

function setupClicks(str_type, thingindex) {
    var firstsub = setsubid(str_type);
    $("#subidTarget").html(firstsub);

    // do an initial toggle so edits can start right away
    if ( str_type!=="page") {
        var target = getCssRuleTarget(str_type, firstsub, thingindex);
        var targetid = "#x_a-"+$(target).attr("aid")+"-"+firstsub;
        toggleTile( targetid, str_type, firstsub, false);
    }
    var uid = $("#tileDialog").attr("uid");
    initColor(str_type, firstsub, thingindex, uid);
    loadSubSelect(str_type, firstsub, thingindex);
    getIcons();
    initDialogBinds(str_type, thingindex);
    initOnceBinds(str_type, thingindex);
    
}

function loadSubSelect(str_type, firstsub, thingindex) {
        
    // get list of all the subs this tile supports
    var subcontent = "";
    
    if ( str_type==="page" ) {
        subcontent += "<div class='editInfo'>Select Feature:</div>";
        subcontent += "<select id='subidselect' name='subselect'>";
        subcontent += "<option value='panel' selected>Panel</option>";
        subcontent += "<option value='tab'>Tab</option>";
        subcontent += "<option value='tabon'>Tab Selected</option>";
        subcontent += "<option value='name'>Name</option>";
        subcontent += "<option value='nameon'>Name Selected</option>";
    } else {
        subcontent += "<div class='editInfo'>Select Feature:</div>";
        subcontent += "<select id='subidselect' name='subselect'>";
    
        if ( firstsub === "wholetile" ) {
            subcontent += "<option value='wholetile' selected>Whole Tile</option>";
        } else {
            subcontent += "<option value='wholetile'>Whole Tile</option>";
        }

        if ( firstsub === "head" ) {
            subcontent += "<option value='head' selected>Head Title</option>";
        } else {
            subcontent += "<option value='head'>Head Title</option>";
        }

        var subid;
        $("#tileDisplay div."+str_type+"-thing  div.overlay").each(function(index) {
            var classes = $(this).attr("class");
            var words = classes.split(" ", 3);
            subid = words[1];
            if ( !subid ) return;

            if ( $(this).children().length === 3 ) {
                var subdown = $(this).children().eq(0).attr("subid");
                var subup = $(this).children().eq(2).attr("subid");
            } else {
                subdown = false;
                subup = false;
            }
               
            // handle music controls
            if ( subid==="music-controls" ) {
                var that = $(this);
                that.children().each(function() {
                    var musicsub = $(this).attr("subid");
                    subcontent += "<option value='" + musicsub +"'";
                    if ( musicsub === firstsub ) {
                        subcontent += " selected";
                    }
                    subcontent += ">" + musicsub + "</option>";;
                });
            } else {
                if ( subdown ) {
                    subcontent += "<option value='" + subdown + "'>" + subdown + "</option>";
                }
                subcontent += "<option value='" + subid + "'";
                if ( subid === firstsub ) {
                    subcontent += " selected";
                }
                subcontent += ">" + subid + "</option>";;
                if ( subup ) {
                    subcontent += "<option value='" + subup + "'>" + subup + "</option>";
                }

            }
        });
    
    }
    
    subcontent += "</select>";
    $("#subsection").html(subcontent);
}

function setsubid(str_type) {
    var subid = str_type;
    switch(str_type) {
        case "page":
            subid= "panel";
            break;

        case "bulb":
        case "switch":
        case "valve":
        case "switchlevel":
            subid = "switch";
            break;

        case "button":
            subid = "pushed";
            break;

        case "thermostat":
        case "temperature":
        case "weather":
            subid = "temperature";
            break;

        case "music":
            subid = "trackDescription";
            break;

        case "door":
        case "garage":
            subid = "door";
            break;

        case "shm":
        case "hsm":
            subid = "state";
            break;
            
        case "mode":
            subid = "themode";
            break;
            
        case "frame":
        case "video":
        case "custom":
        case "image":
        case "contact":
        case "motion":
        case "presence":
        case "momentary":
        case "lock":
            subid = str_type;
            break;
            
        default:
            subid = "wholetile";
            break;
    }
    return subid;
}

function updateNames(userid, thingid, str_type, thingindex) {

    var newname = $("#editName").val();
    var oldname;
    var target1 = getCssRuleTarget(str_type, "name", thingindex);
    if ( str_type==="page") {
        oldname = thingindex;
    } else {
        oldname = $(target1).html();
    }
    if ( oldname === newname ) {
        return;
    }

    var returnURL = cm_Globals.returnURL;
    $.post(returnURL, 
        {api: "updatenames", userid: userid, thingid: thingid, id: 0, type: str_type, value: newname, tile: thingindex, hpcode: cm_Globals.options.hpcode},
        function (presult, pstatus) {
            if (pstatus==="success" && presult.startsWith("success") ) {
                if ( str_type==="page"  ) {
                    thingindex = newname;
                }
                cm_Globals.edited = true;
                $(target1).html(newname);
            }
        }
    );

}

function saveTileEdit(userid, str_type, thingindex) {

    // get all custom CSS text
    var sheet = document.getElementById('customtiles').sheet;
    var sheetContents = "";
    var c=sheet.cssRules;
    for(j=0;j<c.length;j++){
        sheetContents += c[j].cssText;
    };

    saveCSSFile(userid, str_type, thingindex, sheetContents, true);
}

function saveCSSFile(userid, str_type, thingindex, sheetContents, reload) {

    var returnURL = cm_Globals.returnURL;
    var newname = "";
    if ( $("#editName") ) {
        newname = $("#editName").val();
    }
    var skin = cm_Globals.options.skin;
    var pname = cm_Globals.options.pname;

    // use this regexp to add returns after open and closed brackets and semi-colons
    var regex = /[{;}]/g;
    var subst = "$&\n";
    if ( sheetContents.length > 1 ) {
        sheetContents = sheetContents.replace(regex, subst);
    }
    
    // post changes to save them in a custom css file
    // the new name of this tile is passed in the attr variable
    // we have to divide this into chunks if large to avoid Node limit
    // done using a recursive call to ensure chunks done in order
    postRecurse(0, 59000, sheetContents.length);

    function postRecurse(n1, n2, nlen) {
        // ensure we end on a proper bounday for sections
        if ( n1 >= nlen && nlen>0 ) {
            return true;
        } else if ( n2 >= nlen ) { 
            n2 = nlen; 
        } else {
            var n3 = n2;
            while ( sheetContents.substr(n3, 1)!=="}" && n3 < n2 + 1000 && n3 < nlen ) {
                n3++;
            }
            n2 = n3 + 1;
            if ( n2 > nlen ) { 
                n2 = nlen; 
            }
        }
        var subcontent= sheetContents.substring(n1, n2);
        if ( DEBUGte ) {
            console.log( "n1: ", n1, " n2: ", n2, " nlen: ", nlen, " subcontent:");
        }
        subcontent= encodeURI(subcontent);

        $.post(returnURL, 
            {api: "savetileedit", userid: userid, skin: skin, id: n1, n1: n1, n2: n2, nlen: sheetContents.length, 
                                      type: str_type, value: subcontent, attr: newname, tile: thingindex, pname: pname, hpcode: cm_Globals.options.hpcode},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    if ( DEBUGte ) {
                        console.log("savetileedit: presult= ", presult);
                    }

                    n1 = n2;
                    n2 = n1 + 59000;
                    
                    var done = ( n1 >= nlen );
                    if ( !done ) {
                        done = postRecurse(n1, n2, nlen);
                    }

                    // reload if tile updated and if we are saving the last file part
                    if ( done ) {
                        if ( cm_Globals.edited && reload ) {
                            return;
                        } else if ( !reload ) {
                            alert("A new custom CSS file was generated for panel = [" + pname + "]. This will be automatically updated as you make edits. You must relaunch editor again.");
                            window.location.href = cm_Globals.returnURL;
                        }
                    }
                }
            }
        );
        return false;

    }

}

function cancelTileEdit() {
    document.getElementById('customtiles').sheet = et_Globals.savedSheet;
}

function resetInverted(selector) {
    var sheet = document.getElementById('customtiles').sheet; // returns an Array-like StyleSheetList
    for (var i=sheet.cssRules.length; i--;) {
        var current_style = sheet.cssRules[i];
        if(current_style.selectorText === selector){
            if(current_style.cssText.indexOf("invert") !== -1) {
                current_style.style.filter="";	
            }	  		
        }
    }
}

function getResetButton() {
    var resetbutton = "<div class='sectionbreak'></div>" + 
    "<div id='resetButtonGroup' class='editSection_inline'>" +
        "<button class='tebutton' id='editReset'>Reset</button>" + 
        "<button class='tebutton' id='editCopy'>Copy</button>" +
        "<button class='tebutton' id='editPaste'>Paste</button>" +
        "<button class='tebutton' id='editCustom'>Custom</button>" +
    "</div>";
    return resetbutton;
}

// add all the color selectors
function initColor(str_type, subid, thingindex, uid) {
  
    var onstart;
    if ( subid==="thingname" ) {
        subid = "head";
    }

    var newtitle;
    if ( str_type==="page" ) {
        newtitle = "Editing Page#" + et_Globals.id + " Name: " + thingindex;
        $("#labelName").html("Page Name");
    } else {
        newtitle = "Editing Tile #" + uid + ", Type: " + str_type;
        $("#labelName").html("Tile Name");
        var tgname = getCssRuleTarget(str_type, "name", thingindex, "thistile");
        var name =  $(tgname).html();
        $("#editName").val(name);
            if ( et_Globals.tileCount > 1 ) {
            newtitle+= " (editing " + et_Globals.tileCount + " items)";
        }
    }
    $("#editheader").html(newtitle);

    // get the target selector
    var scope = $("#scopeEffect").val();
    var target = getCssRuleTarget(str_type, subid, thingindex, scope);
    const overlayTarget = getCssRuleTarget(str_type, subid, thingindex, "overlay");

    // use the wysiwyg tile if we are styling tabs
    // if ( str_type==="page" ) {
    //     target = `div.wysiwyg.thing.page-thing.p_${thingindex}`;
    //     if ( subid!=="panel" ) {
    //         target += ` div.overlay.${subid}.v_${thingindex} div.${subid}.p_${thingindex}`;
    //     }
    // }

    var generic;
    if ( str_type==="page" ) {
        generic = `div.wysiwyg.thing.page-thing.p_${thingindex}`;
        if ( subid!=="panel" ) {
            generic += ` div.overlay.${subid}.v_${thingindex} div.${subid}.p_${thingindex}`;
        }
    } else if ( scope==="thistile" ) {
        generic = target;
    } else {
        generic = getCssRuleTarget(str_type, subid, thingindex, "thistile");
    }
    var icontarget = "#tileDisplay " + target;

    if ( DEBUGte ) {
        console.log ("initcolor: str_type= " + str_type + " subid= " + subid + " thingindex= " + thingindex + " target= " + target + " generic= " + generic);
    }
    et_Globals.priorIcon = $(target).css("background-image");
    
    // set the active value
    var onoffval = $("#onoffTarget").html();
    if ( onoffval && !isNumeric(onoffval) && (onoffval.indexOf(" ") === -1) ) {
        $(icontarget).addClass(onoffval);
        $(icontarget).html(onoffval);
    }
        
    // set the first onoff state
    var onoff = getOnOff(str_type, subid, onoffval);
    // $("#onoffTarget").html(onoff[0]);
    
    $.each(onoff, function() {
        if ( this && $(icontarget).hasClass(this) ) {
            $(icontarget).removeClass(this);
        }
    });
   
    // set the background size
    var iconsize = $(target).css("background-size");
    
    if ( iconsize==="auto" || iconsize==="cover" ) {
        $("#autoBgSize").prop("checked", true);
        $("#bgSize").prop("disabled", true);
        $("#bgSize").css("background-color","gray");
    } else {
        $("#autoBgSize").prop("checked", false);
        $("#bgSize").prop("disabled", false);
        $("#bgSize").css("background-color","white");
        // iconsize = $("#bgSize").val();
        iconsize = parseInt(iconsize, 10);
        if ( isNaN(iconsize) || iconsize <= 0 ) { 
            iconsize = $(generic).css("background-size");
            if ( isNaN(iconsize) || iconsize <= 0 ) { 
                iconsize = 80; 
                if ( subid === "wholetile" ) { iconsize = 150; }
                if ( str_type==="music" ) { iconsize = 40; }
                if ( subid==="panel" ) { iconsize = 1200; }
            }
        }
        $("#bgSize").val(iconsize);
    }

    var bgRepeat = $(target).css(("background-repeat"));
    if ( !bgRepeat ) {
        bgRepeat = "no-repeat";
    }
    $("#bgRepeat").val(bgRepeat);

    // set the Overall Tile Size parameters
    var tilewidth = $(et_Globals.wholetarget).css("width");
    var tileheight = $(et_Globals.wholetarget).css("height");

    if ( tileheight==="auto" || tileheight==="cover" ) {
        $("#autoTileHeight").prop("checked", true);
        $("#tileHeight").prop("disabled", true);
        $("#tileHeight").css("background-color","gray");
    } else {
        $("#autoTileHeight").prop("checked", false);
        $("#tileHeight").prop("disabled", false);
        $("#tileHeight").css("background-color","white");
        tileheight = parseInt(tileheight,10);
        if ( isNaN(tileheight) || tileheight <= 0 ) { 
            tileheight = 150;
            if ( str_type==="page" ) { tileheight = 600; }
        }
        $("#tileHeight").val(tileheight);
    }

    if ( tilewidth==="auto" || tilewidth==="cover") {
        $("#autoTileWidth").prop("checked", true);
        $("#tileWidth").prop("disabled", true);
        $("#tileWidth").css("background-color","gray");
    } else {
        $("#autoTileWidth").prop("checked", false);
        $("#tileWidth").prop("disabled", false);
        $("#tileWidth").css("background-color","white");
        tilewidth = parseInt(tilewidth,10);
        if ( isNaN(tilewidth) || tilewidth <= 0 ) { 
            tilewidth = 120;
            if ( str_type==="page" ) { tilewidth = 1200; }
        }
        $("#tileWidth").val(tilewidth);
    }
    
    
    // set the text height and width parameters
    if ( subid!=="wholetile" ) {
        var editheight = $(target).css("height");
        if ( !editheight ) {
            $(target).css("height","auto");
            $("#autoHeight").prop("checked", true);
            $("#editHeight").prop("disabled", true);
            $("#editHeight").css("background-color","gray");
        } else {
            editheight = parseInt(editheight,10);
            if ( isNaN(editheight) || editheight <= 0 ) { 
                editheight = $(generic).css("height");
                if ( isNaN(editheight) || editheight <= 0 ) { 
                    editheight = 17;
                    if ( subid==="panel" ) { editheight = 600; }
                }
            }
            $("#editHeight").val(editheight);
        }

        if ( $(target).isAuto("height") ) {
            $("#autoHeight").prop("checked", true);
            $("#editHeight").prop("disabled", true);
            $("#editHeight").css("background-color","gray");
        } else {
            $("#autoHeight").prop("checked", false);
            $("#editHeight").prop("disabled", false);
            $("#editHeight").css("background-color","white");
        }
        
        var editwidth = $(target).css("width");
        if ( !editwidth ) {
            $(target).css("width","auto");
            $("#autoWidth").prop("checked", true);
            $("#editWidth").prop("disabled", true);
            $("#editWidth").css("background-color","gray");
        } else {
            editwidth = parseInt(editwidth,10);
            if ( isNaN(editwidth) || editwidth <= 0 ) { 
                editwidth = $(generic).css("width");
                if ( isNaN(editwidth) || editwidth <= 0 ) { 
                    editwidth = 80;
                    if ( subid==="panel" ) { editwidth = 1200; }
                }
            }
            $("#editWidth").val(editwidth);
        }

        if ( $(target).isAuto("width") ) {
            $("#autoWidth").prop("checked", true);
            $("#editWidth").prop("disabled", true);
            $("#editWidth").css("background-color","gray");
        } else {
            $("#autoWidth").prop("checked", false);
            $("#editWidth").prop("disabled", false);
            $("#editWidth").css("background-color","white");
        }
    }

    // -----------------------------------------------------------------------
    // far left side of the screen
    // -----------------------------------------------------------------------
    var dh= "";
    var subonoff = $('#onoffTarget').html();
    dh += itempicker(subid, subonoff);

    onstart = $(target).css("background-color");
    if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) {
        onstart = $(generic).css("background-color");
        if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) { onstart = $("div.thing").css("background-color"); }
        if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) { onstart = "rgba(0, 0, 0, 1)"; }
    }

    if ( DEBUGte ) {
        console.log("target= "+ target+ " initial background-color= "+onstart);
    }
    var iconback = '<div class="colorgroup"> \
                  <label for="iconColor">Background Color</label> \
                  <input type="text" id="iconColor" caller="background" target="' + target + '" \
                  class="colorset" value="' + onstart + '"> \
                  </div>';
    
    if ( str_type==="page" && subid==="panel" ) {
        var ceffect = "<div class='colorgroup'><div class='infomsg'>Note: panels for pages cannot be styled. Only the names can be changed and the tab styled. To style the tab use tab or name fields.</div></div>";
        var resetbutton = getResetButton();
        $("#colorpicker").html(dh + ceffect + resetbutton);
    } else {

        // background effect
        var oneffect = $(target).css("background-image");
        var dirright = false;
        var isdark = false;
        var iseffect = -1;
        if ( oneffect ) { iseffect= oneffect.indexOf("linear-gradient"); }
        if ( iseffect !== -1 ) {
            iseffect = true;
            dirright = ( oneffect.indexOf("to right") !== -1 );
            isdark = ( oneffect.indexOf("50%") !== -1 );
        } else {
            iseffect = false;
        }

        var ceffect = "";
        ceffect += "<div class='colorgroup'><label for='editEffect'>Background Effect</label>";
        ceffect += "<select name=\"editEffect\" id=\"editEffect\" class=\"ddlDialog\">";

        var effects = [ ["none", "No Effect"],
                        ["hdark","Horiz. Dark"],
                        ["hlight","Horiz. Light"],
                        ["vdark","Vertical Dark"],
                        ["vlight","Vertical Light"]
        ];
        var stext = "";
        $.each(effects, function() {
            ceffect += "<option value=\"" + this[0] + "\"";
            if ( !iseffect && this[0]==="none") { stext = " selected"; }
            else if ( iseffect && dirright && isdark && this[0]==="hdark") { stext = " selected"; }
            else if ( iseffect && dirright && !isdark && this[0]==="hlight") { stext = " selected"; }
            else if ( iseffect && !dirright && isdark && this[0]==="vdark") { stext = " selected"; }
            else if ( iseffect && !dirright && !isdark && this[0]==="vlight") { stext = " selected"; }
            else if ( this[0]==="none") { stext = " selected"; }
            else { stext = ""; }

            ceffect += stext + ">" + this[1] + "</option>";


        });
        ceffect += "</select>";
        ceffect += "</div>";

        var sliderbox = target;
        if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" ) {
            sliderbox+= " .ui-slider";
            generic+= " .ui-slider";
        }
        
        onstart = $(sliderbox).css("color");
        if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) {
            onstart = $(generic).css("color");
            if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) { onstart = $("div.thing").css("color"); }
            if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) { onstart = "rgba(255, 255, 255, 1)"; }
        }
        if ( DEBUGte ) {
            console.log("target= "+ target+ ", initial color= "+onstart);
        }
        var iconfore = '<div class="colorgroup"> \
                      <label for="iconFore">Text Font Color</label> \
                      <input type="text" id="iconFore" \
                      caller="color" target="' + target + '" \
                      class="colorset" value="' + onstart + '"> \
                      </div>';

        // get the default font
        var ffamily = $(target).css("font-family");
        var fweight = $(target).css("font-weight");
        var fstyle = $(target).css("font-style");
        var fontdef;

        if ( ffamily===undefined || !ffamily || !ffamily.hasOwnProperty(("includes")) ) {
            fontdef = "sans";
        } else if ( ffamily.includes("Raleway") || ffamily.includes("Times") ) {
            fontdef = "serif";
        } else if ( ffamily.includes("Courier") || ffamily.includes("Mono") ) {
            fontdef = "mono";
        } else {
            fontdef = "sans";
        }
        if ( fweight==="bold" || ( isNumeric(fweight) && fweight > 500)  ) {
            fontdef+= "b";
        }
        if ( fstyle!=="normal") {
            fontdef+= "i";
        }

        var fe = "";
        fe += "<div class='colorgroup font'><label for='fontEffect'>Font Type</label>";
        fe += "<select name=\"fontEffect\" id=\"fontEffect\" class=\"ddlDialog\">";

        var fonts = {sans:"Sans", sansb:"Sans Bold", sansi:"Sans Italic", sansbi:"Sans Bold+Italic",
                     serif:"Serif", serifb:"Serif Bold", serifi:"Serif Italic", serifbi:"Serif Bold+Italic",
                     mono:"Monospace", monob:"Mono Bold", monoi:"Mono Italic", monobi:"Mono Bold+Italic" };
        for ( var key in fonts ) {
            if ( fonts.hasOwnProperty(key) ) {
                var checked = "";
                if ( key===fontdef) {
                    checked = " selected";
                }
                fe += "<option value=\"" + key + "\"" + checked + ">" + fonts[key] + "</option>";
            }
        }
        fe += "</select>";
        fe += "</div>";

        var f = $(target).css("font-size");
        f = parseInt(f);

        fe += "<div class='colorgroup font'><label for='editFont'>Font Size (px)</label>";
        fe += "<select name=\"fontEffect\" id=\"editFont\" class=\"ddlDialog\">";
        var sizes = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,28,32,36,40,44,48,52,60,80,100,120,160,200];
        sizes.forEach( function(sz, index, arr) {
            sz = parseInt(sz);
            var checked = "";
            if ( f === sz ) { checked = " selected"; }
            fe+= "<option value=\"" + sz + "px;\"" + checked + ">" + sz + "</option>";
        });
        fe += "</select>";
        fe += "</div>";

        var align = "";
        align += "<div id='alignEffect' class='colorgroup'><div class='sizeText'>Text Alignment</div><div class='editSection_input'>";
        align+= '<input id="alignleft" type="radio" name="align" value="left"><label for="alignleft">Left</label>';
        align+= '<input id="aligncenter" type="radio" name="align" value="center" checked><label for="aligncenter">Center</label>';
        align+= '<input id="alignright" type="radio" name="align" value="right"><label for="alignright">Right</label>';
        align += "</div></div>";

        // var ishidden = "<div class='editSection_input'><input type='checkbox' id='isHidden'><label class=\"iconChecks\" for=\"isHidden\">Hide Element?</label></div>";
        const ishidden = "";

        var inverted = "<div class='editSection_input'><input type='checkbox' id='invertIcon'><label class=\"iconChecks\" for=\"invertIcon\">Invert Element?</label></div>";
        inverted += "<div class='editSection_input'><input type='checkbox' id='absPlace'><label class=\"iconChecks\" for=\"absPlace\">Absolute Loc?</label></div>";

        // inverted += "<div class='editSection_input'><input type='checkbox' id='inlineOpt'><label class=\"iconChecks\" for=\"inlineOpt\">Inline?</label></div>";
        var inlineopts = "";
        inlineopts += "<div id='inlineEffect'><div class='editSection_input'>";
        inlineopts+= '<input id="inline1" type="radio" name="inlineOpt" value="inline"><label for="inline1">Inline</label>';
        inlineopts+= '<input id="inline2" type="radio" name="inlineOpt" value="inline-block" checked><label for="inline2">Inline-Block</label><br>';
        inlineopts+= '<input id="inline3" type="radio" name="inlineOpt" value="block"><label for="inline3">Block</label>';
        inlineopts+= '<input id="inline4" type="radio" name="inlineOpt" value="inherit"><label for="inline4">Inherit</label>';
        inlineopts+= '<input id="inline5" type="radio" name="inlineOpt" value="none"><label for="inline5">Hidden</label>';
        inlineopts += "</div></div>";

        var border = "<div class='editSection_input'><label for='borderType'>Border Type</label>";
        border += "<select name=\"borderType\" id=\"borderType\" class=\"ddlDialog\">";
        var borderopts = {"Select Option":"",
                          "None": "border: none; border-radius: 0%; box-shadow: none;",
                          "Shadow Square": "border: 2px solid #999999; border-right: 2px solid #333333; border-bottom: 2px solid #333333; border-radius: 0%; box-shadow: 2px 2px 7px black;",
                          "Simple Square": "border: 4px solid #666666; border-right: 4px solid #666666; border-bottom: 4px solid #666666; border-radius: 0%; box-shadow: none;",
                          "Solid Style": "border-style: solid;",
                          "Dashed Style": "border-style: dashed;",
                          "Dotted Style": "border-style: dotted;",
                          "Double Style": "border-style: double;",
                          "1x Border": "border-width: 1px; border-style: solid;",
                          "2x Border": "border-width: 2px;",
                          "4x Border": "border-width: 4px;",
                          "6x Border": "border-width: 6px;",
                          "10x Border": "border-width: 10px;",
                          "White Shadow": "box-shadow: 5px 4px 15px white;",
                          "Black Shadow": "box-shadow: 5px 4px 15px black;",
                          "No Shadow": "box-shadow: none;",
                          "Square": "border-radius: 0%;",
                          "Circle": "border-radius: 50%;",
                          "Small Rounded Rect": "border-radius: 5%;",
                          "Large Rounded Rect": "border-radius: 15%;"};
        for ( var bopt in borderopts ) {
            var checked = "";
            if ( bopt==="Select Option" ) { checked = " selected"; }
            border+= "<option value=\"" + borderopts[bopt] + "\"" + checked + ">" + bopt + "</option>";
        }
        border += "</select>";
        border += "</div>";

        onstart = $(target).css("border-color");
        if ( !onstart ) {
            onstart = $(generic).css("border-color");
            if ( !onstart ) { onstart = "rgba(0, 0, 0, 1)"; }
        }
        var brcolor = '<div class="colorgroup"> \
                      <label for="borderColor">Border Color</label> \
                      <input type="text" id="borderColor" caller="border" target="' + target + '" \
                      class="colorset" value="' + onstart + '"> \
                      </div>';

        var resetbutton = getResetButton();

        // insert the color blocks
        $("#colorpicker").html(dh + "<div id=\"colorsettings\">" + iconback + ceffect + iconfore + brcolor + border + fe + "</div>" + align + inlineopts + ishidden + inverted + resetbutton);

        // turn on minicolor for each one
        $('#colorpicker .colorset').each( function() {
            var strCaller = $(this).attr("caller");
            // alert("caller= "+strCaller);
            var startColor = $(this).val();
            var startTarget = $(this).attr("target");
            var subid = $("#subidTarget").html();
            var str_type = $("#tileDialog").attr("str_type");
            var thingindex = $("#tileDialog").attr("thingindex");

            // also update the wysiwyg tile for pages
            var target2 = "";
            if ( str_type==="page" ) {
                target2 = `div.wysiwyg.thing.page-thing.p_${thingindex}`;
                if ( subid!=="panel" ) {
                    target2 += ` div.overlay.${subid}.v_${thingindex} div.${subid}.p_${thingindex}`;
                }
            }
        
            $(this).minicolors({
                control: "hue",
                position: "bottom left",
                defaultValue: startColor,
                theme: 'default',
                opacity: true,
                format: 'rgb',
                change: function(strColor) {
                    updateColor(strCaller, startTarget, str_type, subid, thingindex, strColor, target2);
                }
            });
        });
    
    }

    // *********************
    // text margins
    // *********************

    var mtop;
    var mleft;
    var mbot;
    var mright;
    if ( subid==="panel" ) {
        mtop = parseInt($(target).css("background-position-y"));
        mleft = parseInt($(target).css("background-position-x"));
        mbot = parseInt($(target).css("margin-bottom"));
        mright = parseInt($(target).css("margin-right"));
    } else if ( $(target).css("position") && $(target).css("position").includes("absolute") && subid!=="wholetile" ) {
        mtop = parseInt($(target).css("top"));
        mleft = parseInt($(target).css("left"));
        mbot = parseInt($(target).css("bottom"));
        mright = parseInt($(target).css("right"));
   } else {
        mtop = parseInt($(target).css("margin-top"));
        mleft = parseInt($(target).css("margin-left"));
        mbot = parseInt($(target).css("margin-bottom"));
        mright = parseInt($(target).css("margin-right"));
    }
    if ( !mtop || isNaN(mtop) ) { mtop = 0; }
    if ( !mleft || isNaN(mleft) ) { mleft = 0; }
    if ( !mbot || isNaN(mbot) ) { mbot = 0; }
    if ( !mright || isNaN(mright) ) { mright = 0; }
    $("#topMargin").val(mtop);
    $("#leftMargin").val(mleft);
    $("#botMargin").val(mbot);
    $("#rightMargin").val(mright);

    // *********************
    // text paddings
    // *********************

    var ptop = parseInt($(target).css("padding-top"));
    var pleft = parseInt($(target).css("padding-left"));
    var pbot = parseInt($(target).css("padding-bottom"));
    var pright = parseInt($(target).css("padding-right"));
    if ( !ptop || isNaN(ptop) ) { ptop = 0; }
    if ( !pleft || isNaN(pleft) ) { pleft = 0; }
    if ( !pbot || isNaN(pbot) ) { pbot = 0; }
    if ( !pright || isNaN(pright) ) { pright = 0; }
    $("#topPadding").val(ptop);
    $("#leftPadding").val(pleft);
    $("#botPadding").val(pbot);
    $("#rightPadding").val(pright);

    // *********************
    // before & after text
    // *********************

    try {
        var txtBefore = window.getComputedStyle(document.querySelector(target), "::"+"before").getPropertyValue('content');
        if ( txtBefore==="none" ) {
            txtBefore = "";
        } else if ( txtBefore.startsWith('"') ) {
            txtBefore = txtBefore.substr(1, txtBefore.length-2);
        }
    } catch (e) {
        txtBefore = "";
    }
    $("#beforeText").val(txtBefore);

    // var txtAfter = $(target+"::after").css("content");
    try {
        var txtAfter = window.getComputedStyle(document.querySelector(target), "::"+"after").getPropertyValue('content');
        if ( txtAfter==="none" ) {
            txtAfter = "";
        } else if ( txtAfter.startsWith('"') ) {
            txtAfter = txtAfter.substr(1, txtAfter.length-2);
        }
    } catch (e) {
        txtAfter = "";
    }
    $("#afterText").val(txtAfter);

    // ****************
    // text alignment
    // ****************
    
    // set the text alignment
    var initalign = $(target).css("text-align");
    if ( initalign === "left") {
        $("#alignleft").prop("checked", true);
    } else if (initalign === "right") {
        $("#alignright").prop("checked", true);
    } else {
        $("#aligncenter").prop("checked", true);
    }

    // set initial hidden status
    // if ( subid==="wholetile" ) {
    //     $("#isHidden").prop("checked", false);
    //     $("#isHidden").prop("disabled", true);
    // } else {
    //     $("#isHidden").prop("disabled", false);
    //     $("#isHidden").css("background-color","white");
    //     var ishdefault = getCssRuleTarget(str_type, subid, thingindex, "overlay");
    //     var ishdefault2 = getCssRuleTarget(str_type, subid, thingindex);
    //     var ishidden = ($(ishdefault).css("display")==="none");
    //     ishidden = ishidden || ($(ishdefault2).css("display")==="none");

    //     // check all the other variations of this subid if we are still not sure if hidden
    //     if ( !ishidden ) {
    //         var ish = getish(str_type, thingindex, subid);
    //         ish.forEach(function(ishdefault3) {
    //             if (  $(ishdefault3) && $(ishdefault3).css("display")==="none" ) {
    //                 ishidden= true;
    //             }
    //         });
    //     }
    //     $("#isHidden").prop("checked", ishidden);
    // }
    
    // set the initial invert check box
    if ( $(target).css("filter") && $(target).css("filter").includes("invert(1)") ) {
        $("#invertIcon").prop("checked",true);
    } else {
        $("#invertIcon").prop("checked",false);
    }
    
    // set the initial abs check box
    if ( $(target).css("position") && $(target).css("position").includes("absolute") ) {
        $("#absPlace").prop("checked",true);
    } else {
        $("#absPlace").prop("checked",false);
    }

    // set the initial inline check box
    // if ( $(target).css("display") && $(target).css("display").includes("inline") ) {
    //     $("#inlineOpt").prop("checked",true);
    // } else {
    //     $("#inlineOpt").prop("checked",false);
    // }
    // inline settings are on the overlay target
    if ( $(overlayTarget).css("display") && !$(overlayTarget).css("display").includes("none") ) {
        var displayval = $(overlayTarget).css("display");
        if ( displayval==="inline" ) {
            $("#inline1").prop("checked",true);
        } else if ( displayval==="inline-block" ) {
            $("#inline2").prop("checked",true);
        } else if ( displayval==="block" ) {
            $("#inline3").prop("checked",true);
        } else if ( displayval==="hidden" ) {
            $("#inline5").prop("checked",true);
        } else {
            $("#inline4").prop("checked",true);
        }
    } else {
        $("#inline4").prop("checked",true);
    }
    
    // set the initial icon none check box
    var isicon = $(target).css("background-image");
    if ( isicon === "none") {
        $("#noIcon").prop("checked", true);
    } else {
        $("#noIcon").prop("checked", false);
    }

    // show what's on the clipboard
    $("#clipboard").val(et_Globals.clipboard.length + " items");

    // ****************
    // icon settings
    // ****************
    

    // set the icon alignment
    initalign = $(target).css("background-position-x");
    initalign = transAlign(initalign);
    $("#iconleft").val(initalign);
    initalign = $(target).css("background-position-y");
    initalign = transAlign(initalign);
    $("#icontop").val(initalign);
    
}

function transAlign(initalign) {
    var newalign;
    if ( !initalign ) {
        newalign = 50;
    } else if ( initalign==="left" ) {
        newalign = 0;
    } else if ( initalign==="center") {
        newalign = 50;
    } else if ( initalign==="right" ) {
        newalign = 100;
    } else {
        var len = initalign.length;
        newalign = parseInt(initalign.substring(0,len-1));
        newalign = isNaN(newalign) ? 50 : newalign;
    }
    return newalign;
}

// returns an array of valid triggers for checking hidden status
function getish(str_type, thingindex, subid) {
    var ish = [];

    var scope = $("#scopeEffect").val();

    // make this work only for this page if that option is selected
    if ( str_type!=="page" && et_Globals.pagename && ( scope==="thispage" || scope==="typepage" || scope==="allpage" ) ) {
        var divstr = "div." + et_Globals.pagename + ".";
    } else {
        divstr = "div.";
    }

    if ( subid==="head" ) {
        ish[0] = divstr + "thingname." + str_type;
        ish[1] = divstr + "thingname." + str_type + ".t_" + thingindex;
        ish[2] = divstr + "thing." + str_type + "-thing div.thingname." + str_type;
        ish[3] = divstr + "thing." + str_type + "-thing div.thingname." + str_type + ".t_" + thingindex;
    } else {

        ish[0]  = "div.overlay." + subid;
        ish[1]  = "div.overlay." + subid  + " div." + subid;
        ish[2]  = "div.overlay." + subid  + " div." + subid + ".p_"+thingindex;
        ish[3]  = "div.overlay." + subid + ".v_"+thingindex;
        ish[4]  = "div.overlay." + subid + ".v_"+thingindex  + " div." + subid;
        ish[5]  = "div.overlay." + subid + ".v_"+thingindex  + " div." + subid + ".p_"+thingindex;

        ish[6]  = divstr + "thing div.overlay." + subid;
        ish[7]  = divstr + "thing div.overlay." + subid  + " div." + subid;
        ish[8]  = divstr + "thing div.overlay." + subid  + " div." + subid + ".p_"+thingindex;
        ish[9]  = divstr + "thing div.overlay." + subid + ".v_"+thingindex;
        ish[10] = divstr + "thing div.overlay." + subid + ".v_"+thingindex  + " div." + subid;
        ish[11] = divstr + "thing div.overlay." + subid + ".v_"+thingindex  + " div." + subid + ".p_"+thingindex;

        ish[12] = divstr + "thing." + str_type + "-thing div.overlay." + subid;
        ish[13] = divstr + "thing." + str_type + "-thing div.overlay." + subid + " div." + subid;
        ish[14] = divstr + "thing." + str_type + "-thing div.overlay." + subid + " div." + subid + ".p_"+thingindex;
        ish[15] = divstr + "thing." + str_type + "-thing div.overlay." + subid + ".v_"+thingindex;
        ish[16] = divstr + "thing." + str_type + "-thing div.overlay." + subid + ".v_"+thingindex  + " div." + subid;
        ish[17] = divstr + "thing." + str_type + "-thing div.overlay." + subid + ".v_"+thingindex  + " div." + subid + ".p_"+thingindex;
    }
    return ish;
}
    
// main routine that sets the color of items
function updateColor(strCaller, cssRuleTarget, str_type, subid, thingindex, strColor, target2) {
    
    if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" || subid==="colorTemperature" ) {
        cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        const sliderline = cssRuleTarget;
        const sliderbox= sliderline + " .ui-slider";
        const sliderbox2= sliderbox + " span.ui-slider-handle";
        if ( strCaller==="background" ) {
            addCSSRule(sliderline, "background-color: " + strColor + ";");
        } else if ( strCaller==="border" ) {
            addCSSRule(sliderbox, "border-color: " + strColor + ";");
            addCSSRule(sliderbox, "background-color: " + strColor + ";");		
        } else {
            // addCSSRule(sliderbox, "background-color: " + strColor + ";");		
            addCSSRule(sliderbox2, "border-color: " + strColor + ";");		
            addCSSRule(sliderbox2, "background-color: " + strColor + ";");		
        }

    } else if ( strCaller==="background" ) {
        addCSSRule(cssRuleTarget, "background-color: " + strColor + ";");
        if ( target2 ) {
            addCSSRule(target2, "background-color: " + strColor + ";");
        }
    } else if ( strCaller==="border" ) {
        addCSSRule(cssRuleTarget, "border-color: " + strColor + ";");
        if ( target2 ) {
            addCSSRule(target2, "border-color: " + strColor + ";");
        }
    } else {
        // if ( str_type==="page" && (subid==="tab" || subid==="tabon") ) {
        //     cssRuleTarget += " a.ui-tabs-anchor";
        // }
        addCSSRule(cssRuleTarget, "color: " + strColor + ";");	
        if ( target2 ) {
            addCSSRule(target2, "color: " + strColor + ";");
        }
    }
}

// the old ST icons are now stored locally and obtained from an internal list for efficiency
function getIconCategories(iCategory) {
    // var specialCat = ["Main_Icons","Main_Media","Main_Photos","Modern_Icons","Modern_Media","Modern_Photos","User_Icons","User_Media","User_Photos"];
    var arrCat = ["Main_Icons","Main_Media","User_Icons","User_Media","User_Photos",
                  "Alarm","Appliances","BMW","Bath","Bedroom","Camera","Categories","Colors","Contact","Custom",
                  "Doors","Electronics","Entertainment","Food_Dining","Fridge","Harmony","Health_Wellness","Home",
                  "Illuminance","Indicators","Kids","Lighting","Lights","Locks","Motion","Nest","Office","Outdoor",
                  "Particulate","People","Presence","Quirky","Samsung","Seasonal_Fall","Seasonal_Winter","Secondary",
                  "Security","Shields","Sonos","Switches","Tesla","Thermostat","tomorrowio","Transportation","Unknown","Valves",
                  "Vents","Weather"];
    // arrCat = specialCat.concat(arrCat);
                  
    $('#iconSrc').empty();
    arrCat.forEach(function(iconCat) {
        var catText = iconCat.replace(/_/g, ' ')
        var item = $('<option>'+catText+'</option>').val(iconCat);
        if ( iCategory === iconCat ) {
            item.prop("selected",true);
        }
        $('#iconSrc').append(item);
    }); 
}

function getIcons() {
    var returnURL = cm_Globals.returnURL;
    var iCategory = $("#iconSrc").val();
    getIconCategories(iCategory);
    var skin = cm_Globals.options.skin;
    var pname = cm_Globals.options.pname;
    var thingid = et_Globals.thingid;
    
    // change to use php to gather icons in an ajax post call
    // this replaces the old method that fails on GoDaddy
    if ( !iCategory ) { iCategory = 'Main_Icons'; }
    var localPath = "";
    if ( iCategory.startsWith("Main_") ) {
        $("#uplButtons").removeClass("block").addClass("hidden");
        localPath = iCategory.substr(5).toLowerCase();
    } else if ( iCategory.startsWith("User_") ) {
        localPath = iCategory.substr(5).toLowerCase();
        $("#uplButtons").removeClass("hidden").addClass("block");
    } else {
        localPath = iCategory;
        $("#uplButtons").removeClass("block").addClass("hidden");
    }

    // removed the old method of reading icons from iconlist.txt since the files are no longer there
    $.post(returnURL, 
        {api: "geticons", id: 0, userid: et_Globals.userid, thingid: thingid, type: "none", 
         value: localPath, attr: iCategory, skin: skin, pname: pname, hpcode: cm_Globals.options.hpcode},
        function (presult, pstatus) {
            if (pstatus==="success" && presult ) {
                $('#iconList').html(presult);
                setupIcons(iCategory);
            } else {
                $('#iconList').html("<div class='error'>No icons available for: " + iCategory + "</div>");
            }
        }
    );
}

function uploadImage() {
    var pos = {top: 100, left: 150, width: 300};
    var iCategory = $("#iconSrc").val();
    var catText = iCategory.replace(/_/g, ' ')
    var userid = et_Globals.userid;
    var pname = cm_Globals.options.pname;
    var hpcode = cm_Globals.options.hpcode;

    // make the form to submit the file
    // the name attribute must match the name given in the multer instance of upload.single or upload.array
    var htmlcontent =  "<div>";
    htmlcontent += `<strong>Select file to upload to ${catText}:</strong><br><br>
        <form action="#" class="upload" method="post" id="uploadImage" enctype="multipart/form-data">
        <div>
        <input type="file" id="imageInput" accept="image/*" name="uploaded_file" />
        </div>
        <input type="hidden" id="fuserid" name="userid" value="${userid}" />
        <input type="hidden" id="fpanel" name="panel" value="${pname}" />
        <input type="hidden" id="fhpcode" name="hpcode" value="${hpcode}" />
        <input type="hidden" id="fcategory" name="category" value="${iCategory}" />
        <br><br>
        <input type="submit" name="upload" value="Upload" class="tebutton">
        <input id="uplcancel" name="cancel" type="button" value="Cancel" class="tebutton">
        </form>`;
    htmlcontent+= "</div>";

    createModal("modalupl", htmlcontent, "body", false, pos,
        function(ui) {
            $("#uplButtons").removeClass("hidden");
            $("#iconSrc").prop("disabled", false);
            $("#noIcon").prop("disabled", false);    
            et_Globals.insubmenu = false;
            closeModal("modalupl");
        },
        function() {

            et_Globals.insubmenu = true;
            $("#modalupl").draggable();

            $("#uplcancel").on("click", function(e) {
                console.log("closing");
                $("#uplButtons").removeClass("hidden");
                $("#iconSrc").prop("disabled", false);
                $("#noIcon").prop("disabled", false);    
                et_Globals.insubmenu = false;
                closeModal("modalupl");
            });
            
            $("form.upload").on("submit");
            $("form.upload").on("submit", function(e) {
                e.preventDefault();

                var imageInput = $('#imageInput')[0];
                if ( imageInput.files.length > 0 ) {
                    var thefile = imageInput.files[0];
                    console.log("Image selected to upload: ", thefile);
                } else {
                    console.warn("No file was selected to upload");
                    $("#uplButtons").removeClass("hidden");
                    $("#iconSrc").prop("disabled", false);
                    $("#noIcon").prop("disabled", false);

                    et_Globals.insubmenu = false;
                    closeModal("modalupl");
                    return;
                }

                // get the form and submit via ajax
                var myform = new FormData($(this)[0]);
                $.ajax({
                    url: cm_Globals.returnURL+'/upload?userid='+userid+'&pname='+pname+'&category='+iCategory+'&hpcode='+hpcode, 
                    type: 'POST',
                    method: 'POST',
                    dataType: 'json',
                    data: myform,
                    cache: false,
                    processData: false,
                    contentType: false,
                    success: function (presult) {
                        $("#uplButtons").removeClass("hidden");
                        $("#iconSrc").prop("disabled", false);
                        $("#noIcon").prop("disabled", false);

                        console.log("File: ", presult.filename," uploaded successfully to: ", presult.path);
                        getIcons();	
                        et_Globals.insubmenu = false;
                        closeModal("modalupl");
                    },
                    error: function(presult) {
                        $("#uplButtons").removeClass("hidden");
                        $("#iconSrc").prop("disabled", false);
                        $("#noIcon").prop("disabled", false);
                        
                        console.error("File upload failed: ", presult);
                        getIcons();	
                        et_Globals.insubmenu = false;
                        closeModal("modalupl");
                    }
                });
            });

        }
    );
}

function delImages(files) {
    var userid = et_Globals.userid;
    var pname = cm_Globals.options.pname;
    var returnURL = cm_Globals.returnURL;
    $.post(returnURL,
        {api: "delimages", userid: userid, pname: pname, value: files, hpcode: cm_Globals.options.hpcode},
        function (presult, pstatus) {
            if (pstatus==="success" && presult ) {
                $("div.iconcat input.delCheckbox").each(function() {
                    if ( $(this).prop("checked") === true ) {
                        $(this).parent().remove()
                    } else {
                        $(this).remove();
                    }
                });
                // console.log(`>>>> files removed: `, presult);
            } else {
                console.error("Error attempting to remove files: ", files, " status: ", pstatus);
            }
        }
    );
}

function getBgEffect(effect) {
    var strEffect = '';
    if ( !effect ) {
        effect = $('#editEffect').val();
    }

    switch (effect) {
        case "hdark":
            strEffect = ', linear-gradient(to right, rgba(0,0,0,.5) 0%,rgba(0,0,0,0) 50%, rgba(0,0,0,.5) 100%)';
            break;
                
        case "hlight":
            strEffect = ', linear-gradient(to right, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,.4) 100%)';
            break;
                
        case "vdark":
            strEffect = ', linear-gradient(to bottom, rgba(0,0,0,.5) 0%,rgba(0,0,0,0) 50%, rgba(0,0,0,.5) 100%)';
            break;
                
        case "vlight":
            strEffect = ', linear-gradient(to bottom, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,.4) 100%)';
            break;
    };	
    return strEffect;
}

// main routine that sets the icon of things
function iconSelected(category, cssRuleTarget, imagePath, str_type, thingindex) {
    var returnURL = cm_Globals.returnURL;
    $("#noIcon").prop('checked', false);
    var strEffect =  getBgEffect();
    
    // if the separator is back slash change to forward slash required by css
    imagePath = imagePath.replace(/\\/g,"/");
    if ( !category.startsWith("User_") && !imagePath.startsWith("http:") ) {
        imagePath = "../../" + imagePath;
    }

    var imgurl = 'background-image: url("' + imagePath + '")';
    addCSSRule(cssRuleTarget, imgurl + strEffect + ";");
}

function updateSize(str_type, subid, thingindex) {
    var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
    
    if ( $("#autoBgSize").is(":checked") ) {
        $("#bgSize").prop("disabled", true);
        $("#bgSize").css("background-color","gray");
        addCSSRule(cssRuleTarget, "background-size: cover;");
    } else {
        $("#bgSize").prop("disabled", false);
        $("#bgSize").css("background-color","white");
        var iconsize = $("#bgSize").val();
        var rule;
        iconsize = parseInt( iconsize );
        if ( isNaN(iconsize) || iconsize <= 0 ) {
            if ( subid.startsWith("music") ) {
                rule = "40px;"
            } else if ( str_type==="page" ) {
                rule = "cover;";
            } else {
                iconsize = 80;
                rule = iconsize.toString() + "px;";
            }
        } else {
            rule = iconsize.toString() + "px;";
        }
        addCSSRule(cssRuleTarget, "background-size: " + rule);
    }
}

// removed the old addRule support since older browsers won't work with HP anyway
// and simplified function to no longer assume arrays passed since this is never done
function addCSSRule(selector, rules, resetFlag, beforetag){
    // alert("Adding selector: " + selector + " rule: " + rules);

     if ( ! typeof selector==="string" || ! typeof rules==="string") {
        return;
    }

    // get main sheet with selectors and rules
    var sheet = document.getElementById('customtiles').sheet; // returns an Array-like StyleSheetList
    cm_Globals.edited = true;

    // Searching of the selector matching cssRules
    var index = -1;
    for(var i=sheet.cssRules.length-1; i >=0; i--) {
        var current_style = sheet.cssRules[i];
        if( current_style.selectorText === selector && current_style.style.item(0)!=="content" ) {
            //Append the new rules to the current content of the cssRule;
            if ( !resetFlag ) {
                rules=current_style.style.cssText + " " + rules;
                sheet.deleteRule(i);
                index = i;
            } else {
                index = i+1;
            }
        } else if ( beforetag && ( (current_style.selectorText + "::" + beforetag) === selector) && current_style.style.item(0)==="content"  ) {
            sheet.deleteRule(i);
            index = i;
        } else if ( beforetag && current_style.selectorText === selector && current_style.style.item(0)==="content"  ) {
            sheet.deleteRule(i);
            index = i;
        }
    }

    if ( index === -1 ) {
        index = 0;
    }

    try {
        sheet.insertRule(selector + "{" + rules + "}", index);	  
    } catch (e) {}
}

function resetCSSRules(str_type, thingindex, onesubid){

    var numdel = 0;
    if ( str_type === "page" ) {
        var subids = [ "panel", "tab", "tabon", "name", "nameon" ];
        subids.forEach( function(subid) {
            if ( onesubid==="panel" || subid===onesubid ) {
                var subtarget = getCssRuleTarget(str_type, subid, thingindex);
                if ( subtarget ) {
                    numdel+= removeCSSRule(str_type, subtarget, thingindex);
                }
            }
        });

    } else {
        var subids = ['wholetile','head'];
        subids.forEach( function(subid) {
            if ( onesubid==="wholetile" || subid===onesubid ) {
                var subtarget = getCssRuleTarget(str_type, subid, thingindex);
                if ( subtarget ) {
                    numdel+= removeCSSRule(str_type, subtarget, thingindex);
                }
            }
        });

        $(`#te_wysiwyg > div.overlay.v_${thingindex} div.p_${thingindex}`).each(function() {
            var subid = $(this).attr("subid");

            if ( onesubid==="wholetile" || subid===onesubid ) {
                // remove main target
                var target1 = getCssRuleTarget(str_type, subid, thingindex);
                numdel+= removeCSSRule(str_type, target1, thingindex);

                // handle removal of slider formatting
                if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" || subid==="colorTemperature" ) {
                    var sliderbox = target1 + " .ui-slider";
                    numdel+= removeCSSRule(str_type, sliderbox, thingindex);
                    var sliderbox2= sliderbox + " span.ui-slider-handle";
                    numdel+= removeCSSRule(str_type, sliderbox2, thingindex);
                }
            
                // remove all the subs
                var val = $(target1).html();
                var onoff = getOnOff(str_type, subid, val);
                if ( onoff && onoff.length > 0 ) {
                    onoff.forEach( function(ison) {
                        if ( ison ) {
                            var subtarget = target1 + "." + ison;
                            numdel+= removeCSSRule(str_type, subtarget, thingindex);
                        }
                    });
                }

                // also remove just pure instances of overlay
                var target2 = getCssRuleTarget(str_type, subid, thingindex, "overlay");
                numdel+= removeCSSRule(str_type, target2, thingindex);

                // now get all the other potential variations of this subid and remove them too if there
                var ish = getish(str_type, thingindex, subid);
                ish.forEach( function(target3) {
                    removeCSSRule(str_type, target3, thingindex);

                });
            }
        });

    }
    if ( DEBUGte ) {
        console.log("removed ", numdel, " parameters from CSS file");
    }
}

function removeCSSRule(str_type, strMatchSelector, thingindex, scope=null){
    if ( !scope ) {
        scope = $("#scopeEffect").val();
    }

    var numdel = 0;
    var sheet = document.getElementById('customtiles').sheet; // returns an Array-like StyleSheetList
    for (var i=sheet.cssRules.length; i--;) {
        var current_style = sheet.cssRules[i];


        // str = {
        //     "thistile": `This ${str_type} tile, All pages`,
        //     "thispage": `This ${str_type} tile, This page`,
        //     "typetile": `All ${str_type} tiles, All pages`,
        //     "typepage": `All ${str_type} tiles, This page`,
        //     "alltile": `All tiles, All pages`,
        //     "allpage": `All tiles, This page`
        // };


        // remove if a scope of alltile was picked or if rule is in this tile's category
        // or if we pick the wholetile scope in which case we remove everything done to this tile
        if  (   (   ( scope==="alltile" || scope==="allpage" || scope==="typetile" || scope==="typepage" || scope==="everything" ||
                      ( str_type!=="page" && current_style.selectorText.indexOf("_"+thingindex) !== -1 ) ||
                      ( str_type==="page" && current_style.selectorText.indexOf(`panel-${thingindex}`) !== -1 ) ||
                      ( str_type==="page" && current_style.selectorText.indexOf(`tab-${thingindex}`) !== -1 )
                    ) && (current_style.selectorText === strMatchSelector) 
                ) ||
                ( scope==="everything" && str_type!=="page" && current_style.selectorText.indexOf("_"+thingindex) !== -1 ) ||
                ( scope==="everything" && str_type==="page" && current_style.selectorText.indexOf("panel-"+thingindex) !== -1 ) ||
                ( scope==="everything" && str_type==="page" && current_style.selectorText.indexOf("tab-"+thingindex) !== -1 )
            ) 
        {
            sheet.deleteRule(i);
            numdel++;
            cm_Globals.edited = true;
        }
    }
    return numdel;
}

function saveClipboard(userid, str_type, thingindex, rules) {
    var returnURL = cm_Globals.returnURL;
    $.post(returnURL,
        {api: "clipboard", userid: userid, type: str_type, tile: thingindex, value: rules, attr: "save", hpcode: cm_Globals.options.hpcode},
        function (presult, pstatus) {
            if (pstatus==="success" ) {
                // console.log(`>>>> clipboard updated with ${rules.length} items: `, rules);
                $("#clipboard").val(rules.length + " items");
                et_Globals.clipboard = rules;
            }
        }
    );

}

function copyCSSRule(str_type, thingindex, fixsubid){
    var scope = $("#scopeEffect").val();
    var sheet = document.getElementById('customtiles').sheet; // returns an Array-like StyleSheetList

    // loop through all the subid's
    var targets = [];
    var subidmap = {};

    if ( fixsubid && fixsubid!=="wholetile" ) {
        var target = getCssRuleTarget(str_type, fixsubid, thingindex);
        subidmap[target] = fixsubid;
    } else {
        if ( str_type==="page" ) {
            var subidtypes = [ "panel", "tab", "tabon", "name", "nameon" ];
            subidtypes.forEach( function(subid) {
                var target = getCssRuleTarget(str_type, subid, thingindex);
                subidmap[target] = subid;
            });    
        } else {
            var subidtypes = ['wholetile','head'];
            subidtypes.forEach( function(subid) {
                var target = getCssRuleTarget(str_type, subid, thingindex, scope);
                subidmap[target] = subid;
            });

            $(`#te_wysiwyg > div.overlay.v_${thingindex} div.p_${thingindex}`).each(function() {
                var subid = $(this).attr("subid");
                var target = getCssRuleTarget(str_type, subid, thingindex, scope);
                if ( typeof subidmap[target] === "undefined" ) {
                    subidmap[target] = subid;
                }

                // handle removal of slider formatting
                if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" || subid==="colorTemperature" ) {
                    var sliderbox = target + " .ui-slider";
                    if ( typeof subidmap[sliderbox] === "undefined" ) {
                        subidmap[sliderbox] = subid;
                    }
                    var sliderbox2= sliderbox + " span.ui-slider-handle";
                    if ( typeof subidmap[sliderbox2] === "undefined" ) {
                        subidmap[sliderbox2] = subid;
                    }
                
                // get all the subs
                } else {
                    var val = $(target).html();
                    var onoff = getOnOff(str_type, subid, val);
                    if ( onoff && onoff.length > 0 ) {
                        onoff.forEach( function(rule) {
                            if ( rule ) {
                                var subtarget = target + "." + rule;
                                if ( typeof subidmap[subtarget]==="undefined" ) {
                                    subidmap[subtarget] = subid;
                                }
                            }
                        });
                    }
                }
            });
        }
    }
    
    var targets = Object.keys(subidmap);

    var myrules = [];
    for (var i=sheet.cssRules.length; i--;) {
        var current_style = sheet.cssRules[i];
        var rule = current_style.style.cssText;
        // if ( ( current_style.selectorText.indexOf("_"+thingindex) !== -1 ) && 
        //      (targets.includes(current_style.selectorText) )  ) 
        if ( targets.includes(current_style.selectorText) ) {
            var target = current_style.selectorText;
            var subid = subidmap[target];
            myrules.push({type: str_type, index: thingindex, subid: subid, target: target, rule: rule});
        }
    }
    return myrules;
}

function pasteCSSRule(rules, str_type, thingindex, fixsubid){

    // gather all the subid names in the paste target tile
    // or if we are pointing at a specific subid, only paste into that
    var subids = [];
    if ( fixsubid && fixsubid!=="wholetile" ) {
        subids.push(fixsubid);
    } else {
        if ( str_type==="page" ) {
            var subidtypes = ['tab','tabon','panel','name'];
            subidtypes.forEach( function(subid) {
                subids.push(subid);
            });
        } else {
            var subidtypes = ['wholetile','head','name'];
            subidtypes.forEach( function(subid) {
                subids.push(subid);
            });    
            $(`div.overlay.v_${thingindex} div.p_${thingindex}`).each(function() {
                var subid = $(this).attr("subid");
                if ( !subids.includes(subid) ) {
                    subids.push(subid);
                }
            });
        }
    }

    // loop through rules and set the targets when the type and subid match
    var myrules = [];
    rules.forEach( function(rule) {
        var rtype = rule.type;
        var rindex = rule.index;
        var target = rule.target;
        var subid = rule.subid;

        // only if this tile supports the subid associated with the copied rule do we proceed
        if ( subids.includes(subid) ) {


            // replace the index and tile type in the selector
            // this allows pasting to happen across different types of tiles
            // need to do replacement twice since the index could be there twice
            // and I didn't know how to use regex and /g when variables are involved
            if ( str_type==="page" ) {
                if ( subid==="panel" ) {
                    target = target.replace(`div.panel.panel-${rindex}`,`div.panel.panel-${thingindex}`);
                } else {
                    target = target.replace(`.tab-${rindex}`,`.tab-${thingindex}`);
                    target = target.replace(`.tab-${rindex}`,`.tab-${thingindex}`);
                }
            } else {
                target = target.replace(`div.thing.${rtype}-thing`,`div.thing.${str_type}-thing`);
                target = target.replace(`div.thing.${rtype}-thing`,`div.thing.${str_type}-thing`);
                target = target.replace(`p_${rindex}`,`p_${thingindex}`);
                target = target.replace(`p_${rindex}`,`p_${thingindex}`);
                if ( subid==="head" ) {
                    target = target.replace(`t_${rindex}`,`t_${thingindex}`);
                } else {
                    target = target.replace(`v_${rindex}`,`v_${thingindex}`);
                    target = target.replace(`v_${rindex}`,`v_${thingindex}`);
                }
            }

            var pasterule = {type: str_type, index: thingindex, subid: subid, target: target, rule: rule.rule};
            myrules.push(pasterule);
            addCSSRule(target, rule.rule, "thistile");
        }
    });

    return myrules;
}
