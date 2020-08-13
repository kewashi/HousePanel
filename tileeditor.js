/* Tile Editor for HousePanel
 * 
 * Original version by @nitwit on SmartThings forum
 * heavily modified by Ken Washington @kewashi on the forum
 * 
 * Designed for use only with HousePanel for Hubitat, SmartThings, and ISY
 * (c) Ken Washington 2017 - 2020
 * 
 */
var et_Globals = {};
var savedSheet;
var priorIcon = "none";
var defaultOverlay = "block";
var tileCount = 0;

// popup dialog box now uses createModal
//       editTile(roomname, "page", roomname,     0,   0,   "",        roomnum, "None",  "None");
function editTile(pagename, str_type, thingindex, aid, bid, thingclass, hubnum, hubName, hubType, customname, htmlcontent) {  
    // var returnURL;
    // try {
    //     returnURL = $("input[name='returnURL']").val();
    // } catch(e) {
    //     returnURL = "housepanel.php";
    // }
    var returnURL = cm_Globals.returnURL;
    
    if ( str_type!=="page") {
        et_Globals.aid = aid;
        et_Globals.id = bid;
    }
    et_Globals.hubnum = hubnum;
    if ( !hubName || !hubnum || hubName==="None" || hubnum==="-1" ) {
        et_Globals.hubName = "None";
    } else {
        et_Globals.hubName = hubName;
    }
    et_Globals.hubType = hubType || "None";
    et_Globals.pagename = pagename;
    if ( str_type==="page" ) {
        et_Globals.wholetarget = getCssRuleTarget(str_type, "name", thingindex, "thistile");
    } else {
        et_Globals.wholetarget = getCssRuleTarget(str_type, "wholetile", thingindex, "thitile");
    }

    // save the sheet upon entry for cancel handling
    savedSheet = document.getElementById('customtiles').sheet;
    
    // * DIALOG START *	
    var dialog_html = "<div id='tileDialog' class='tileDialog' str_type='" + 
                      str_type + "' thingindex='" + thingindex +"' >";
	
    // header
    if ( str_type==="page" ) {
        dialog_html += "<div class='editheader' id='editheader'>Editing Page#" + et_Globals.hubnum + 
                   " Name: " + thingindex + "</div>";
        
    } else {
        dialog_html += "<div class='editheader' id='editheader'>Editing Tile #" + thingindex + 
                   " of Type: " + str_type + "</div>";
    }

    // option on the left side - colors and options
    dialog_html += colorpicker(str_type, thingindex);
    dialog_html += editSection(str_type, thingindex);
    
    // icons on the right side
    dialog_html += iconlist();
    
    // tileEdit display on the far right side 
    dialog_html += "<div id='tileDisplay' class='tileDisplay'>";
    dialog_html += "<div id='editInfo' class='editInfo'>Select or Change State</div>";
    
    // we either use the passed in content or make an Ajax call to get the content
    var jqxhr = null;
    if ( str_type==="page" ) {
        jqxhr = $.post(returnURL, 
            {useajax: "wysiwyg", id: hubnum, type: 'page', tile: thingindex, value: thingindex, attr: customname},
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
        jqxhr = $.post(returnURL, 
            {useajax: "wysiwyg", id: bid, type: str_type, tile: thingindex, value: "te_wysiwyg", attr: customname},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    htmlcontent = presult;
                }
            }
        );
    }
    dialog_html += "<div id='subsection'></div>";
    dialog_html += "</div>";
    
    // * DIALOG_END *
    dialog_html += "</div>";
    
    // create a function to display the tile
    var dodisplay = function() {
        var pos = {top: 100, left: 200, zindex: 998};
        createModal("modalid", dialog_html, "body", true, pos, 
            // function invoked upon leaving the dialog
            function(ui, content) {
                $("body").off("keydown");
                var clk = $(ui).attr("name");
                if ( clk==="okay" ) {
                    saveTileEdit(str_type, thingindex);
                } else if ( clk==="cancel" ) {
                    cancelTileEdit(str_type, thingindex);
                }
                tileCount = 0;
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
                $("#modalid").draggable();
            }
        );
    };
    
    if ( jqxhr ) {
        jqxhr.done(function() {
            dodisplay();
            $("#editInfo").after(htmlcontent);
            tileCount++;
            setupClicks(str_type, thingindex);
        });
    } else {
        dodisplay();
        $("#editInfo").after(htmlcontent);
        tileCount++;
        setupClicks(str_type, thingindex);
    }
    
}

$.fn.isAuto = function(dimension){
    // will detect auto widths including percentage changes
    if (dimension == 'width'){
        var originalWidth = this.css("width");
        var parentWidth = this.parent().css("width");
        // pick some weird big number
        var testWidth = 2000;
        this.parent().css({width: testWidth});
        var newWidth = this.css("width");
        this.parent().css({width: parentWidth});
        // console.log(originalWidth, newWidth, parentWidth);
        if ( newWidth > originalWidth ) {
            return true;    
        } else{
            return false;
        }
    } else if (dimension == 'height'){
        var originalHeight = this.height();
        // this.append('<div id="testzzz"></div>');
        // var testHeight = originalHeight+500;
        // $('#testzzz').css({height: testHeight});
        var newHeight = this.height();
        // $('#testzzz').remove();
        if( newHeight > originalHeight ) {
            return true;    
        } else{
            return false;
        }
    } else {
        return false;
    }
};

