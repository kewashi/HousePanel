/* Tile Editor for HousePanel
 * 
 * Inspired by @nitwit on SmartThings forum
 * rewritten by Ken Washington @kewashi on the forum
 * 
 * Designed for use only with HousePanel
 * (c) Ken Washington 2017 - 2023
 * 
 */
var DEBUGte = false;
var et_Globals = {};
et_Globals.savedSheet = "";
et_Globals.priorIcon = "none";
et_Globals.tileCount = 0;

function editTile(userid, thingid, pagename, str_type, thingindex, aid, bid, thingclass, hubid, hubindex, hubType, customname, htmlcontent) {  
    var returnURL = cm_Globals.returnURL;
    et_Globals.aid = aid;
    et_Globals.id = bid;
    et_Globals.hubid = hubid;
    et_Globals.hubindex = hubindex;
    et_Globals.hubType = hubType;
    et_Globals.pagename = pagename;
    et_Globals.userid = userid;
    et_Globals.thingid = thingid;

    if ( str_type==="page" ) {
        et_Globals.wholetarget = getCssRuleTarget(str_type, "name", thingindex, "thistile");
    } else {
        et_Globals.wholetarget = getCssRuleTarget(str_type, "wholetile", thingindex, "thitile");
    }

    var dialog_html = "<div id='tileDialog' class='tileDialog' str_type='" + str_type + "' thingindex='" + thingindex +"' >";
    if ( str_type==="page" ) {
        dialog_html += "<div class='editheader' id='editheader'>Editing Page#" + et_Globals.hubid + 
                   " Name: " + thingindex + "</div>";
        
    } else {
        dialog_html += "<div class='editheader' id='editheader'>Editing Tile #" + thingindex + 
                   " of Type: " + str_type + "</div>";
    }

    // option on the left side
    dialog_html += colorpicker(str_type, thingindex);

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
        jqxhr = $.post(returnURL, 
            {useajax: "pagetile", userid: userid, thingid: thingid, id: hubid, type: 'page', tileid: thingindex, value: thingindex, attr: customname},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    htmlcontent = presult;
                }
            }
        );
        
    } else if ( htmlcontent ) {
        htmlcontent = "<div class=\"" + thingclass + "\" id='te_wysiwyg'>" + htmlcontent + "</div>";
    } else {
        // put placeholder and populate after Ajax finishes retrieving true content
        // this is actually no longer used but left code here in case I want to use it later
        htmlcontent = "<div id='error'>Edit dialog cannot be displayed</div>";
        htmlcontent = "<div class=\"" + thingclass + "\" id='te_wysiwyg'>" + htmlcontent + "</div>";

        jqxhr = $.post(returnURL, 
            {useajax: "wysiwyg", userid: userid, thingid: thingid, id: bid, type: str_type, tile: thingindex, value: "", attr: ""},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    htmlcontent = presult;
                }
            }
        );

    }
    dialog_html += "</div>";
    
    // * DIALOG_END *
    dialog_html += "</div>";
    
    // create a function to display the tile
    var dodisplay = function() {
        var pos = {top: 100, left: 200, zindex: 998};
        createModal("modaledit", dialog_html, "body", true, pos, 
            // function invoked upon leaving the dialog
            function(ui, content) {
                $("body").off("keydown");
                $("body").off("keypress");
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
            function(hook, content) {
                $("body").on("keydown",function(e) {
                    if ( e.which===13  ){
                        $("#modalokay").click();
                    }
                    if ( e.which===27  ){
                        $("#modalcancel").click();
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
    if (dimension == 'width'){
        var originalWidth = this.css("width");
        if ( originalWidth === "auto") {
            return true;    
        } else{
            return false;
        }
    } else if (dimension == 'height'){
        var originalHeight = this.css("height");
        if ( originalHeight === "auto") {
                return true;    
        } else{
            return false;
        }
    } else {
        return false;
    }
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
        
        if ( subid==="tab" ) {
            target = "li.ui-tabs-tab.ui-state-default";
            if ( scope==="thistile" ) { target+= '.tab-'+thingindex; }
            // target+= ",.tab-" +thingindex + ">a.ui-tabs-anchor";

        } else if ( subid==="tabon" ) {
            target = "li.ui-tabs-tab.ui-state-default.ui-tabs-active";
            if ( scope==="thistile" ) { target+= '.tab-'+thingindex; }
            // target+= ",.tab-" +thingindex + ">a.ui-tabs-anchor";

        } else if ( subid==="panel" ) {
            target = "#dragregion div.panel";
            if ( scope==="thistile" ) { target+= '.panel-'+ thingindex; }

        } else if ( subid==="name" ) {
            target = "li.ui-tabs-tab.ui-state-default";
            if ( scope==="thistile" ) { target+= '.tab-'+thingindex; }
            target = target + " a.ui-tabs-anchor";

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
        ostarget = "#a-" + et_Globals.aid + "-thermostatOperatingState";
        swval = $(ostarget).html();
    }

    if ( swval && swval.startsWith("LINK::") ) {
        var ipos = swval.lastIndexOf("::");
        var linkid = swval.substring(ipos+2);
        var linkaid = $("div.thing[tile='"+linkid+"']").attr("aid");
        swval = $("#a-"+linkaid+"-"+subid).html();
    }
    
    // activate the icon click to use this
    var onoff = getOnOff(str_type, subid, swval);
    var newsub = 0;
    if ( onoff && onoff.length > 1 ) {
        for ( var i=0; i < onoff.length; i++ ) {
            var oldsub = onoff[i];
            
            if ( $(target).hasClass(oldsub) ) { 
                $(target).removeClass(oldsub); 
            }
            if ( $(target).hasClass(oldsub.toLowerCase()) ) { 
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
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        
        var img = $(this).attr("show") || $(this).attr("src");
        var subid = $("#subidTarget").html();
        var strIconTarget = getCssRuleTarget(str_type, subid, thingindex);
        if ( DEBUGte ) {
            console.log("Clicked on img= "+img+" Category= "+category+" strIconTarget= "+strIconTarget+" type= "+str_type+" subid= "+subid+" index= "+thingindex);
        }
        iconSelected(category, strIconTarget, img, str_type, thingindex);
    });
}

function checkboxHandler(idselect, onaction, offaction, overlay, isreset) {
    $(idselect).off('change');
    $(idselect).on("change",function() {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var overlayTarget;
        if ( overlay ) {
            overlayTarget = getCssRuleTarget(str_type, subid, thingindex, "overlay");
        }
        // var overlayTarget = "div.overlay." + subid + ".v_" + thingindex;
        if($(idselect).is(':checked')){
            if ( typeof onaction === "function" ) {
                onaction = onaction();
            }
            onaction.forEach(function(act) {
                if (overlay && overlayTarget) {
                    // console.log(">>>> overlay: ", overlayTarget, act, isreset, subid);
                    addCSSRule(overlayTarget, act, isreset);
                }
                // console.log(">>>> css: ", cssRuleTarget, act, isreset, subid);
                addCSSRule(cssRuleTarget, act, isreset);
            });
        } else {
            if ( typeof offaction === "function" ) {
                offaction = offaction();
            }
            offaction.forEach(function(act) {
                if (overlay && overlayTarget) {
                    // console.log(">>>> overlay: ", overlayTarget, act, isreset, subid);
                    addCSSRule(overlayTarget, act, isreset);
                }
                // console.log(">>>> css: ", cssRuleTarget, act, isreset, subid);
                addCSSRule(cssRuleTarget, act, isreset);
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
        var subid = $("#subidTarget").html();
        initColor(str_type, subid, thingindex);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });

    // act on triggers from picking an item from the list
    $("#subidselect").off('change');
    $("#subidselect").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $(event.target).val();
        var target = getCssRuleTarget(str_type, subid, thingindex);
        var targetid = "#x_a-"+$(target).attr("aid")+"-"+subid;
        toggleTile(targetid, str_type, subid, false);
        initColor(str_type, subid, thingindex);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });

    // set up triggers for edits to change based on what is clicked
    var trigger = "div"; // div." + str_type + ".p_"+thingindex;
    // var trigger = "div." + str_type + ".p_"+thingindex;
    $("#te_wysiwyg").off('click', trigger);
    $("#te_wysiwyg").on('click', trigger, function(event) {
        var target = event.target;
        // only allow picking of things with an "aid" element - changed from "id" to pick up arrows
        if ( ! $(target).attr("aid") ) {
            target = $(target).parent();
            if ( ! $(target).attr("aid") ) {
                return;
            }
        }
        var subid = $(target).attr("subid");
        var aid = $(target).attr("aid");
        var targetid = "#"+$(target).attr("id");
        var ustr_type = $("#t-"+aid).attr("type");
        var uthingindex = $("#t-"+aid).attr("tile");
        // console.log(">>>> target:", target, $(target).attr("id"), " event class: ", $(target).attr("class")), subid, aid, ustr_type, uthingindex;

        if ( ustr_type && uthingindex ) {
            str_type = ustr_type;
            thingindex = uthingindex;
        }

        $("#tileDialog").attr("str_type",str_type);
        $("#tileDialog").attr("thingindex",thingindex);
        if ( !subid ) {
            subid = (str_type==="page") ? "panel" : $("#subidTarget").html();
        }
        
        // update everything to reflect current tile
        $("#subidselect").val(subid);
        toggleTile(targetid, str_type, subid, true);
        initColor(str_type, subid, thingindex);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });

}

function initDialogBinds(str_type, thingindex) {

    // set up all the check boxes

    // function checkboxHandler(idselect, onaction, offaction, overlay, isreset) {
    checkboxHandler("#invertIcon",["filter: invert(1);"],["filter: invert(0);"], false, false);
    checkboxHandler("#absPlace",["position: absolute;","margin-left: 0px;","margin-top: 0px;","margin-right: 0px;","margin-bottom: 0px;","top: 0px;","left: 0px;","right: 0px;","bottom: 0px;"],
                                ["position: relative;","margin-left: 0px;","margin-top: 0px;","margin-right: 0px;","margin-bottom: 0px;","top: 0px;","left: 0px;","right: 0px;","bottom: 0px;"], false, false);
    checkboxHandler("#inlineOpt",["display: inline-block;"], ["display: block;"], true, false);
    checkboxHandler("#isHidden", ["display: none;"], ["display: block;"], true, false);

    $("#borderType").off('change');
    $("#borderType").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var borderstyle = $(this).val();
        if ( borderstyle!=="" ) {
            if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" ) {
                var sliderbox= cssRuleTarget + " .ui-slider";
                var sliderbox2= sliderbox + " span.ui-slider-handle";
                addCSSRule(sliderbox, borderstyle);
                addCSSRule(sliderbox2, borderstyle);
            } else {
                addCSSRule(cssRuleTarget, borderstyle);
            }
        }
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
    });
    
    $("#editReset").off('click');
    $("#editReset").on('click', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        resetCSSRules(str_type, subid, thingindex);
        event.stopPropagation;
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
        event.stopPropagation;
    });

    $("#iconSrc").off('change');
    $("#iconSrc").on('change', function (event) {
        getIcons(str_type, thingindex);	
        event.stopPropagation;
    });
    
    $("#bgSize").off('change');
    $("#bgSize").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        updateSize(str_type, subid, thingindex);
        event.stopPropagation;
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
        event.stopPropagation;
    });
    
    $("#bgRepeat").off('change');
    $("#bgRepeat").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rule = "background-repeat: " + $("#bgRepeat").val() + ";";
        addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        event.stopPropagation;
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
        event.stopPropagation;
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
            // if ( str_type==="switchlevel" || str_type==="bulb" ) {
            //     addCSSRule("div.overlay.level.v_"+thingindex+" .ui-slider", rule);
            // }
        }
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
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
            // if ( str_type==="switchlevel" || str_type==="bulb" ) {
            //     addCSSRule("div.overlay.level.v_"+thingindex+" .ui-slider", rule);
            // }
        }
        
        // if ( str_type === "thermostat" ) {
        //     addCSSRule( "div.thermostat-thing.p_"+thingindex+" div.heatingSetpoint", midrule);
        //     addCSSRule( "div.thermostat-thing.p_"+thingindex+" div.coolingSetpoint", midrule);
        // }
        event.stopPropagation;
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
        event.stopPropagation;
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
        event.stopPropagation;
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
            console.log("auto rule: ", rule);
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
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
                if ( newsize === 0 ) {
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
            }
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        if ( subid === "panel" ) {
            rule = "background-position-y: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else if ( str_type==="page" ) {
            rule = "margin-top: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" ) {
                rule = "top: " + newsize;
            } else {
                rule = "margin-top: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        if ( subid === "panel" ) {
            if ( newsize !== "0px;" ) newsize = "-" + newsize;
            rule = "background-position-y: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else if ( str_type==="page" ) {
            rule = "margin-bottom: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" ) {
                rule = "bottom: " + newsize;
            } else {
                rule = "margin-bottom: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        var rule;
        if ( str_type==="page" ) {
            rule = "padding-top: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            rule = "padding-top: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        var rule;
        if ( str_type==="page" ) {
            rule = "padding-bottom: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            rule = "padding-bottom: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set margin for selected item
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
        if ( subid === "panel" ) {
            rule = "background-position-x: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else if ( str_type==="page" ) {
            rule = "margin-left: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" ) {
                rule = "left: " + newsize;
            } else {
                rule = "margin-left: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set margin for selected item
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
        if ( subid === "panel" ) {
            if ( newsize !== "0px;" ) newsize = "-" + newsize;
            rule = "background-position-x: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else if ( str_type==="page" ) {
            rule = "margin-right: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked && subid!=="wholetile" ) {
                rule = "right: " + newsize;
            } else {
                rule = "margin-right: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        var rule;
        if ( str_type==="page" ) {
            rule = "padding-left: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            rule = "padding-left: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        var rule;
        if ( str_type==="page" ) {
            rule = "padding-right: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else {
            rule = "padding-right: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
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
        if ( subid !== "wholetile" && subid !== "panel" && str_type!=="page" ) {
            var csstag = getCssRuleTarget(str_type, subid, thingindex) + "::" + before_after;
            addCSSRule(csstag, rule, false, before_after);
        }

    }

    // set padding for selected item
    $("#beforeText").off('change');
    $("#beforeText").on('change', function(event) {
        txtModify("before");
        event.stopPropagation;
    });

    // set padding for selected item
    $("#afterText").off('change');
    $("#afterText").on('change', function(event) {
        txtModify("after");
        event.stopPropagation;
    });
    
}

function iconlist() {
    var dh = "";
	dh += "<div id='editicon'>";

    // icon selector
	dh += "<div id='iconChoices'>";
	dh += "<select name=\"iconSrc\" id=\"iconSrc\" class=\"ddlDialog\"></select>";
	dh += "<input type='checkbox' id='noIcon'>";
	dh += "<label class=\"iconChecks\" for=\"noIcon\">None</label>";
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

// function editSection(str_type, thingindex) {
    // var dh = "";
        // dh += "<div id='editSection'>";
        // dh += "<div class='colorgroup'><label id=\"labelName\"></label><input name=\"editName\" id=\"editName\" class=\"ddlDialog\" value=\"" + "" +"\"></div>";
        // dh += "<div class='colorgroup'><button id='processName' type='button'>Save Name</button></div>";
        // dh += getScope(str_type, true);
        // dh += sizepicker(str_type, thingindex);
        // dh += "</div>";
    // return dh;
// }

function getScope(str_type, ftime) {
    var dh = "";
    dh += "<div class='colorgroup'><label>Effect Scope:</label>";
    dh += "<select name=\"scopeEffect\" id=\"scopeEffect\" class=\"ddlDialog\">";
    if ( str_type==="page" ) {
        dh += "<option value=\"thistile\" selected>This page</option>";
        dh += "<option value=\"alltile\">All pages</option>";
    } else {
        if ( et_Globals.pagename==="floorplan" ) {
            var seltile = "";
            var selpage = " selected";
        } else {
            seltile = " selected";
            selpage = "";
        }
        dh += "<option value=\"thistile\"" + seltile + ">This tile, All pages</option>";       // old mode 0
        dh += "<option value=\"thispage\"" + selpage + ">This tile, This page</option>";       // old mode 0 w/ floorplan
        dh += "<option value=\"typetile\">All " + str_type + " tiles, All pages</option>";     // old mode 1
        dh += "<option value=\"typepage\">All " + str_type + " tiles, This page</option>";     // new mode
        dh += "<option value=\"alltile\">All tiles, All pages</option>";                       // old mode 2
        dh += "<option value=\"allpage\">All tiles This page</option>";                        // new mode
    }
    dh += "</select>";
    dh += "</div>";
    return dh;
}

function editSection(str_type, thingindex) {
    var dh = "";

    var subid = setsubid(str_type);
    var target = getCssRuleTarget(str_type, subid, thingindex);
    var targetwhole = getCssRuleTarget(str_type, subid, thingindex, "wholetile"); //  "div.thing."+str_type+"-thing";
    
    dh += "<div id='editSection'>";

    dh += "<div class='colorgroup'><label id=\"labelName\"></label><input name=\"editName\" id=\"editName\" class=\"ddlDialog\" value=\"" + "" +"\"></div>";
    dh += "<div class='colorgroup'><button id='processName' type='button'>Save Name</button></div>";
    dh += getScope(str_type, true);


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
    
    dh += "<div class='sizeText'>Overall Tile Size</div>";
    dh += "<div class='editSection_inline'>";
    dh += "<label for='tileHeight'>Tile H: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"tileHeight\" value=\"" + th + "\"/>";
    dh += "<label for='tileWidth'>Tile W: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"tileWidth\" value=\"" + tw + "\"/>";
    dh += "</div>";

    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoTileHeight'><label class=\"iconChecks\" for=\"autoTileHeight\">Auto H?</label></div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoTileWidth'><label class=\"iconChecks\" for=\"autoTileWidth\">Auto W?</label></div>";

    dh += "<div class='editSection_input'>";
    var curFloat = $(targetwhole).css("float");
    var floats = ["none", "left", "right"];
    var fe = "<label for='tileFloat'>Tile Float: </label>";
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

    dh += "<div class='sizeText'><p>Item Size & Position:</p></div>";
    dh += "<div class='editSection_inline'>";
    dh += "<label for='editHeight'>Item H: </label>";
    dh += "<input size='4' type=\"number\" min='5' max='1600' step='5' id=\"editHeight\" value=\"" + h + "\"/>";
    dh += "<label for='editWidth'>Item W: </label>";
    dh += "<input size='4' type=\"number\" min='5' max='1600' step='5' id=\"editWidth\" value=\"" + w + "\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoHeight'><label class=\"iconChecks\" for=\"autoHeight\">Auto H?</label></div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoWidth'><label class=\"iconChecks\" for=\"autoWidth\">Auto W?</label></div>";

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
    dh += "<div class='editSection_input'>";
    dh += "<label for='beforeText'>Text Before:</label>";
    dh += "<input size='10' id=\"beforeText\" value=\"\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='afterText'>Text After:</label>";
    dh += "<input size='10' id=\"afterText\" value=\"\"/>";
    dh += "</div>";
    // var resetbutton = "<br /><br /><button id='editReset' type='button'>Reset</button>";
    // dh += resetbutton;

    dh += "</div>";
    
    return dh;
}

function colorpicker(str_type, thingindex) {
    var dh = "";
    dh += "<div id='colorpicker'>";
    dh += "<div class='colorgroup'>";
    dh += "<label>Feature Selected:</label>";
    dh += "<div id='subidTarget' class='dlgtext'></div>";
    dh += "<div id='onoffTarget' class='dlgtext'></div>";
    dh+= "</div></div>";
    return dh;
}

function setupClicks(str_type, thingindex) {
    var firstsub = setsubid(str_type);
    $("#subidTarget").html(firstsub);
    var target = getCssRuleTarget(str_type, firstsub, thingindex);
    var targetid = "#x_a-"+$(target).attr("aid")+"-"+firstsub;

    // do an initial toggle so edits can start right away
    toggleTile( targetid, str_type, firstsub, false);
    initColor(str_type, firstsub, thingindex);
    loadSubSelect(str_type, firstsub, thingindex);
    getIcons(str_type, thingindex);	
    initDialogBinds(str_type, thingindex);
    initOnceBinds(str_type, thingindex);
    
}

function loadSubSelect(str_type, firstsub, thingindex) {
        
    // get list of all the subs this tile supports
    var subcontent = "";
    
    if ( str_type==="page" ) {
        subcontent += "<option value='head' selected>Page Name</option>";
        subcontent += "<option value='panel'>Panel</option>";
        subcontent += "<option value='tab'>Tab Inactive</option>";
        subcontent += "<option value='tabon'>Tab Active</option>";
    } else {
        // subcontent += "<div class='editInfo'><button class='cm_button' id='cm_activateCustomize'>Customize</button></div>";
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
                // console.log(">>>> three items: ", subdown, subup );
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
        {useajax: "updatenames", userid: userid, thingid: thingid, id: 0, type: str_type, value: newname, tile: thingindex},
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
    var skin = $("#skinid").val();
    var pname = $("#showversion span#infoname").html();

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
            {useajax: "savetileedit", userid: userid, skin: skin, id: n1, n1: n1, n2: n2, nlen: sheetContents.length, 
                                      type: str_type, value: subcontent, attr: newname, tile: thingindex, pname: pname},
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
                            alert("A new custom CSS file was generated for panel = [" + pname + "] This will be automatically updated as you make edits. You must relaunch editor again.");
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

// add all the color selectors
function initColor(str_type, subid, thingindex) {
  
    var onstart;
    if ( subid==="thingname" ) {
        subid = "head";
    }

    var newtitle;
    if ( str_type==="page" ) {
        newtitle = "Editing Page#" + et_Globals.hubid + " Name: " + thingindex;
        $("#labelName").html("Page Name:");
    } else {
        newtitle = "Editing Tile #" + thingindex + " of Type: " + str_type;
        $("#labelName").html("Tile Name:");
        var tgname = getCssRuleTarget(str_type, "name", thingindex, "thistile");
        var name =  $(tgname).html();
        $("#editName").val(name);
            if ( et_Globals.tileCount > 1 ) {
            newtitle+= " (editing " + et_Globals.tileCount + " items)";
        }
    }
    $("#editheader").html(newtitle);

    // selected background color
    // TODO - generalize this
    var scope = $("#scopeEffect").val();
    var target = getCssRuleTarget(str_type, subid, thingindex, scope);
    if ( scope==="thistile" ) {
        var generic = target;
    } else {
        generic = getCssRuleTarget(str_type, subid, thingindex, "thistile");
    }
    var icontarget = "#tileDisplay " + target;

    if ( DEBUGte ) {
        console.log ("initcolor: str_type= " + str_type + " subid= " + subid + " thingindex= " + thingindex + " target= " + target);
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
    // if ( str_type==="page" ) { alert("iconsize= " + iconsize); }
    
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
    dh += "<div class='colorgroup'><label>Feature Selected:</label>";
    dh += "<div id='subidTarget' class='dlgtext'>" + subid + "</div>";
    var subonoff = $('#onoffTarget').html();
    dh += "<div id='onoffTarget' class='dlgtext'>" + subonoff + "</div>";
    dh += "</div>";

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
    
    if ( str_type==="page" && subid==="head" ) {
        var ceffect = "<div class='colorgroup'><label>Note: Header field for pages cannot be styled. Only the name can be changed. To style the name, select a Tab item.</label>";
        $("#colorpicker").html(dh + ceffect);
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
        ceffect += "<div class='colorgroup'><label>Background Effect:</label>";
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
        fe += "<div class='colorgroup font'><label>Font Type:</label>";
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

        fe += "<div class='colorgroup font'><label>Font Size (px):</label>";
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
        align += "<div id='alignEffect' class='colorgroup'><label>Text Alignment:</label><div class='editSection_input'>";
        align+= '<input id="alignleft" type="radio" name="align" value="left"><label for="alignleft">Left</label>';
        align+= '<input id="aligncenter" type="radio" name="align" value="center" checked><label for="aligncenter">Center</label>';
        align+= '<input id="alignright" type="radio" name="align" value="right"><label for="alignright">Right</label>';
        align += "</div></div>";

        var ishidden = "";
        ishidden += "<div class='editSection_input autochk'>";
        ishidden += "<input type='checkbox' id='isHidden'>";
        ishidden += "<label class=\"iconChecks\" for=\"isHidden\">Hide Element?</label></div>";

        var inverted = "<div class='editSection_input autochk'><input type='checkbox' id='invertIcon'><label class=\"iconChecks\" for=\"invertIcon\">Invert Element?</label></div>";
        inverted += "<div class='editSection_input'><input type='checkbox' id='absPlace'><label class=\"iconChecks\" for=\"absPlace\">Absolute Loc?</label></div>";
        inverted += "<div class='editSection_input'><input type='checkbox' id='inlineOpt'><label class=\"iconChecks\" for=\"inlineOpt\">Inline?</label></div>";

        var border = "<div class='editSection_input'><label>Border Type:</label>";
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

        var resetbutton = "<br /><br /><button id='editReset' type='button'>Reset</button>";

        // insert the color blocks
        $("#colorpicker").html(dh + iconback + ceffect + iconfore + brcolor + border + fe + align + ishidden + inverted + resetbutton);

        // *********************
        // text margins
        // *********************

        // turn on minicolor for each one
        $('#colorpicker .colorset').each( function() {
            var strCaller = $(this).attr("caller");
            // alert("caller= "+strCaller);
            var startColor = $(this).val();
            var startTarget = $(this).attr("target");
            var subid = $("#subidTarget").html();
            $(this).minicolors({
                control: "hue",
                position: "bottom left",
                defaultValue: startColor,
                theme: 'default',
                opacity: true,
                format: 'rgb',
                change: function(strColor) {
                    var str_type = $("#tileDialog").attr("str_type");
                    var thingindex = $("#tileDialog").attr("thingindex");
                    updateColor(strCaller, startTarget, str_type, subid, thingindex, strColor);
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
    $("#topMargin").val(mtop);
    $("#leftMargin").val(mleft);
    $("#botMargin").val(mbot);
    $("#rightMargin").val(mright);

    // *********************
    // text paddings
    // *********************

    var ptop = parseInt($(target).css("padding-top"));
    var pbot = parseInt($(target).css("padding-bottom"));
    var pleft = parseInt($(target).css("padding-left"));
    var pright = parseInt($(target).css("padding-right"));
    if ( !ptop || isNaN(ptop) ) { ptop = 0; }
    if ( !pleft || isNaN(pleft) ) { pleft = 0; }
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
    if ( subid==="wholetile" ) {
        $("#isHidden").prop("checked", false);
        $("#isHidden").prop("disabled", true);
        $("#isHidden").css("background-color","gray");
    } else {
        $("#isHidden").prop("disabled", false);
        $("#isHidden").css("background-color","white");
        var ishdefault = getCssRuleTarget(str_type, subid, thingindex, "overlay");
        var ishdefault2 = getCssRuleTarget(str_type, subid, thingindex);
        var ish = getish(str_type, thingindex, subid);
        // var ishidden = false;
        var ishidden = ($(ishdefault).css("display")==="none");
        ishidden = ishidden || ($(ishdefault2).css("display")==="none");
        for ( var i = 0; i< ish.length; i++) {
            if (  $(ish[i]) && $(ish[i]).css("display")==="none" ) {
                ishidden= true;
            }
        }
        $("#isHidden").prop("checked", ishidden);
    }
    
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
    if ( $(target).css("display") && $(target).css("display").includes("inline") ) {
        $("#inlineOpt").prop("checked",true);
    } else {
        $("#inlineOpt").prop("checked",false);
    }
    
    // set the initial icon none check box
    var isicon = $(target).css("background-image");
    if ( isicon === "none") {
        $("#noIcon").prop("checked", true);
    } else {
        $("#noIcon").prop("checked", false);
    }

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

        ish[0]  = divstr + "overlay." + subid;
        ish[1]  = divstr + "overlay." + subid  + " div." + subid;
        ish[2]  = divstr + "overlay." + subid  + " div." + subid + ".p_"+thingindex;
        ish[3]  = divstr + "overlay." + subid + ".v_"+thingindex;
        ish[4]  = divstr + "overlay." + subid + ".v_"+thingindex  + " div." + subid;
        ish[5]  = divstr + "overlay." + subid + ".v_"+thingindex  + " div." + subid + ".p_"+thingindex;

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
function updateColor(strCaller, cssRuleTarget, str_type, subid, thingindex, strColor) {
    
    if ( subid==="level" || subid==="onlevel" || subid==="volume" || subid==="position" ) {
        cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex); //  "div.overlay.level.v_" + thingindex;
        var sliderline = cssRuleTarget;
        var sliderbox= sliderline + " .ui-slider";
        var sliderbox2= sliderbox + " span.ui-slider-handle";
        if ( strCaller==="background" ) {
            addCSSRule(sliderline, "background-color: " + strColor + ";");
        } else if ( strCaller==="border" ) {
            addCSSRule(sliderbox, "border-color: " + strColor + ";");
            addCSSRule(sliderbox2, "border-color: " + strColor + ";");		
        } else {
            addCSSRule(sliderbox, "background-color: " + strColor + ";");		
            // addCSSRule(sliderbox, "color: " + strColor + ";");
            addCSSRule(sliderbox2, "background-color: " + strColor + ";");		
            // addCSSRule(sliderbox2, "color: " + strColor + ";");		
        }

    } else if ( strCaller==="background" ) {
        addCSSRule(cssRuleTarget, "background-color: " + strColor + ";");		
    } else if ( strCaller==="border" ) {
        addCSSRule(cssRuleTarget, "border-color: " + strColor + ";");		
    } else {
        if ( str_type==="page" && (subid==="tab" || subid==="tabon") ) {
            cssRuleTarget += " a.ui-tabs-anchor";
        }
        addCSSRule(cssRuleTarget, "color: " + strColor + ";");	
    }
}

// the old ST icons are now stored locally and obtained from an internal list for efficiency
function getIconCategories(iCategory) {
    var specialCat = ["Main_Icons","Main_Media","User_Icons","User_Media"];
    // var specialCat = ["Main_Icons","Main_Media","Main_Photos","Modern_Icons","Modern_Media","Modern_Photos","User_Icons","User_Media","User_Photos"];
    // var arrCat = [];
    
    var arrCat = ["Alarm","Appliances","BMW","Bath","Bedroom","Camera","Categories","Colors","Contact","Custom",
                  "Doors","Electronics","Entertainment","Food_Dining","Fridge","Harmony","Health_Wellness","Home",
                  "Illuminance","Indicators","Kids","Lighting","Lights","Locks","Motion","Nest","Office","Outdoor",
                  "Particulate","People","Presence","Quirky","Samsung","Seasonal_Fall","Seasonal_Winter","Secondary",
                  "Security","Shields","Sonos","Switches","Tesla","Thermostat","Transportation","Unknown","Valves",
                  "Vents","Weather"];
    arrCat = specialCat.concat(arrCat);
                  
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
    var skindir = $("#skinid").val();
    var pname = $("#showversion span#infoname").html();
    
    // change to use php to gather icons in an ajax post call
    // this replaces the old method that fails on GoDaddy
    if ( !iCategory ) { iCategory = 'Main_Icons'; }
    var localPath = "";
    if ( iCategory.startsWith("Main_") ) {
        localPath = iCategory.substr(5).toLowerCase();
    } else if ( iCategory.startsWith("User_") ) {
        localPath = iCategory.substr(5).toLowerCase();
        // localPath = "../../" + skindir + "/" + iCategory.substr(5).toLowerCase();
    } else if ( iCategory.startsWith("Modern_") ) {
        localPath = iCategory.substr(7).toLowerCase();
    // } else {
    //     localPath = iCategory;
    //     // localPath = "../../media/" + iCategory;
    }
    // alert("path = "+localPath);

    if ( localPath ) {
        $.post(returnURL, 
            {useajax: "geticons", id: 0, userid: et_Globals.userid, thingid: et_Globals.thingid, type: "none", value: localPath, attr: iCategory, skin: skindir, pname: pname},
            function (presult, pstatus) {
                if (pstatus==="success" && presult ) {
                    $('#iconList').html(presult);
                    setupIcons(iCategory);
                } else {
                    $('#iconList').html("<div class='error'>No icons available for: " + iCategory + "</div>");
                }
            }
        );
    } else {
        var icons = '';
        $.ajax({
            url: 'iconlist.txt',
            type:'GET',
            success: function (data) {
                var arrIcons = data.toString().replace(/[\t\n]+/g,'').split(',');
                $.each(arrIcons, function(index, val) {
                    var iconCategory = val.substr(0, val.indexOf('|'));
                    iconCategory = $.trim(iconCategory).replace(/\s/g, '_');	
                    if (iconCategory === iCategory) {
                        var iconPath = val.substr(1 + val.indexOf('|'));
                        var k1 = iconPath.lastIndexOf("/");
                        var k2 = iconPath.lastIndexOf(".png");
                        var froot = iconPath.substring(k1+1, k2);
                        icons+='<div class="iconcat"><img class="icon" src="' + iconPath + '" title="' + froot + '"></div>';
                    }
                });			
                $('#iconList').html(icons);
                setupIcons(iCategory);
            }
        });
        
    }
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

function resetCSSRules(str_type, subid, thingindex){

        cm_Globals.edited = true;
        var ruletypes = ['wholetile','head','name'];
        ruletypes.forEach( function(rule) {
            var subtarget = getCssRuleTarget(str_type, rule, thingindex);
            if ( subtarget ) {
                removeCSSRule(subtarget, thingindex, null, null);
            }
        });

        // remove main target
        var target1 = getCssRuleTarget(str_type, subid, thingindex);
        removeCSSRule(target1, thingindex, null, null);
        
        // remove all the subs
        var val = $(target1).html();
        var onoff = getOnOff(str_type, subid, val);
        if ( onoff && onoff.length > 0 ) {
            onoff.forEach( function(rule) {
                if ( rule ) {
                    var subtarget = target1 + "." + rule; // getCssRuleTarget(str_type, rule, thingindex);
                    removeCSSRule(subtarget, thingindex, null, null);
                }
            });
        }
}

function removeCSSRule(strMatchSelector, thingindex, target, scope){
    if ( !scope ) {
        scope = $("#scopeEffect").val();
    }
    var numdel = 0;
    var sheet = document.getElementById('customtiles').sheet; // returns an Array-like StyleSheetList
    for (var i=sheet.cssRules.length; i--;) {
        var current_style = sheet.cssRules[i];
        var rule = current_style.style.cssText;
        var newrule = "";
        if ( (scope==="alltile" || scope==="allpage" || ( thingindex && current_style.selectorText.indexOf("_"+thingindex) !== -1 )) && 
             (current_style.selectorText === strMatchSelector) &&
             (!target || rule.indexOf(target) !== -1) ) 
        {
            sheet.deleteRule(i);
            numdel++;
            if ( target ) {
                var k1 = rule.indexOf(target);
                var k2 = rule.indexOf(";", k1);
                newrule = rule.substring(0, k1) + rule.substring(k2+1);
                // sheet.addRule(strMatchSelector, newrule, i);
                sheet.insertRule(strMatchSelector + "{" + newrule + "}", i);	  
            }
            cm_Globals.edited = true;
        }
    }
    return numdel;
}
