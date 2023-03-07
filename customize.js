/* Tile Customizer Editor for HousePanel
 * 
 * written by Ken Washington @kewashi on the forum
 * Designed for use only with HousePanel for Hubitat and SmartThings
 * (c) Ken Washington 2017, 2018, 2019
 */

// TODO - rewrite to not use global allthings and options arrays

// globals used by this module
cm_Globals.currentid = 1;
cm_Globals.id = null;
cm_Globals.usertext = "";
cm_Globals.reload = false;
cm_Globals.tileid = null;
// cm_Globals.thingidx = null;
cm_Globals.defaultclick = "name";
var ENABLERULES = true;

function getDefaultSubids() {
    var tileid = cm_Globals.tileid;
    // var options = cm_Globals.options;
    // var indexoptions = options.index;
    // var keys = Object.keys(indexoptions);
    // var idx = cm_Globals.thingidx;
    // var device = devices[tileid];
    // var pvalue = device.pvalue;
     // var n = idx.indexOf("|");

     loadExistingFields(tileid, false, false);
     $("#cm_customtype option[value='TEXT']").prop('selected',true);
     
     var pc = loadTextPanel();
     $("#cm_dynoContent").html(pc);

     initExistingFields();
}

// popup dialog box now uses createModal
function customizeTile(userid, tileid, aid, bid, str_type, hubnum) {  

    // save our tile id in a global variable
    // cm_Globals.devices = {};
    cm_Globals.aid = aid;
    cm_Globals.id = bid;
    cm_Globals.hubnum = hubnum;
    cm_Globals.reload = false;
    cm_Globals.userid = userid;
    cm_Globals.type = str_type;
    cm_Globals.rules = null;
    var isdone = {getrules: false, devices: false};

    // confirm we have options
    // console.log(">>>> customize - rules: ", cm_Globals.options.rules);

    // this is the tileid value in the things list which is the base device.id value
    cm_Globals.tileid = tileid;
    // cm_Globals.thingidx = str_type + "|" + bid;
    // cm_Globals.thingidx = tileid;

    // reuse the thingidx variable but set it to the thingid value in our database
    // which points to the specific thing in the visual display
    // note that "aid" is the same as "thingid" so we don't pass it in here
    var customname;
    try {
        customname = $("#a-"+aid+"-name").text();
        if ( !customname ) {
            customname = $("#s-"+aid).text();
        }
    } catch(e) {
        customname = "";
    }
    cm_Globals.customname = customname;

    // get the list of rules for this tile

    // set the customization list
    $.post(cm_Globals.returnURL, 
        {useajax: "getrules", userid: userid, id: bid},
        function (presult, pstatus) {
            if (pstatus==="success" ) {
                cm_Globals.rules = presult;
                // console.log("getrules: ", presult);
                checkDone("getrules");
            } else {
                console.log("error - failure reading rules from database for user = " + userid);
            }
        }, "json"
    );


    // first get all devices from the server for this user
    // mydb.getRows("devices","*","userid = "+userid)
    // .then(rows => {
    $.post(cm_Globals.returnURL, {useajax: "getdevices", userid: userid},
        function(presult, pstatus) {
            if (pstatus==="success" && typeof presult === "object") {
                // create the devices object list
                cm_Globals.devices = presult;
                for ( var id in presult ) {
                    var val = presult[id];
                    if ( val.deviceid === "clockdigital" ) {
                        cm_Globals.currentid = val.id;
                    }
                }
                // console.log(">>>> customize - devices: ", cm_Globals.devices);
                checkDone("devices");
                // dodisplay();
            } else {
                console.log(">>>> error - could not load devices to use the customizer");
            }
        }, "json"
    );

    function checkDone(element) {
        if ( element ) {
            isdone[element] = true;
        }

        if ( isdone.getrules && isdone.devices ) {
            dodisplay();
        }
    }
    
    // create a function to display the dialog
    function dodisplay() {

        // start of dialog
        var dh = "<div id='customizeDialog' class='tileDialog'>";

        // get the rules const
        try {
            ENABLERULES = $("input[name='enablerules']").val() === "true";
        } catch(e) {
            ENABLERULES = true;
        }

        dh += "<div class='editheader' id='cm_header'>Customizing Tile #" + tileid + "</div>";
        dh+= "<table class ='cm_table'>";
        dh+= "<tr>";
            dh+= "<td colspan='2'>" +  customHeaderPanel() + "</td>";
        dh+= "</tr>";
        dh+= "<tr>";
            dh+= "<td class='typepanel'>" +  customTypePanel() + "</td>";
            dh+= "<td class='dynopanel'>" +  customDynoPanel() + "</td>";
        dh+= "</tr>";
        dh+= "<tr>";
            dh+= "<td colspan='2'>" +  customInfoPanel() + "</td>";
        dh+= "</tr>";

        // end of dialog
        dh += "</div>";

        var pos = {top: 150, left: 250, zindex: 999};
        createModal("modalcustom", dh, "body", "Done", pos, 
            // function invoked upon leaving the dialog
            function(ui, content) {
                $("body").off("keydown");
                $("body").off("keypress");
                // reload window unless modal Tile Editor window is open
                cm_Globals.tileid = null;
                // cm_Globals.thingidx = null;

                // only reload if edit window isn't open
                // which will be true if we invoked the customizer from the edit window
                if ( cm_Globals.reload && ( typeof modalWindows["modalid"] === "undefined" || modalWindows["modalid"] === 0 ) ) {
                    // location.reload(true);
                    window.location.href = cm_Globals.returnURL;
                }
            },
            // function invoked upon starting the dialog
            function(hook, content) {
                // grab the global list of all things and options
                if ( !cm_Globals.devices ) {
                    console.log("error - you have no devices to use in the Tile Customoizer ...");
                    return;
                } else {
                    try {
                        getDefaultSubids();
                        var tileid = cm_Globals.tileid;
                        // var allthings = cm_Globals.allthings;
                        // var thing = allthings[idx];
                        var thing = cm_Globals.devices[tileid];
                        // console.log(">>>> thing: ", thing);
                        $("#cm_subheader").html(thing.devicename);
                        initCustomActions();
                        handleBuiltin(cm_Globals.defaultclick);
                    } catch (e) {
                        console.log("error attempting to load the Tile Customoizer ...", e);
                        closeModal("modalcustom");
                    }
                }
                
                // initialize the actions
                $("#modalcustom").draggable();
            }
        );
    };
    
}