function getOnOff(str_type, subid) {
    var onoff;
    var hubType = et_Globals.hubType;

    // handle the cases for custom tiles that could have any subid starting with valid names
    if ( subid.startsWith("switch" ) ) {
        if ( hubType==="ISY" || str_type==="isy" ) {
            onoff = ["DON","DOF"];
        } else if ( hubType==="Hubitat" ) {
            onoff = ["on","off","flash"];
        } else {
            onoff = ["on","off"];
        }
    } else if ( (str_type==="momentary") && subid.startsWith("momentary" ) ) {
        onoff = ["on","off"];
    } else if ( str_type==="button" && subid.startsWith("button") ) {
        onoff = ["pushed","held"];
        // alert("subid = " + subid);
    } else if ( subid.startsWith("contact" ) || subid.startsWith("valve" ) ) {
        onoff = ["open","closed"];
    } else if ( subid.startsWith("door" ) ) {
        onoff = ["open","closed", "opening", "closing"];
    } else if ( subid.startsWith("lock" ) ) {
        onoff = ["locked","unlocked","unknown"];
    } else if ( subid.startsWith("motion") ) {
        onoff = ["active","inactive"];
    } else if ( subid.startsWith("windowShade") ) {
        onoff = ["open","closed","partially open"];
    } else if ( subid.startsWith("pistonName" ) ) {
        onoff = ["firing","idle"];
    } else if ( subid.startsWith("thermostatFanMode" ) ) {
        if ( hubType==="ISY" || str_type==="isy" ) {
            onoff = ["Auto","On"];
        } else {
            onoff = ["auto","on"];
        }
    } else if ( subid.startsWith("thermostatMode" ) ) {
        if ( hubType==="ISY" || str_type==="isy" ) {
            onoff = ["Heat","Cool","Auto","Off"];
        } else {
            onoff = ["heat","cool","auto","off"];
        }
    } else if ( subid.startsWith("thermostatOperatingState" ) ) {
        if ( hubType==="ISY" || str_type==="isy" ) {
            onoff = ["Idle","Heating","Cooling","Off"];
        } else {
            onoff = ["idle","heating","cooling","off"];
        }
    } else if ( subid.startsWith("musicstatus" ) || subid.startsWith("playbackStatus") ) {
        onoff = ["stopped","paused","playing"];
    } else if ( subid.startsWith("musicmute" ) || (str_type==="audio" && subid.startsWith("mute")) ) {
        onoff = ["muted","unmuted"];
    } else if ( subid.startsWith("presence" ) ) {
        onoff = ["present","absent"];
    } else if ( subid.startsWith("state" ) ) {
        onoff = ["Away","Home","Night","Disarmed"];
    } else if ( str_type==="mode" && subid.startsWith("themode" ) ) {
        onoff = [];
        // get all the modes supported by this location
        $("#t-"+et_Globals.aid).find("div.overlay > div.mode").each( function(index) {
            var subid = $(this).attr("subid");
            if ( subid.startsWith("_") ) {
                var locmode = $(this).html();
                onoff.push(locmode);
            }
        });
        // onoff = ["Away","Home","Night", ""];
    } else {
        onoff = [""];
    }
    onoff.push("");
    
    return onoff;
}

function getCssRuleTarget(str_type, subid, thingindex, userscope) {

    // get the scope to use
    var scope;
    if ( userscope ) { 
        scope = userscope; 
    } else {
        scope = $("#scopeEffect").val();
    }

    function getScope() {
        // start with alltile and allpage assumptions
        var tg = "div.thing";
        // add on assumption for the next four options
        if ( scope==="typetile" || scope==="typepage" || scope==="thistile" || scope==="thispage" || scope==="overlay" ) { 
            tg+= "." + str_type + "-thing"; 
        }
        // finally if we are asking for a specific tile add that specifier
        if ( scope==="thistile" || scope==="thispage" ) { 
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
        // console.log("page= ", thingindex," target= ", target);\

    } else if ( scope==="overlay" ) {
        target = getScope();
        
        // handle music controls special case
        if ( subid.startsWith("music-") ) {
            target+= " div.overlay.music-controls";
        } else if ( subid.endsWith("-dn") || subid.endsWith("-up") ) {
            target+= " div.overlay." + subid.substring(0,subid.length-3);
        } else {
            target+= " div.overlay." + subid;
        }
        target+= '.v_'+thingindex;

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

        // for everything other than levels, set the subid target
        // levels use the overlay layer only
        // set the subid which is blank if it matches the tile type
        // edit... changed to only use the subid since that is all we need
        //         this enables custom tile editing to work properly
        //         since the str_type can be any linked item for those
        if ( subid!=="level" && subid!=="volume" ) {
            target+= " div." + subid;
            if ( scope==="thistile" || scope==="thispage" ) {
                target+= '.p_'+thingindex;
            }
        }

        // get the on/off state
        // set the target to determine on/off status
        // we always use the very specific target to this tile
        if ( subid==="name" || subid==="track" || subid==="weekday" || subid.startsWith("music-") ||
             subid==="color" || subid==="level" || subid==="volume" ||
             subid==="cool" || subid==="heat" || subid==="stream" ) {
            on = "";
        } else {
            // var onofftarget = "div.overlay." + subid + '.v_' + thingindex + " div."+str_type + subidtag + '.p_'+thingindex;
            var on = $("#onoffTarget").html();
            if ( on && !$.isNumeric(on) && (on.indexOf(" ") === -1) ) {
                on = "."+on;
            } else {
                on = "";
            }
        }

        // if ( on==="." ) { on= ""; }
        target = target + on;
    }

    // make this work only for this page if that option is selected
    // the target will always start with "div." so we strip off the div
    if ( et_Globals.pagename && str_type!=="page" && scope==="thispage" || scope=="typepage" || scope==="allpage" ) {
        target = "div." + et_Globals.pagename + target.substr(3);
    }

    // debug print of how we got the target
    console.log("csstarget: type= ", str_type, " subid= ", subid, " tile= ", thingindex, " scope= ", scope, " target: ", target);

    return target;
}

function toggleTile(target, str_type, subid) {
    var swval = $(target).html();
    $('#onoffTarget').html("");
    
    // activate the icon click to use this
    var onoff = getOnOff(str_type, subid);
    var newsub = 0;
    if ( onoff && onoff.length > 1 ) {
        for ( var i=0; i < onoff.length; i++ ) {
            var oldsub = onoff[i];
            
            if ( $(target).hasClass(oldsub) ) { 
                $(target).removeClass(oldsub); 
            }
            if ( oldsub === swval || (oldsub==="" && swval=="_all_") ) {
                newsub = i+1;
                if ( newsub >= onoff.length ) { newsub= 0; }
                if ( onoff[newsub]==="" ) {
                    $(target).html("_all_");
                } else {
                    $(target).addClass( onoff[newsub] ); 
                    $(target).html( onoff[newsub] );
                }
                $('#onoffTarget').html(onoff[newsub]);
                break;
            }
        }
    }
};

// activate ability to click on icons
function setupIcons(category, old_str_type, old_thingindex) {

    $("#iconList").off("click","img");
    $("#iconList").on("click","img", function() {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        
        var img = $(this).attr("src");
        var subid = $("#subidTarget").html();
        var strIconTarget = getCssRuleTarget(str_type, subid, thingindex);
        // console.log("Clicked on img= "+img+" Category= "+category+" strIconTarget= "+strIconTarget+" type= "+str_type+" subid= "+subid+" index= "+thingindex);
        iconSelected(category, strIconTarget, img, str_type, thingindex);
    });
}

function initDialogBinds(str_type, thingindex) {
	
    $('#noIcon').on('change', function() {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var strEffect = getBgEffect();
        
        if( $("#noIcon").is(':checked') ){
            priorIcon = $(cssRuleTarget).css("background-image");
            addCSSRule(cssRuleTarget, "background-image: none" + strEffect + ";");
        } else {
            if ( priorIcon!=="none" ) {
                addCSSRule(cssRuleTarget, "background-image: " + priorIcon + strEffect + ";");
            }
        }
    });
        
    // new button to process the name change
    $("#processName").on("click", function (event) {
        updateNames(str_type, thingindex);
        event.stopPropagation;
    });

    $("#iconSrc").on('change', function (event) {
        getIcons(str_type, thingindex);	
        event.stopPropagation;
    });
    
    $("#bgSize").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        updateSize(str_type, subid, thingindex);
        event.stopPropagation;
    });
    
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

    // set overall tile height
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
    $("#tileWidth").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var newsize = parseInt( $("#tileWidth").val() );
        var rule = "width: " + newsize.toString() + "px;";
        if ( str_type==="page" ) {
            addCSSRule(getCssRuleTarget(str_type, 'panel', thingindex), rule);
        } else {
            addCSSRule(getCssRuleTarget(str_type, 'wholetile', thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, 'head', thingindex), rule);
            // if ( str_type==="switchlevel" || str_type==="bulb" ) {
            //     addCSSRule("div.overlay.level.v_"+thingindex+" .ui-slider", rule);
            // }
        }
        
        // handle special case of thermostats that need to have widths fixed
        // if ( str_type === "thermostat" ) {
        //     var midsize = newsize - 64;
        //     rule = "width: " + midsize.toString() + "px;";
        //     addCSSRule( "div.thermostat-thing.p_"+thingindex+" div.heatingSetpoint", rule);
        //     addCSSRule( "div.thermostat-thing.p_"+thingindex+" div.coolingSetpoint", rule);
        // }
        event.stopPropagation;
    });

    // set overall tile width and header and overlay for all subitems
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
    $("#autoHeight").on('change', function(event) {
        var subid = $("#subidTarget").html();
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var rule;
        if ( $("#autoHeight").is(":checked") ) {
            // special handling for default temperature circles
            if ( subid==="temperature" || subid==="feelsLike" ) {
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
                if ( subid === "wholetile" ) {
                    rule = "height: 150px;";
                } else if ( subid==="temperature" || subid==="feelsLike" ) {
                    rule = "height: 50px; line-height: 45px;";
                } else {
                    rule = "height: 16px;";
                }
            } else {
                newsize = newsize.toString() + "px;";
                rule = "height: " + newsize;
            }
        }
        if ( subid !== "wholetile" ) {
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set the item width
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
        if ( subid === "wholetile" || subid === "panel" ) {
            rule = "background-position-y: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else if ( str_type==="page" ) {
            rule = "padding-top: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else if ( subid==="temperature" || subid==="feelsLike" ||
                    subid==="weatherIcon" || subid==="forecastIcon" ) {
            rule = "margin-top: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked ) {
                rule = "top: " + newsize;
            } else {
                rule = "padding-top: " + newsize;
            }
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        }
        event.stopPropagation;
    });

    // set padding for selected item
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
        if ( subid === "wholetile" || subid === "panel" ) {
            rule = "background-position-x: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else if ( str_type==="page" ) {
            rule = "padding-left: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, "tab", thingindex), rule);
            addCSSRule(getCssRuleTarget(str_type, "tabon", thingindex), rule);
        } else if ( subid==="temperature" || subid==="feelsLike" ||
                    subid==="weatherIcon" || subid==="forecastIcon" ) {
            rule = "margin-left: " + newsize;
            addCSSRule(getCssRuleTarget(str_type, subid, thingindex), rule);
        } else {
            var ischecked = $("#absPlace").prop("checked");
            if ( ischecked ) {
                rule = "left: " + newsize;
            } else {
                rule = "padding-left: " + newsize;
            }
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
            // console.log("mod_" + before_after + ": " + csstarget + " rule: " + rule);
        }

    }

    // set padding for selected item
    $("#beforeText").on('change', function(event) {
        txtModify("before");
        event.stopPropagation;
    });

    // set padding for selected item
    $("#afterText").on('change', function(event) {
        txtModify("after");
        event.stopPropagation;
    });
    
}

function iconlist() {
    var dh = "";
	dh += "<div id='editicon'>";
	dh += "<div id='iconChoices'>";
	dh += "<select name=\"iconSrc\" id=\"iconSrc\" class=\"ddlDialog\"></select>";
	dh += "<input type='checkbox' id='noIcon'>";
	dh += "<label class=\"iconChecks\" for=\"noIcon\">None</label>";
	dh += "</div>";
        var align = "";
        align += "<div id='alignIcon' class='radiogroup'>";
        align+= '<input id="iconleft" type="radio" name="alignicon" value="left"><label for="iconleft">Left</label>';
        align+= '<input id="iconcenter" type="radio" name="alignicon" value="center" checked><label for="iconcenter">Center</label>';
        align+= '<input id="iconright" type="radio" name="alignicon" value="right"><label for="iconright">Right</label>';
        align += "</div>";
        dh += align;
	dh += "<div id='iconList'></div>";
	dh += "</div>";
    return dh;
}

function editSection(str_type, thingindex) {
    var dh = "";
        dh += "<div id='editSection'>";
        dh += effectspicker(str_type, thingindex);
        dh += sizepicker(str_type, thingindex);
        dh += "</div>";
    return dh;
}

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