function customHeaderPanel() {
    var dh = "";
        dh+= "<h2>Tile Customizer for: ";
        dh+= "<span id='cm_subheader'></span></h2>";
    return dh;
}
    
// far left panel showing the customization type selector
function customTypePanel() {
    var dh = "";
    dh+= "<div class='cm_group'><div><label for='cm_typePanel'>Custom Type:</label></div>";
    dh+= "<div id='cm_typePanel'>";
    dh+= "<select id='cm_customtype' name='cm_customtype'>"; 
        dh+= "<option value='TEXT' selected>TEXT</option>";
        dh+= "<option value='POST'>POST</option>";
        dh+= "<option value='GET'>GET</option>";
        // dh+= "<option value='PUT'>PUT</option>";
        dh+= "<option value='URL'>URL</option>";
        dh+= "<option value='LINK'>LINK</option>";
        if ( ENABLERULES ) {
            dh+= "<option value='RULE'>RULE</option>";
        }
    dh+= "</select>";
    dh+= "</div></div>";

    // list of existing fields in our tile being customized
    // or a user entry box for a custom name
    // this whole section will be hidden with LINK types
    dh+= "<div id='cm_existingpick' class='cm_group'>";
        dh+= "<div>Existing Fields: <span class='ital'>(* custom fields)</span></div>";
        dh+= "<table class='cm_builtin'><tbody><tr>";
        dh+= "<td><select size='6' class='cm_builtinfields' id='cm_builtinfields' name='cm_builtinfields'>"; 
        dh+= "</select></td>";
        dh+= "<td><button class='arrow' id='cm_upfield'><img src='media/uparrow.jpg' width='30'></button><br>";
        dh+= "<button class='arrow' id='cm_dnfield'><img src='media/dnarrow.jpg' width='30'></button></td>";
        dh+= "</tr></table>";
        
        dh+= "<br><br><strong>OR...</strong><br><br>";
        dh+= "<div><label for='cm_userfield'>User Field Name:</label></div>";
        dh+= "<input id='cm_userfield' type='text' value=''></div>";
    dh+= "</div>";
    
    dh+= "<div class='cm_group'>";
        dh+= "<button class='cm_button' id='cm_addButton'>Add</button>";
        dh+= "<button class='cm_button' id='cm_delButton'>Del</button>";
    dh+= "</div>";
    
    return dh;
}

function customDynoPanel() {

    var dh = "";
    dh+= "<div id='cm_dynoContent'>";
    // dh+= loadTextPanel();
    dh+= "</div>";
    return dh;
}

function customInfoPanel() {
    var dh = "";
    dh+= "<div class='cm_group'><div><label for='cm_dynoInfo'>Information:</label></div>";
    dh+= "<textarea id='cm_dynoInfo' rows='6' readonly></textarea></div>";
    return dh;
}