function effectspicker(str_type, thingindex) {
    var dh = "";
    var name;
    var labelname;
    if ( str_type==="page" ) {
        labelname = "Page Name:";
        name = thingindex;
    } else {
        labelname = "Set Custom Name Here:";
        var target = getCssRuleTarget(str_type, "name", thingindex, "thistile");
        name =  $(target).html();
    }
    // alert("Name = " + name);

    // Title changes and options
    dh += "<div class='colorgroup'><label id=\"labelName\">" + labelname + "</label><input name=\"editName\" id=\"editName\" class=\"ddlDialog\" value=\"" + name +"\"></div>";
    dh += "<div class='colorgroup'><button id='processName' type='button'>Save Name</button></div>";
        
    //Effects
    dh += getScope(str_type, true);
    return dh;    
}

function sizepicker(str_type, thingindex) {
    var dh = "";

    var subid = setsubid(str_type);
    var target = getCssRuleTarget(str_type, subid, thingindex);
    var size = $(target).css("background-size");
    // alert("old size: " + size);
    size = parseInt(size);
    if ( isNaN(size) ) { 
        size = 80; 
        if ( subid === "wholetile" ) { size = 150; }
    }
    
    // icon size effects
    dh += "<div class='sizeText'></div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='bgSize'>Background Size: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='2400' step='10' id=\"bgSize\" value=\"" + size + "\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input'><input type='checkbox' id='autoBgSize'><label class=\"iconChecks\" for=\"autoBgSize\">Auto?</label></div>";

    // overall tile size effect -- i dont' know why I had this set different?
    // var target2 = "div.thing."+str_type+"-thing";
    var target2 = target;
    
    var th = $(target2).css("height");
    var tw = $(target2).css("width");
    if ( !th || th.indexOf("px") === -1 ) { 
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
    if ( !h || !h.hasOwnProperty("indexOf") || h.indexOf("px") === -1 ) { 
        h= 0; 
    } else {
        h = parseInt(h);
    }
    if ( !w || !w.hasOwnProperty("indexOf") ||  w.indexOf("px") === -1 ) { 
        w= 0; 
    } else {
        w = parseInt(w);
    }
    
    dh += "<div class='sizeText'>Overall Tile Size</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='tileHeight'>Tile H: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"tileHeight\" value=\"" + th + "\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input autochk'>";
    dh += "<label for='tileWidth'>Tile W: </label>";
    dh += "<input size='8' type=\"number\" min='10' max='1600' step='10' id=\"tileWidth\" value=\"" + tw + "\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoTileHeight'><label class=\"iconChecks\" for=\"autoTileHeight\">Auto H?</label></div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoTileWidth'><label class=\"iconChecks\" for=\"autoTileWidth\">Auto W?</label></div>";

    dh += "<div class='sizeText'><p>Item Size & Position:</p></div>";
    dh += "<div class='editSection_input autochk'>";
    dh += "<label for='editHeight'>Item H: </label>";
    dh += "<input size='4' type=\"number\" min='5' max='1600' step='5' id=\"editHeight\" value=\"" + h + "\"/>";
    dh += "</div>";
    dh += "<div>";
    dh += "<div class='editSection_input autochk'>";
    dh += "<label for='editWidth'>Item W: </label>";
    dh += "<input size='4' type=\"number\" min='5' max='1600' step='5' id=\"editWidth\" value=\"" + w + "\"/>";
    dh += "</div>";
    dh += "</div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoHeight'><label class=\"iconChecks\" for=\"autoHeight\">Auto H?</label></div>";
    dh += "<div class='editSection_input autochk'><input type='checkbox' id='autoWidth'><label class=\"iconChecks\" for=\"autoWidth\">Auto W?</label></div>";

    // font size (returns px not pt)
    var ptop = parseInt($(target).css("padding-top"));
    var pleft = parseInt($(target).css("padding-left"));
    
    if ( subid === "wholetile" || subid === "panel") {
        ptop = parseInt($(target).css("background-position-y"));
        pleft = parseInt($(target).css("background-position-x"));
    }
    
    if ( !ptop || isNaN(ptop) ) { ptop = 0; }
    if ( !pleft || isNaN(pleft) ) { pleft = 0; }
    dh += "<div class='editSection_input'>";
    dh += "<label id=\"tpname\" for='topPadding'>Top Padding:</label>";
    dh += "<input size='4' type=\"number\" min='0' max='1600' step='5' id=\"topPadding\" value=\"" + ptop + "\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label id=\"lpname\" for='leftPadding'>Left Padding:</label>";
    dh += "<input size='4' type=\"number\" min='0' max='1600' step='5' id=\"leftPadding\" value=\"" + pleft + "\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='beforeText'>Text Before:</label>";
    dh += "<input size='10' id=\"beforeText\" value=\"\"/>";
    dh += "</div>";
    dh += "<div class='editSection_input'>";
    dh += "<label for='afterText'>Text After: &nbsp;</label>";
    dh += "<input size='10' id=\"afterText\" value=\"\"/>";
    dh += "</div>";
    
    return dh;
}

function colorpicker(str_type, thingindex) {
    var dh = "";
    
    // this section is loaded later with a bunch of color pickers
    // including script to respond to picked color
    dh += "<div id='colorpicker'>";
    // dh += "<button id='editReset' type='button'>Reset</button>";
    dh += "<div class='colorgroup'><label>Feature Selected:</label>";
    var firstsub = setsubid(str_type);
    var onoff = getOnOff(str_type, firstsub);
    dh += "<div id='subidTarget' class='dlgtext'>" + firstsub + "</div>";
    dh += "<div id='onoffTarget' class='dlgtext'>" + onoff[0] + "</div>";
    dh+= "</div></div>";
    // alert(firstsub + " " + onoff);
    return dh;
}

function setupClicks(str_type, thingindex) {
    var firstsub = setsubid(str_type);
    var target1 = getCssRuleTarget(str_type, firstsub, thingindex);
    toggleTile($(target1), str_type, firstsub);
    // alert("target= " + target1 + " type= " + str_type + " firstsub= " + firstsub);
    initColor(str_type, firstsub, thingindex);
    initDialogBinds(str_type, thingindex);
    loadSubSelect(str_type, firstsub, thingindex);
    getIcons(str_type, thingindex);	
            
    var trigger = "div"; // div." + str_type + ".p_"+thingindex;
    $("#te_wysiwyg").on('click', trigger, function(event) {
        // load up our silent tags
        var subid = $(event.target).attr("subid");
        var aid = $(event.target).attr("aid");
        var ustr_type = $("#t-"+aid).attr("type");
        var uthingindex = $("#t-"+aid).attr("tile");

        if ( ustr_type && uthingindex ) {
            str_type = ustr_type;
            thingindex = uthingindex;
        }

        $("#tileDialog").attr("str_type",str_type);
        $("#tileDialog").attr("thingindex",thingindex);
        if ( !subid ) {
            subid = (str_type==="page") ? "panel" : "wholetile";
        }
        
        // update everything to reflect current tile
        toggleTile(event.target, str_type, subid);
        initColor(str_type, subid, thingindex);
        initDialogBinds(str_type, thingindex);
        loadSubSelect(str_type, subid, thingindex);
        
        var newtitle;
        if ( str_type==="page" ) {
            newtitle = "Editing Page#" + et_Globals.hubnum + " Name: " + thingindex;
            $("#labelName").html("Page Name:");
        } else {
            newtitle = "Editing Tile #" + thingindex + " of Type: " + str_type;
            $("#labelName").html("Tile Name:");
            if ( tileCount > 1 ) {
                newtitle+= " (editing " + tileCount + " items)";
            }
        }
        $("#editheader").html(newtitle);
        
        event.stopPropagation();
    });
    
    $("#scopeEffect").off('change');
    $("#scopeEffect").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        initColor(str_type, subid, thingindex);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });
    
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

        // var idsubs = "";
        var subid;
        // var firstsub = setsubid(str_type);

        $("#tileDialog div."+str_type+"-thing  div.overlay").each(function(index) {
            var classes = $(this).attr("class");
            var words = classes.split(" ", 3);
            subid = words[1];
            if ( subid ) {
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
                }

                // limit selectable sub to exclude color since that is special
                else if ( subid!=="color" ) {
                    subcontent += "<option value='" + subid +"'";
                    if ( subid === firstsub ) {
                        subcontent += " selected";
                    }
                    subcontent += ">" + subid + "</option>";;
                }
            }
        });
    
    }
    
    // console.log("classes: " + idsubs);
    subcontent += "</select>";
    // console.log("subcontent = " + subcontent);
    $("#subsection").html(subcontent);
    $("#subidselect").off('change');
    $("#subidselect").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $(event.target).val();
        
        // set the first onoff state
        // var onoff = getOnOff(str_type, subid);
//        $("#onoffTarget").html(onoff[0]);
        $("#onoffTarget").html("");
        
        initColor(str_type, subid, thingindex);
        initDialogBinds(str_type, thingindex);
        event.stopPropagation();
    });
    
    // if ( str_type !== "page" ) {
    //     $("#cm_activateCustomize").off('click');
    //     $("#cm_activateCustomize").on('click', function(event) {
    //         customizeTile(thingindex, et_Globals.aid, et_Globals.id, str_type, et_Globals.hubnum);
    //         event.stopPropagation();
    //     });
    // }
}

function setsubid(str_type) {
    var subid = str_type;
    switch(str_type) {
        case "page":
            subid= "tab";
            break;

        case "bulb":
        case "light":
        case "switch":
        case "valve":
        case "switchlevel":
            subid = "switch";
            break;

        case "thermostat":
        case "temperature":
        case "weather":
            subid = "temperature";
            break;

        case "music":
            subid = "track";
            break;

        case "clock":
            subid = "time";
            break;
            
        case "momentary":
        case "door":
        case "contact":
        case "illuminance":
            subid = str_type;
            break;
            
        case "shm":
        case "hsm":
            subid = "state";
            break;
            
        case "mode":
            subid = "themode";
            break;
            
        case "image":
            subid = "image";
            break;
            
        default:
            subid = "wholetile";
            break;
    }
    return subid;
}

function updateNames(str_type, thingindex) {

    var newname = $("#editName").val();
    var oldname;
    var target1 = getCssRuleTarget(str_type, "name", thingindex);
    if ( str_type==="page") {
        oldname = thingindex;
    } else {
        oldname = $(target1).html();
    }

    if ( oldname === newname ) {
        console.log("Names match in updateNames, so doing nothing. name: ", newname);
        return;
    }
    // $(target1).html(newname);

    var returnURL = cm_Globals.returnURL;
    $.post(returnURL, 
        {useajax: "updatenames", id: 0, type: str_type, value: newname, tile: thingindex},
        function (presult, pstatus) {
            if (pstatus==="success" && presult.startsWith("success") ) {
                if ( str_type==="page"  ) {
                    thingindex = newname;
                }
                // console.log(presult);
                cm_Globals.reload = true;
                $(target1).html(newname);
            } else {
                console.log("error - failed to update names. pstatus: ", pstatus," presult: ", presult);
            }
        }
    );

}

function saveTileEdit(str_type, thingindex) {
    var returnURL = cm_Globals.returnURL;

    // get all custom CSS text
    var newname = $("#editName").val();
    var sheet = document.getElementById('customtiles').sheet;
    var sheetContents = "";
    c=sheet.cssRules;
    for(j=0;j<c.length;j++){
        sheetContents += c[j].cssText;
    };

    // use this regexp to add returns after open and closed brackets and semi-colons
    var regex = /[{;}]/g;
    var subst = "$&\n";
    sheetContents = sheetContents.replace(regex, subst);
    
    // post changes to save them in a custom css file
    // the new name of this tile is passed in the attr variable
    // we have to divide this into chunks if large to avoid Node limit
    // done using a recursive call to ensure chunks done in order
    postRecurse(0, 59000, sheetContents.length);

    function postRecurse(n1, n2, nlen) {
        // ensure we end on a proper bounday for sections
        if ( n1 >= nlen ) {
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
        console.log( "n1: ", n1, " n2: ", n2, " nlen: ", nlen, " subcontent:");
        // console.log("\n----------------------------------------------------------\n", subcontent);
        // console.log("\n----------------------------------------------------------\n");
        subcontent= encodeURI(subcontent);

        $.post(returnURL, 
            {useajax: "savetileedit", id: n1, n1: n1, n2: n2, nlen: sheetContents.length, type: str_type, value: subcontent, attr: newname, tile: thingindex},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    console.log("savetileedit: presult= ", presult);

                    n1 = n2;
                    n2 = n1 + 59000;
                    var done = postRecurse(n1, n2, nlen);


                    // reload if tile updated and if we are saving the last file part
                    if ( cm_Globals.reload && done ) {
                        window.location.href = cm_Globals.returnURL;
                    }
                }
            }
        );
        return false;

    }

}