// this little gem will sort by up to three things
function sortedSensors(unsorted, one, two, three) {

    // put sensors in an array so we can sort them
    var sensors = unsorted.sort( function(obja, objb) {
        function test(a, b) {
            if ( typeof a === "object" || typeof b === "object" ) { return 0; }
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

function loadLinkPanel(tileid, curval) {
    
    // section for LINK types - Drop down list, ID display, Field list, and a test button
    var dh = "";
    dh+= "<div class='cm_group'><div><label for='cm_link'>Linked Tile: </label></div>";
    // read all the tiles from the options file using API call
    dh+= "<select id='cm_link' name='cm_link'>"; 

    // go through all the things and make options list
    // and avoid linking to ourselves
    var results = "";
    var selected = "";

    // create a sorted list here
    // var sensors = sortedSensors("name", "type", "hubnum");
    var sortdevices = sortedSensors( Object.values(cm_Globals.devices), "name", "devicetype" );

    for ( var i in sortdevices ) {
        var sensor = sortdevices[i];
        var id = sensor["id"];
        if ( id !== tileid ) {
            var thingname = sensor["name"];
            var thingtype = sensor["devicetype"];
            if ( id === curval ) {  // cm_Globals.currentid ) {
                selected = " selected";
            } else {
                selected = "";
            }
            results+= "<option value='" + id + "'" + selected + ">" + thingname + " (" + thingtype + " #"+id+")</option>";
        }
    }
    
    dh+= results ;
    dh+="</select></div>";

    // list of available fields to select for the linked tile
    dh+= "<div class='cm_group'>Selected ID: <div id='cm_linkbid'></div>";
    dh+= "<div>Available Fields:</div>";
    dh+= "<select size='6' id='cm_linkfields' name='cm_linkfields'>"; 
    dh+="</select></div>";
    
    // preview button and panel
    dh += "<div class='cm_group'>";
        dh+= "<div><label for='cm_preview'>Preview:</label></div>";
        dh+= "<div class='cm_preview' id='cm_preview'></div>";
    dh+= "</div>";
    
    var infotext = "The \"LINK\" option enables you to " +
        "add any other field in any other tile in your smart home to the tile being customized. " +
        "In the top of the right column, select the tile to link to, and then select which field " +
        "of this tile to link into the customized tile using the \"Available Fields\" list above on the right. Once you are happy with " +
        "your selection, click the \"Add\" button and this field will be added to the list of \"Existing Fields\" " +
        "shown on the left side of this dialog box. You can mix and match this with any other addition. " +
        "You can add text or numbers to the end of the field name to make the link subid unique, or you can " +
        "leave it as-is. If the field name exists in the list on the left it will be replaced. " +
        "The existing fields list will be disabled when this type is selected. Change the type to move to " +
        "a different existing field or to change the type of this field away from a LINK.";
    $("#cm_dynoInfo").html(infotext);
    
    return dh;
}

function loadServicePanel(servicetype) {
    var content = cm_Globals.usertext;
    var dh = "";
    dh+= "<div id='cm_dynoText'>";
    dh+= "<div class='cm_group'><div><label for='cm_text'>" + servicetype + " Service URL</label></div>";
    dh+= "<input class='cm_text' id='cm_text' type='url' value='" + content + "'></div>";
    dh+= "</div>";
    
    // preview panel
    dh += "<div class='cm_group'>";
        dh+= "<div><label for='cm_preview'>Preview:</label></div>";
        dh+= "<div class='cm_preview' id='cm_preview'></div>";
    dh+= "</div>";
    
    var infotext = "The \"" + servicetype + "\" option enables you to " +
        "add a user-specified web service to the tile being customized using the " + servicetype + " method. " +
        "In the top of the right column, enter a valid URL to the web service. " +
        "You must also either pick the field this will override OR give a new user-defined field name using the entry box on the left. " +
        "Click the \"Add\" button and this field will be added to the list of \"Existing Fields\" " +
        "shown on the left side of this dialog box. You can mix and match this with any other addition.";
    $("#cm_dynoInfo").html(infotext);
    
    return dh;
}

function loadTextPanel() {
    var servicetype = "TEXT";
    var content = cm_Globals.usertext;
    var dh = "";
    dh+= "<div id='cm_dynoText'>";
    dh+= "<div class='cm_group'><div><label for='cm_text'>Custom Text: </label></div>";
    dh+= "<input class='cm_text' id='cm_text' type='text' value='" + content + "'></div>";
    dh+= "</div>";
    
    // preview panel
    dh += "<div class='cm_group'>";
        dh+= "<div><label for='cm_preview'>Preview:</label></div>";
        dh+= "<div class='cm_preview' id='cm_preview'></div>";
    dh+= "</div>";
    
    var infotext = "The \"" + servicetype + "\" option enables you to " +
        "add any user-specified text to the tile being customized. " +
        "In the top of the right column, enter the desired text. The text can valid HTML tags. " +
        "You must also either pick the field this will override OR give a new user-defined field name using the entry box on the left. " +
        "Click the \"Add\" button and this field will be added to the list of \"Existing Fields\" " +
        "shown on the left side of this dialog box. You can mix and match this with any other addition.";
    $("#cm_dynoInfo").html(infotext);
    
    return dh;
}

function loadRulePanel() {
    var servicetype = "RULE";
    var content = cm_Globals.usertext;
    var dh = "";
    dh+= "<div id='cm_dynoText'>";
    dh+= "<div class='cm_group'><div><label for='cm_rule'>Custom Rule: </label></div>";
    dh+= "<input class='cm_text' id='cm_text' type='text' value='" + content + "'></div>";
    dh+= "</div>";
    
    // preview panel
    dh += "<div class='cm_group'>";
        dh+= "<div><label for='cm_preview'>Preview:</label></div>";
        dh+= "<div class='cm_preview' id='cm_preview'></div>";
    dh+= "</div>";
    
    var infotext = "The \"" + servicetype + "\" option enables you to " +
        "add a rule to the tile being customized. A rule is a list of tile ID's to activate or de-activet. " +
        "In the top of the right column, enter the desired text. The text should be a comma separate list " +
        "of tile numbers=command, where command is either on, off, open, closed, etc. Any command supported is accepted. " +
        "You must also either pick the field this will override OR give a new user-defined field name using the entry box on the left. " +
        "Click the \"Add\" button and this field will be added to the list of \"Existing Fields\" " +
        "shown on the left side of this dialog box. You can mix and match this with any other addition.";
    $("#cm_dynoInfo").html(infotext);
    
    return dh;
}

function loadUrlPanel() {
    var servicetype = "URL";
    var content = cm_Globals.usertext;
    var dh = "";
    dh+= "<div id='cm_dynoText'>";
    dh+= "<div class='cm_group'><div><label for='cm_text'>Web Page URL: </label></div>";
    dh+= "<input class='cm_text' id='cm_text' type='url' value='" + content + "'></div>";
    dh+= "</div>";
    
    // preview panel
    dh += "<div class='cm_group'>";
    dh+= "<div><label for='cm_preview'>Preview:</label></div>";
    dh+= "<div class='cm_preview' id='cm_preview'></div>";
    dh+= "</div>";
    
    var infotext = "The \"" + servicetype + "\" option enables you to " +
        "add a user-specified webpage link to the tile being customized. " +
        "In the top of the right column, enter the URL of the web page. " +
        "You must also either pick the field this will override OR give a new user-defined field name using the entry box on the left. " +
        "Click the \"Add\" button and this field will be added to the list of \"Existing Fields\" " +
        "shown on the left side of this dialog box. You can mix and match this with any other addition.";
    $("#cm_dynoInfo").html(infotext);
    
    return dh;
}

// returns an options list and subid list of available fields of a given tile
function loadLinkItem(linkid, allowuser, sortval, sortup) {
    try {
        var thing = cm_Globals.devices[linkid];
        var thevalue = thing.pvalue;
    } catch(e) {
        return null;
    }

    var subids = [];
    var results = "";
    var lines = cm_Globals.rules;

    // first load the native items
    for ( var tkey in thevalue ) {
        var tval = thevalue[tkey];

        // skip if this item was replaced by a custom field handled below
        var iscustom = false;
        if ( lines && allowuser ) {
            lines.forEach(function(val) {
                iscustom = iscustom || ( val[2] === tkey );
            });
        }

        if ( !iscustom ) {
            // check value for "json" strings
            // to handle objects and arrays
            if ( typeof tval === "string" && tval.startsWith("{") && tval.endsWith("}") ) {
                try {
                    var jsontval = JSON.parse(tval);
                } catch (jerr) {
                    jsontval = null;
                }
            }
            if ( typeof tval==="object" ) {

                // var isarr = Array.isArray(jsontval);
                for (var jtkey in tval ) {
                    var jtval = tval[jtkey];

                    // expand arrays and objects onto the base
                    // need to include objects so we can retrieve the original info
                    var newkey = tkey + "_" + jtkey.toString();

                    // skip adding an object element if it duplicates an existing one
                    if ( typeof jtval!=="object" && !subids.includes(newkey) ) {
                        results+= "<option command='' linkval='"+jtval+"' value='" + newkey + "'>" + newkey + "</option>";
                        subids.push(newkey);
                    }
                }

            } else {  // } if ( !subids.includes(tkey) ) {
                // If an alias name exists, then use it instead of the key
                results+= "<option command='' linkval='"+tval+"' value='" + tkey + "'>" + tkey + "</option>";
                subids.push(tkey);
            }
        }
    }
    
    // now load the custom fields
    if ( lines && allowuser ) {
        // first sort and make sure we get rid of dups
        // sortExistingFields(sortval, sortup);

        // get the custom rules for this tile if any exist
        lines.forEach(function(val) {
            var subid = val[2];
            var command = val[0];
            var linkval = val[1];
            // if ( val[0] == "LINK" ) {
            //     var linkid = val[1];
            //     var linkthing = cm_Globals.devices[linkid];  //  cm_Globals.allthings[idx];
            // }
            results+= "<option command='"+command+"' linkval='"+linkval+"' value='" + subid + "'>" + subid + "<span class='reddot'> *</span></option>";
            subids.push(subid);
        });
    }

    if ( subids.length ) {
        var firstitem = subids[0];
    } else {
        firstitem = null;
    }
    
    // console.log("loadLinkItem - linkid: ", linkid, " thevlaue: ", thevalue, " allowuser: ", allowuser," subids: ", subids, " fields: ", results);
    return {fields: results, subids: subids, firstitem: firstitem};
}
 
 function initLinkActions(linkid, subid) {
    // get our fields and load them into link list box
    // and select the first item

    // var options = cm_Globals.options;
    
    // if the link isn't there then reset to digital clock default
    if ( !linkid ) {
        linkid = cm_Globals.currentid;
    } else {
        cm_Globals.currentid = linkid;
    }

    // var n = linkidx.indexOf("|");
    // var bid = linkidx.substring(n+1);
    // linkid = options.index[linkidx];
    var device = cm_Globals.devices[linkid];
    if ( !device ) { return; }

    var bid = device.deviceid;
    // var values = device.pvalue;
    
    // set the drop down list to the linked item
    $("#cm_link").prop("value", linkid);
    $("#cm_link option[value='" + linkid + "']").prop('selected',true);
                
    $("#cm_linkbid").html(bid + " => Tile #" + linkid);
    
    // read the existing fields of the linked tile, excluded user items
    var results = loadLinkItem(linkid, false, false, false);
    if ( results ) {
        $("#cm_linkfields").html(results.fields);
        
        // highlight the selected item. if nothing preselected use first item
        if ( !subid && results.firstitem ) {
            subid = results.firstitem;
        }
        if ( subid ) {
            $("#cm_linkfields option[value='" + subid + "']").prop('selected',true);

            // put this in the user field on the left for editing
            // $("#cm_userfield").prop("value", subid);
            $("#cm_userfield").attr("value", subid);
            $("#cm_userfield").val(subid);
        }
        initLinkSelect(results.subids);
    }
    
    // activate clicking on item by getting the id of the item selected
    // and save it in our global for later use 
    // then fill the list box with the subid's available
    $("#cm_link").off('change');
    $("#cm_link").on('change', function(event) {
        var linkid = $(this).val();
        var device = cm_Globals.devices[linkid];
        var bid = device.deviceid;
        cm_Globals.currentid = linkid;
        // var n = linkidx.indexOf("|");
        // var bid = linkidx.substring(n+1);
        // var options = cm_Globals.options;
        // var linkid = options.index[cm_Globals.currentid];
        $("#cm_linkbid").html(bid + " => Tile #" + linkid);
        var results = loadLinkItem(linkid, false, false, false);
        if ( results ) {
            $("#cm_linkfields").html(results.fields);
            initLinkSelect(results.subids);
            if ( results.firstitem ) {
                $("#cm_linkfields option[value='" + results.firstitem + "']").prop('selected',true).click();
            }
        }
        event.stopPropagation();
    });
 
}

function initLinkSelect() {
    $("#cm_linkfields option").off('click');
    $("#cm_linkfields option").on('click', function(event) {
        var subid = $(this).val();
        $("#cm_userfield").attr("value",subid);
        $("#cm_userfield").prop("value",subid);
        $("#cm_userfield").val(subid);
        
        // var tileid = cm_Globals.tileid;
        // var thing = cm_Globals.devices[tileid];
        // var value = thing.pvalue;
        // var subids = Object.keys(value);

        // check the builtin list for this subid
        var subids = [];
        var natives = [];
        $("#cm_builtinfields option").each(function() {
            var thissub = $(this).val();
            if ( !$(this).attr("command") ) {
                natives.push( thissub );                
            }
            subids.push( thissub );
        });

        if ( natives.includes(subid) ) {
            $("#cm_delButton").addClass("disabled").prop("disabled",true);
        } else {
            $("#cm_delButton").removeClass("disabled").prop("disabled",false);
        }
        
        // change button label to Add or Replace based on existing or not
        if ( subids.includes(subid) ) {
            $("#cm_addButton").text("Replace");
        } else {
            $("#cm_delButton").addClass("disabled").prop("disabled",true);
            $("#cm_addButton").text("Add");
        }
        
        event.stopPropagation();
   });
    
}

/* 
 * routines that initialize actions upon selection
 */
function initCustomActions() {
    
    $("#cm_customtype").off('change');
    $("#cm_customtype").on('change', function (event) {
        var tileid = cm_Globals.tileid;
        var customType = $(this).val();
        var content;
        
        
        // load the dynamic panel with the right content
        if ( customType === "LINK" ) {
            content = loadLinkPanel(tileid, cm_Globals.currentid);
            $("#cm_dynoContent").html(content);
            initLinkActions(null, null);
        } else if ( customType ==="URL" ) {
            content = loadUrlPanel();
            $("#cm_dynoContent").html(content);
            initExistingFields();
        } else if ( customType === "POST" || customType === "GET" || customType === "PUT" ) {
            content = loadServicePanel(customType);
            $("#cm_dynoContent").html(content);
            initExistingFields();
        } else if ( ENABLERULES && customType ==="RULE" ) {
            content = loadRulePanel();
            $("#cm_dynoContent").html(content);
            initExistingFields();
        } else {
            content = loadTextPanel();
            $("#cm_dynoContent").html(content);
            initExistingFields();
        }
        
        showPreview();
        event.stopPropagation;
    });
    
    $("#cm_addButton").off("click");
    $("#cm_addButton").on("click", function(event) {
        var subid = $("#cm_userfield").val();
        applyCustomField("addcustom", subid);
        event.stopPropagation;
    });
    
    $("#cm_delButton").off("click");
    $("#cm_delButton").on("click", function(event) {
        
        if ( $(this).hasClass("disabled") ) {
            event.stopPropagation;
            return;
        }
        
        var pos = {top: 375, left: 380, zindex: 9999, background: "red", color: "white", position: "absolute"};
        var subid = $("#cm_userfield").val();
        var tilename = $("#cm_subheader").html();
        createModal("modalremove","Remove item: " + subid + " from tile: " + tilename + "<br> Are you sure?", "table.cm_table", true, pos, function(ui) {
            var clk = $(ui).attr("name");
            if ( clk==="okay" ) {
                applyCustomField("delcustom", subid);
            }
        });
        event.stopPropagation;
    });
    
    $("#cm_text").on("change", function(event) {
        cm_Globals.usertext = $(this).val();
    });
}
 
function loadExistingFields(tileid, sortval, sortup) {
    // show the existing fields
    var results = loadLinkItem(tileid, true, sortval, sortup);
    // console.log("loadExistingFields results: ", results);
    if ( results ) {

        $("#cm_builtinfields").html(results.fields);
        var subid = results.firstitem;
        cm_Globals.defaultclick = subid;
        
        if ( subid ) {
            // set the default click
            $("#cm_builtinfields option[value='"+subid+"']").prop('selected',true);
            
            // text input for user values
            $("#cm_userfield").attr("value",subid);
            $("#cm_userfield").val(subid);
        }
    }
    
    showPreview();
}

function sortExistingFields(item, up) {
    
    // go through all the subs, eliminate dups, change order
    var lines = cm_Globals.rules;

    if ( !lines ) {
        return;
    }
    var newoptions = [];

    // first eliminate dups and list everything in order
    var lastindex = 0;
    lines.forEach(function(val) {
        var existing = false;
        $.each(newoptions, function(newi, newv) {
            if ( newv[2] === val[2] ) {
                existing = true;
                return false;
            }
        });
       
        if ( !existing ) {
            lastindex++;
            val[3] = lastindex;
            newoptions.push(val);
        }
    });

    // now set order
    if ( item && up ) {
        var k;
        var lenm1 = newoptions.length - 1;
        $.each(newoptions, function(index, val) {
            if ( item && val[2]===item ) {
                if ( up==="up" && index>0 ) {
                    k = newoptions[index-1][3];
                    newoptions[index-1][3] = val[3];
                    newoptions[index][3] = k;
                } else if ( up==="down" && index<lenm1 ) {
                    k = newoptions[index+1][3];
                    newoptions[index+1][3] = val[3];
                    newoptions[index][3] = k;
                }
                return false;
            }
        });
    }
    
    // sort the items into proper order
    newoptions.sort( function(a,b) {
        var ia = parseInt(a[3],10);
        var ib = parseInt(b[3],10);
        return ( ia - ib );
    });
    
    if ( up ) {
        // this is where the new order of custom tiles is set up
        cm_Globals.rules = newoptions.slice(0);
    }
}

function initExistingFields() {
    // var idx = cm_Globals.thingidx;
    
    // re-enable the user and build in fields
    $("#cm_userfield").prop("readonly",false).removeClass("readonly");
    $("#cm_builtinfields").prop("readonly",false).prop("disabled",false).removeClass("readonly");

    // check the builtin list for this subid
    var subids = [];
    var natives = [];
    $("#cm_builtinfields option").each(function() {
        var thissub = $(this).val();
        if ( !$(this).attr("command") ) {
            natives.push( thissub );                
        }
        subids.push( thissub );
    });

    $("#cm_userfield").off('input');
    $("#cm_userfield").on('input', function(event) {
        var tileid = cm_Globals.tileid;
        var subid = $("#cm_userfield").val();

        // var thing = cm_Globals.devices[tileid]
        // var value = thing.pvalue;
        // var subids = Object.keys(value);
        
        // change button label to Add or Replace based on existing or not
        if ( natives.includes(subid) ) {
            $("#cm_delButton").addClass("disabled").prop("disabled",true);
        } else {
            $("#cm_delButton").removeClass("disabled").prop("disabled", false);
        }
        if ( subids.includes(subid) ) {
            $("#cm_addButton").text("Replace");
        } else {
            $("#cm_addButton").text("Add");
            $("#cm_delButton").addClass("disabled").prop("disabled",true);
        }

    });
    
    $("#cm_upfield").off('click');
    $("#cm_upfield").on('click', function(event) {
        if ( $(this).hasClass("disabled") ) {
            event.stopPropagation;
            return;
        }
        var tileid = cm_Globals.tileid;
        var sortval = $("#cm_userfield").val();
        loadExistingFields(tileid, sortval, "up");
        initExistingFields();
        cm_Globals.reload = true;
        event.stopPropagation();
    });
    
    $("#cm_dnfield").off('click');
    $("#cm_dnfield").on('click', function(event) {
        if ( $(this).hasClass("disabled") ) {
            event.stopPropagation;
            return;
        }
        var tileid = cm_Globals.tileid;
        var sortval = $("#cm_userfield").val();
        loadExistingFields(tileid, sortval, "down");
        initExistingFields();
        cm_Globals.reload = true;
        event.stopPropagation();
    });
    
    // fill in the user item with our selected item
    $("#cm_builtinfields option").off('click');
    $("#cm_builtinfields option").on('click', function(event) {
        var subid = $(this).val();
        handleBuiltin(subid);
        event.stopPropagation();
   });
    
    $("#cm_text").on("change", function(event) {
        cm_Globals.usertext = $(this).val();
    });
}

function handleBuiltin(subid) {
    // var idx = cm_Globals.thingidx;
    // var allthings = cm_Globals.allthings;
    // var thing = allthings[idx];
    var tileid = cm_Globals.tileid;
    var thing = cm_Globals.devices[tileid]
    var value = thing.pvalue;
    var cmtext = value[subid];

    var item = $("#cm_builtinfields option[value='"+subid+"']");
    var cmtype = $(item).attr("command");
    var iscustom = ( cmtype && cmtype.length );
    var linkval = $(item).attr("linkval");
    // if ( !cmtype ) {
    //     cmtype = "TEXT";
    // }

    // console.log(">>>> subid: ", subid,"tileid: ", tileid, "thing: ", thing, "value: ", value, " cmtype: ", cmtype, " linkval: ", linkval);

    // var subids = Object.keys(value);
    // if ( cm_Globals.rules ) {
    //     cm_Globals.rules.forEach(rule => {
    //         subids.push(rule[2]);
    //         if ( rule[2] === subid ) {
    //             cmtext = rule[1];
    //         }
    //     });
    // }

    // check the builtin list for this subid
    var subids = [];
    var natives = [];
    $("#cm_builtinfields option").each(function() {
        var thissub = $(this).val();
        if ( !$(this).attr("command") ) {
            natives.push( thissub );                
        }
        subids.push( thissub );
    });

    cm_Globals.defaultclick = subid;

    // put the field clicked on in the input box
    $("#cm_userfield").attr("value",subid);
    $("#cm_userfield").val(subid);

    // check for an object
    // if ( cmtype!=="LINK" ) {
    //     var jsontval;
    //     var ipos = 0;
    //     if ( typeof(value[subid])==="undefined" ) {
    //         ipos = subid.indexOf("_");
    //         if ( ipos > 0 ) {
    //             var subid1 = subid.substr(0, ipos);
    //             var subid2 = subid.substr(ipos+1);
    //             try {
    //                 jsontval = value[subid1];
    //             } catch ( err ) {
    //                 jsontval = null;
    //             }
        
    //             if ( typeof jsontval==="object" ) {
    //                 cmtext = jsontval[subid2];
    //             // } else {
    //             //     cmtext = "unknown";
    //             }
    //         }
    //     } else {
    //         cmtext = value[subid];
    //     }
    //     linkval = cmtext;
    // }
    // console.log("subids: ", subids, " natives: ", natives, " value: ", value[subid], " linkval: ", linkval, " cmtext: ", cmtext);

    // update dyno panel
    if ( cmtype==="LINK" ) {
        // var oldval = $("#cm_customtype").val();
        $("#cm_customtype").prop("value", "LINK");
        $("#cm_customtype option[value='LINK']").prop('selected',true);
        // cm_Globals.currentid = linkval;
        var content = loadLinkPanel(tileid, linkval);
        // var content = loadLinkPanel(linkval);
        $("#cm_dynoContent").html(content);
        initLinkActions(linkval, subid);
    } else {
        cmtext = linkval;
        if ( !cmtype ) {
            cmtype = "TEXT";
        }
        $("#cm_customtype").prop("value", cmtype);
        $("#cm_customtype option[value='" + cmtype + "']").prop('selected',true)
        $("#cm_text").val(cmtext);
        cm_Globals.usertext = cmtext;

        var content;
        if (cmtype==="POST" || cmtype==="GET" || cmtype==="PUT") {
            content = loadServicePanel(cmtype);
            $("#cm_dynoContent").html(content);
        } else if ( cmtype==="URL") {
            content = loadUrlPanel();
            $("#cm_dynoContent").html(content);
        } else if ( cmtype==="RULE") {
            content = loadRulePanel();
            $("#cm_dynoContent").html(content);
        } else {
            content = loadTextPanel();
            $("#cm_dynoContent").html(content);
        }
        initExistingFields();
    }
    showPreview();

    // disable or enable the Del button based on user status
    // alert("cmtype = "+cmtype);
    if ( iscustom ) {
        $("#cm_delButton").removeClass("disabled").prop("disabled", false);
        $("#cm_upfield").removeClass("disabled").prop("disabled",false);
        $("#cm_dnfield").removeClass("disabled").prop("disabled",false);
    } else {
        $("#cm_delButton").addClass("disabled").prop("disabled", true);
        $("#cm_upfield").addClass("disabled").prop("disabled",true);
        $("#cm_dnfield").addClass("disabled").prop("disabled",true);
    }

    // change button label to Add or Replace based on existing or not
    // console.log("subid = ",subid," subids = ", subids);
    if ( natives.includes(subid) ) {
        $("#cm_delButton").addClass("disabled").prop("disabled",true);
    } else {
        $("#cm_delButton").removeClass("disabled").prop("disabled", false);
    }
    if ( subids.includes(subid) ) {
        $("#cm_addButton").text("Replace");
    } else {
        $("#cm_addButton").text("Add");
        $("#cm_delButton").addClass("disabled").prop("disabled",true);
    }


}

// function uses php to save the custom info to hmoptions.cfg
// for this call value and attr mean something different than usual
// changed type back to what it usually is
function applyCustomField(action, subid) {
    var tileid = cm_Globals.tileid;
    var thing = cm_Globals.devices[tileid]
    var bid = thing.deviceid;

    if ( cm_Globals.rules ) {
        var oldrules = cm_Globals.rules.slice(0);
    } else {
        var oldrules = [];
    }
    // console.log(">>>> rules before update: ", oldrules);

    // var value = thing.pvalue;
    var customtype = $("#cm_customtype").val();
    var content = null;


    var errors = [];

    var existing = false;
    if ( action==="addcustom" ) {

        // var options = cm_Globals.options;
        if ( customtype==="LINK" ) {
            var olditem = cm_Globals.devices[cm_Globals.currentid];
            if ( olditem ) {
                content = olditem.id;
            }
        } else {
            content = $("#cm_text").val();
        }

        var therule = [customtype, content, subid];
        if ( !cm_Globals.rules ) {
            cm_Globals.rules = [];
        }
        for ( var i = 0; i < oldrules.length; i++ ) {
            var rule = oldrules[i];
            if ( rule[2]===subid ) {
                cm_Globals.rules[i] = therule;
                existing = true;
                break;
            }
        }
        if ( !existing && action==="addcustom" ) {
            cm_Globals.rules.push(therule);
            existing = true;
        }
    } 
    else if ( action==="delcustom" && cm_Globals.rules && cm_Globals.rules.length ) {
        var i = 0;
        while ( i < cm_Globals.rules.length ) {
            var rule = cm_Globals.rules[i];
            // console.log("i, rule[2], subid: ", i, rule[2], subid);
            if ( (rule && rule.length && rule.length > 2 && rule[2]===subid) ||  !rule || !rule.length || rule.length < 3  ) {
                cm_Globals.rules.splice(i,1);
                existing = true;
                break;
            } else {
                i++;
            }
        }
    } else {
        existing = false;
    }
    // console.log(">>>> rules after update: ", subid, cm_Globals.rules);
    
    // check for valid entries
    // skip URL check to enable Android stuff
    if ( !existing ) {
        errors.push("Problem encountered trying to add, update, or remove a rule");
    }
    if ( subid && subid.length < 2 && subid!=="password" ) {
        errors.push("Your selected user field name [" + subid + "] is too short. Must be at least 2 characters");
    }
    if ( content && (customtype==="POST" || customtype==="GET" || customtype==="PUT") && 
         ( !content.startsWith("http://") && !content.startsWith("https://") ) ) {
        errors.push("User content for web type entries must begin with http or https"); 
    }
    if ( action==="addcustom" && customtype==="TEXT" && content.length===0 ) {
        errors.push("Custom text provided for TEXT type addition cannot be an empty string.");
    }

    // don't update if we are adding
    // if we are deleting then remove all rules since they are messed up
    if ( errors.length ) {
        var errstr = errors.join("\n  ");
        alert("Invalid entries:\n" + errstr);
        if ( action==="addcustom" ) { 
            return; 
        } else {
            cm_Globals.rules = "";
        }
    }
        
        // show processing window
        // var pos = {top: 5, left: 5, zindex: 9999, background: "red", color: "white"};
        // createModal("waitbox", "Processing " + action + " Please wait...", "table.cm_table", false, pos);
        var rules = encodeURI(JSON.stringify(cm_Globals.rules));
        // console.log(">>>> rules : ", rules);
        $.post(cm_Globals.returnURL, 
            {useajax: action, userid: cm_Globals.options.userid, id: bid, value: customtype, 
                rules: rules, tileid: tileid, subid: subid},
            function (presult, pstatus) {
                if (pstatus==="success") {
                    cm_Globals.reload = true;
                    
                    // update the visual boxes on screen
                    if ( action==="addcustom" ) {
                        loadExistingFields(tileid, subid, false);
                        handleBuiltin(subid);
                    } else {
                        getDefaultSubids();
                    }
                    // closeModal("waitbox");
                } else {
                    console.log("Error attempting to perform " + action + ". presult: ", presult);
                    // closeModal("waitbox");
                }
            }, "json"
        );
   
}

function showPreview() {
    var aid = cm_Globals.aid;
    var bid = cm_Globals.id;
    var tileid = cm_Globals.tileid;
    var str_type = cm_Globals.type;
    var swattr = cm_Globals.customname;
    var device = clone(cm_Globals.devices[tileid]);

    // make an unresolved item for each rule/link
    if ( cm_Globals.rules ) {
        cm_Globals.rules.forEach(rule => {
            var rulesubid = rule[2];
            var command = rule[0];
            var ruleval = command + "::";
            if ( command === "LINK" ) {
                ruleval = ruleval + rulesubid + "::" + rule[1];
            } else if ( command === "TEXT" ) {
                ruleval = rule[1];
            } else {
                ruleval = ruleval + rulesubid;
            }
            device.pvalue[rulesubid] = ruleval;
        });
    }

    var thingvalue = encodeURI(JSON.stringify(device));
    
    $.post(cm_Globals.returnURL, 
        {useajax: "wysiwyg", userid: cm_Globals.options.userid, tileid: tileid, id: bid, thingid: aid, type: str_type, 
         value: thingvalue, attr: swattr},
        function (presult, pstatus) {
            if (pstatus==="success" ) {
                $("#cm_preview").html(presult);

                // activate click on items
                $("#te_wysiwyg").off('click');
                $("#te_wysiwyg").on('click', function(event) {
                    var subid = $(event.target).attr("subid");
                    // console.log("subid= ", subid);
                    if ( typeof subid!=="undefined" ) {
                        // find the item and select it
                        try {
                            $("#cm_builtinfields > option[value='" + subid + "']").prop('selected',true).click();
                        } catch(e) {}
                    }
                    event.stopPropagation();
                });
            
                var slidertag = "#cm_preview div.overlay.level >div.level";
                if ( $(slidertag) ) {
                    $(slidertag).slider({
                        orientation: "horizontal",
                        min: 0,
                        max: 100,
                        step: 5
                    });
                }
            }
        }
    );
}