function cancelTileEdit(str_type, thingindex) {
    document.getElementById('customtiles').sheet = savedSheet;
    if ( cm_Globals.reload ) {
        // location.reload(true);
        window.location.href = cm_Globals.returnURL;
    }
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

function checkboxHandler(idselect, onaction, offaction, overlay) {
    $(idselect).off('change');
    $(idselect).on("change",function() {
        var strAbs;;
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var overlayTarget = getCssRuleTarget("wholetile", subid, thingindex);
        // var overlayTarget = "div.overlay." + subid + ".v_" + thingindex;
        if($(idselect).is(':checked')){
            // alert("overlay= "+overlay+" overlayTarget= "+overlayTarget+" action= "+onaction);
            if (overlay) {
                addCSSRule(overlayTarget, onaction, true);
            }
            addCSSRule(cssRuleTarget, onaction, false);
        } else {
            // alert("overlay= "+overlay+" overlayTarget= "+overlayTarget+" action= "+offaction);
            if (overlay) {
                addCSSRule(overlayTarget, offaction, true);
            }
            addCSSRule(cssRuleTarget, offaction, false);
        }
    });
}

// add all the color selectors to the colorpicker div
function initColor(str_type, subid, thingindex) {
  
    var onstart;

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
    
    // console.log ("initcolor: str_type= " + str_type + " subid= " + subid + " thingindex= " + thingindex + " target= " + target);
    priorIcon = $(target).css("background-image");
        
    // set the first onoff state
    var onoff = getOnOff(str_type, subid);
    
    // set the active value
    var onoffval = $("#onoffTarget").html();
    if ( onoffval && !$.isNumeric(onoffval) && (onoffval.indexOf(" ") === -1) ) {
        $(icontarget).addClass(onoffval);
        $(icontarget).html(onoffval);
    }
    
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
    if ( subid!=="wholetile" && subid!=="head" ) {
        var editheight = $(target).css("height");
        editheight = parseInt(editheight,10);
        if ( isNaN(editheight) || editheight <= 0 ) { 
            editheight = $(generic).css("height");
            if ( isNaN(editheight) || editheight <= 0 ) { 
                editheight = 150;
                if ( subid==="panel" ) { editheight = 600; }
            }
        }
        $("#editHeight").val(editheight);

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
        editwidth = parseInt(editwidth,10);
        if ( isNaN(editwidth) || editwidth <= 0 ) { 
            editwidth = $(generic).css("width");
            if ( isNaN(editwidth) || editwidth <= 0 ) { 
                editwidth = 80;
                if ( subid==="panel" ) { editwidth = 1200; }
            }
        }
        $("#editWidth").val(editwidth);

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

    // set the padding
    var ptop = parseInt($(target).css("padding-top"));
    var pleft = parseInt($(target).css("padding-left"));
    if ( str_type==="panel" || subid==="wholetile" ) {
        ptop = parseInt($(target).css("background-position-y"));
        pleft = parseInt($(target).css("background-position-x"));
    }
    if ( !ptop || isNaN(ptop) ) { ptop = 0; }
    if ( !pleft || isNaN(pleft) ) { pleft = 0; }
    $("#topPadding").val(ptop);
    $("#leftPadding").val(pleft);

    // var txtBefore = $(target+"::before").css("content");
    var txtBefore = window.getComputedStyle(document.querySelector(target), "::"+"before").getPropertyValue('content');
    if ( txtBefore==="none" ) {
        txtBefore = "";
    } else if ( txtBefore.startsWith('"') ) {
        txtBefore = txtBefore.substr(1, txtBefore.length-2);
    }
    $("#beforeText").val(txtBefore);

    // var txtAfter = $(target+"::after").css("content");
    var txtAfter = window.getComputedStyle(document.querySelector(target), "::"+"after").getPropertyValue('content');
    if ( txtAfter==="none" ) {
        txtAfter = "";
    } else if ( txtAfter.startsWith('"') ) {
        txtAfter = txtAfter.substr(1, txtAfter.length-2);
    }
    $("#afterText").val(txtAfter);

    // -----------------------------------------------------------------------
    // far left side of the screen
    // -----------------------------------------------------------------------
    var dh= "";
    // dh += "<button id='editReset' type='button'>Reset</button>";
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
    
    // alert("target= " + target+" generic= "+generic+" onstart= "+onstart);
    // console.log("target= "+ target+ " initial background-color= "+onstart);
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
        if ( subid==="level" ) {
            sliderbox+= " .ui-slider";
            generic+= " .ui-slider";
        }
        
        onstart = $(sliderbox).css("color");
        if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) {
            onstart = $(generic).css("color");
            if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) { onstart = $("div.thing").css("color"); }
            if ( !onstart || onstart==="rgba(0, 0, 0, 0)" ) { onstart = "rgba(255, 255, 255, 1)"; }
        }
        // console.log("target= "+ target+ ", initial color= "+onstart);
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

        // console.log("ffamily = " + ffamily + " fweight= " + fweight + " fstyle= " + fstyle);

        if ( ffamily===undefined || !ffamily || !ffamily.hasOwnProperty(("includes")) ) {
            fontdef = "sans";
        } else if ( ffamily.includes("Raleway") || ffamily.includes("Times") ) {
            fontdef = "serif";
        } else if ( ffamily.includes("Courier") || ffamily.includes("Mono") ) {
            fontdef = "mono";
        } else {
            fontdef = "sans";
        }
        if ( fweight==="bold" || ( $.isNumeric(fweight) && fweight > 500)  ) {
            fontdef+= "b";
        }
        if ( fstyle!=="normal") {
            fontdef+= "i";
        }
        // console.log("strtype= " + str_type + " ffamily= " + ffamily + " fweight= " + fweight + " fstyle= " + fstyle + " fontdef = "+ fontdef);

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
        var sizes = [8,9,10,11,12,14,16,18,20,24,28,32,40,48,60,80,100,120];
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
        ishidden += "<input type='checkbox' id='isHidden' target='" + target + "'>";
        ishidden += "<label class=\"iconChecks\" for=\"isHidden\">Hide Element?</label></div><br />";

        var inverted = "<div class='editSection_input autochk'><input type='checkbox' id='invertIcon'><label class=\"iconChecks\" for=\"invertIcon\">Invert Element?</label></div>";
        inverted += "<div class='editSection_input'><input type='checkbox' id='absPlace'><label class=\"iconChecks\" for=\"absPlace\">Absolute Loc?</label></div>";
        inverted += "<div class='editSection_input'><input type='checkbox' id='inlineOpt'><label class=\"iconChecks\" for=\"inlineOpt\">Inline?</label></div>";

        var border = "<div class='editSection_input'><label>Border Type:</label>";
        border += "<select name=\"borderType\" id=\"borderType\" class=\"ddlDialog\">";
        var borderopts = {"Select Option":"",
                          "Default": "border: unset; border-right: unset; border-bottom: unset; border-radius: 0%; box-shadow: unset;",
                          "Shadow Square": "border: 2px solid #999999; border-right: 2px solid #333333; border-bottom: 2px solid #333333; border-radius: 0%; box-shadow: 2px 2px 7px black;",
                          "ActionTiles Look": "border: 4px solid #666666; border-right: 4px solid #666666; border-bottom: 4px solid #666666; border-radius: 0%; box-shadow: none; margin: 0px;",
                          "Thin Border": "border: 1px solid black;",
                          "2x Border": "border: 2px solid black;",
                          "3x Border": "border: 3px solid black;",
                          "Thick Border": "border: 6px solid black;",
                          "White Color": "border-color: white;", 
                          "Black Color": "border-color: black;", 
                          "No Color" : "border-color: rgba(0,0,0,0.01);",
                          "White Shadow": "box-shadow: 5px 4px 15px #cccccc;",
                          "Black Shadow": "box-shadow: 5px 4px 15px black;",
                          "No Shadow": "box-shadow: none;",
                          "Square": "border-radius: 0%;",
                          "Circle": "border-radius: 50%;",
                          "Rounded Rect": "border-radius: 25%;",
                          "None": "border: none; box-shadow: none;" };
        for ( var bopt in borderopts ) {
            var checked = "";
            if ( bopt==="Select Option" ) { checked = " selected"; }
            border+= "<option value=\"" + borderopts[bopt] + "\"" + checked + ">" + bopt + "</option>";
        }
        border += "</select>";
        border += "</div>";
        
        var resetbutton = "<br /><br /><button id='editReset' type='button'>Reset</button>";

        // insert the color blocks
        $("#colorpicker").html(dh + iconback + ceffect + iconfore + fe + align + ishidden + inverted + border + resetbutton);

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

    checkboxHandler("#invertIcon","filter: invert(1);","filter: invert(0);", false);
    checkboxHandler("#absPlace","position: absolute;","position: relative;", true);
    checkboxHandler("#inlineOpt","display: inline-block;","display: block;", false);
    
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

    $("#borderType").off('change');
    $("#borderType").on('change', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var borderstyle = $(this).val();
        if ( borderstyle!=="" ) {
            addCSSRule(cssRuleTarget, borderstyle);
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
    
    // icon alignment handling
    $("#alignIcon").off('change', "input");
    $("#alignIcon").on('change', "input", function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var aligneffect = $(this).val();
        var fontstr= "background-position-x: " + aligneffect;
        addCSSRule(cssRuleTarget, fontstr);
        event.stopPropagation;
    });
	
    // determine hiding of element
    $("#isHidden").off('change');
    $("#isHidden").on('change', function(event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        var subid = $("#subidTarget").html();
        // var onoff = getOnOff(str_type, subid);
        // var strCaller = $($(event.target)).attr("target");
        var ischecked = $(event.target).prop("checked");
        var displayset = "none";
        if ( !ischecked ) {
            displayset = $("#inlineOpt").prop("checked") ? "inline-block" : "block";
        }

        var cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex);
        var rule = "display: " + displayset + ";";
        addCSSRule(cssRuleTarget, rule);

        // also add the overlay rule
        cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex, "overlay");
        addCSSRule(cssRuleTarget, rule);
        event.stopPropagation;
    });	
    
    $("#editReset").on('click', function (event) {
        var str_type = $("#tileDialog").attr("str_type");
        var thingindex = $("#tileDialog").attr("thingindex");
        // alert("Reset type= "+str_type+" thingindex= "+thingindex);
        var subid = $("#subidTarget").html();
        resetCSSRules(str_type, subid, thingindex);
        event.stopPropagation;
    });

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
    
    // set the initial alignment
    var initalign = $(target).css("text-align");
    if ( initalign === "left") {
        $("#alignleft").prop("checked", true);
    } else if (initalign === "right") {
        $("#alignright").prop("checked", true);
    } else {
        $("#aligncenter").prop("checked", true);
    }
    
    // set the initial alignment
    initalign = $(target).css("background-position-x");
    if ( initalign === "left") {
        $("#iconleft").prop("checked", true);
    } else if (initalign === "right") {
        $("#iconright").prop("checked", true);
    } else {
        $("#iconcenter").prop("checked", true);
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
        var ish = getish(str_type, thingindex, subid);
        // var ishidden = false;
        var ishidden = ($(ishdefault).css("display")==="none");
        for ( var i = 0; i< ish.length; i++) {
            if (  $(ish[i]) && $(ish[i]).css("display")==="none" ) {
                ishidden= true;
                var status = $(ish[i]).css("display");
                // console.log("hidden #", i, ": ", status);
            }
        }
        // console.log("hidden info: ", ishidden);
        $("#isHidden").prop("checked", ishidden);
    }
    
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
    
    if ( subid==="level" ) {
        cssRuleTarget = getCssRuleTarget(str_type, subid, thingindex); //  "div.overlay.level.v_" + thingindex;
        var sliderline = cssRuleTarget;
        if ( strCaller==="background" ) {
            addCSSRule(sliderline, "background-color: " + strColor + ";");		
        } else {
            var sliderbox= sliderline + " .ui-slider";
            addCSSRule(sliderbox, "background-color: " + strColor + ";");		
            addCSSRule(sliderbox, "color: " + strColor + ";");
            addCSSRule(sliderbox, "width: 100%;");
            var sliderbox2= sliderbox + " span.ui-slider-handle";
            addCSSRule(sliderbox2, "background-color: " + strColor + ";");		
            addCSSRule(sliderbox2, "color: " + strColor + ";");		
        }
        // console.log("Slider color: caller= " + strCaller + " LineTarget= " + sliderline + " BoxTarget= "+ sliderbox);

    } else if ( strCaller==="background" ) {
        addCSSRule(cssRuleTarget, "background-color: " + strColor + ";");		
    } else {
        if ( str_type==="page" && (subid==="tab" || subid==="tabon") ) {
            cssRuleTarget += " a.ui-tabs-anchor";
        }
        addCSSRule(cssRuleTarget, "color: " + strColor + ";");	
    }
}

function getIconCategories() {
	var iconDoc = 'iconlist.txt';
	var arrCat = ['Local_Storage','Local_Media'];
	$.ajax({
        url:iconDoc,
        type:'GET',
        success: function (data) {
            var arrIcons = data.toString().replace(/[\t\n]+/g,'').split(',');
            $.each(arrIcons, function(index, val) {
                var iconCategory = val.substr(0, val.indexOf('|'));
                iconCategory = $.trim(iconCategory).replace(/\s/g, '_');	
                arrCat.push(iconCategory);					
            }); //end each Icon
            arrCat = makeUnique(arrCat);
            $.each(arrCat, function(index, iconCat) {
                var catText = iconCat.replace(/_/g, ' ')
                $('#iconSrc').append($('<option></option>').val(iconCat).text(catText));
            }); 
        } //end function()
	}); //end ajax
}

function getIcons(str_type, thingindex) {
    var returnURL = cm_Globals.returnURL;
    getIconCategories();
    var iCategory = $("#iconSrc").val();
    var skindir = $("#skinid").val();
    
    // change to use php to gather icons in an ajax post call
    // this replaces the old method that fails on GoDaddy
    if ( !iCategory ) { iCategory = 'Local_Storage'; }
    if( iCategory === 'Local_Storage' || iCategory==='Local_Media') {
        var localPath = 'icons';
        if ( iCategory === 'Local_Media') {
            localPath = 'media';
        }
        $.post(returnURL, 
            {useajax: "geticons", id: 0, type: "none", value: localPath, attr: iCategory},
            function (presult, pstatus) {
                if (pstatus==="success" ) {
                    // console.log("reading icons from skin= " + skindir + " and path= "+localPath);
                    $('#iconList').html(presult);
                    setupIcons(iCategory, str_type, thingindex);
                } else {
                    $('#iconList').html("<div class='error'>Error reading icons from skin= " + skindir + " and local path= " + localPath + "</div>");
                }
            }
        );
    } else {
        var icons = '';
        var iconDoc = 'iconlist.txt';
        $.ajax({
            url:iconDoc,
            type:'GET',
            success: function (data) {
                var arrIcons = data.toString().replace(/[\t\n]+/g,'').split(',');
                $.each(arrIcons, function(index, val) {
                    var iconCategory = val.substr(0, val.indexOf('|'));
                    iconCategory = $.trim(iconCategory).replace(/\s/g, '_');	
                    if(iconCategory === iCategory) {
                        var iconPath = val.substr(1 + val.indexOf('|'));
                        // iconPath = encodeURI(iconPath);
                        icons+='<div>';
                        icons+='<img class="icon" src="' + iconPath + '"></div>';
                    }
                });			
                $('#iconList').html(icons);
                setupIcons(iCategory, str_type, thingindex);
            }
        });
    }
}

function makeUnique(list) {
    var result = [];
    $.each(list, function(i, e) {
        if ($.inArray(e, result) == -1) result.push(e);
    });
    return result;
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
    if ( category==="Local_Storage" || category==="Local_Media" ) {
        // imagePath = returnURL + "/" + imagePath;
        imagePath = imagePath.replace(/\\/g,"/");
    }

    // remove skin directory reference because css is now located in the skin directory
    var skindir = $("#skinid").val() + "/";
    if ( imagePath.startsWith(skindir) ) {
        var n = skindir.length;
        imagePath = imagePath.substr(n);
    }

    var imgurl = 'background-image: url("' + imagePath + '")';
    // console.log("Setting icon: category= " + category + " target= " + cssRuleTarget + " icon= " + imagePath + " type= " + str_type + " index= " + thingindex + " rule= " + imgurl);
    addCSSRule(cssRuleTarget, imgurl + strEffect + ";");

    // set new icons to default size
    // $("#autoBgSize").prop("checked", false);
    // updateSize(str_type, subid, thingindex);
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
        addCSSRule(cssRuleTarget, "background-repeat: no-repeat;");
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
    cm_Globals.reload = true;

    //Searching of the selector matching cssRules
    var index = -1;
    for(var i=sheet.cssRules.length-1; i >=0; i--) {
        var current_style = sheet.cssRules[i];
        if( current_style.selectorText === selector && current_style.style.item(0)!=="content" ) {
            //Append the new rules to the current content of the cssRule;
            if( !resetFlag ){
                rules=current_style.style.cssText + " " + rules;			
            }
            sheet.deleteRule(i);
            index = i;
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

        cm_Globals.reload = true;
        var ruletypes = ['wholetile','head','name'];
        ruletypes.forEach( function(rule, idx, arr) {
            var subtarget = getCssRuleTarget(str_type, rule, thingindex);
            if ( subtarget ) {
                removeCSSRule(subtarget, thingindex, null);
            }
        });

        // remove all the subs
        var onoff = getOnOff(str_type, subid);
        if ( onoff && onoff.length ) {
            onoff.forEach( function(rule, idx, arr) {
                var subtarget = getCssRuleTarget(str_type, rule, thingindex);
                if ( subtarget ) {
                    removeCSSRule(subtarget, thingindex, null);
                }
            });
        }
}

function removeCSSRule(strMatchSelector, thingindex, target){
    var scope = $("#scopeEffect").val();
    var sheet = document.getElementById('customtiles').sheet; // returns an Array-like StyleSheetList
    //Searching of the selector matching cssRules
    // console.log("Remove rule: " + strMatchSelector );
    for (var i=sheet.cssRules.length; i--;) {
        var current_style = sheet.cssRules[i];
        if ( scope==="alltile" || scope==="allpage" || ( thingindex && current_style.selectorText.indexOf("_"+thingindex) !== -1 ) || 
             (current_style.selectorText === strMatchSelector &&
               ( !target || current_style.style.cssText.indexOf(target) !== -1 ) ) ) {
            sheet.deleteRule (i);
            // console.log("Removing rule: " + current_style.selectorText);
        }
    }  
}
