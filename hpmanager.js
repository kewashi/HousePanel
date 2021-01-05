"use strict";
process.title = 'hpmanager';

// *****************************************************************
// hpmanager
// 
// This program reads legacy HousePanel hmoptions.cfg and hm_*.cfg
// files and converts them into relational tables and inserts
// the associated data into a mysql database
// *****************************************************************

const DEBUG = false;
const fs = require('fs');
var sqlclass = require("./mysqlclass");

function nocomma(sqlstr) {
    // remove the ending ", "
    if ( sqlstr && sqlstr.endsWith(", ") ) {
        var len = sqlstr.length;
        sqlstr = sqlstr.substr(0, len-2);
    }
    return sqlstr;
}

function writeOptions(userid, options) {

    // write all users as panels linked to the first user
    var sqlstr = "INSERT INTO panels (`userid`, `pname`, `password`, `skin`) VALUES ";
    for (var panelid in options.config.pword) {
        var userinfo = options.config.pword[panelid];
        sqlstr += "(" + userid + ", '" + panelid + "', '" + userinfo[0] + "', '" + userinfo[1] + "'), ";
    }
    if ( sqlstr.endsWith(", ") ) {
        const len = sqlstr.length;
        sqlstr = sqlstr.substr(0, len-2);
    }

    // console.log(">>>> running query: ", sqlstr);
    var mainresult = mydb.query(sqlstr)
    .then(result => {

        var ndevices = result.getAffectedItemsCount();
        console.log(">>>> wrote: ", ndevices, " panels");

        // first look for an empty hub
        var hubresult = mydb.getRow("hubs", "*", "hubid = '-1'")
        .then(row => {
            if ( row ) {
                var result = row.id;
            } else {
                result = mydb.addRow("hubs", {userid: userid, hubid: "-1", hubhost: "None", hubtype: "None", hubname: "None", 
                                clientid: "", clientsecret: "", hubaccess: "", hubendpt: "", hubrefresh: "", 
                                useraccess: "", userendpt: "", hubtimer: "0" })
                .then(result => {
                    var nohubid = result.getAutoIncrementValue();
                    return nohubid;
                });
            }
            return result;
        })
        .then(nohubid => {

            console.log(">>>> default hub id: ", nohubid);
            // write the hubs 
            // start by getting keys
            var sqlstr = "INSERT INTO hubs (" + 
                        "`userid`, `hubtype`, `hubhost`, `clientid`, `clientsecret`, `useraccess`, `userendpt`, " +
                        "`hubname`, `hubid`, `hubaccess`, `hubendpt`, `hubtimer`, `hubrefresh`) VALUES ";

            // now add the values
            var nhub = 1;
            options.config.hubs.forEach(function(hub) {
                var hubvals = "";
                nhub++;
                hubvals += "'" + userid + "', ";
                var hasrefresh = false;
                for(var hubkey in hub) {
                    var hubval = hub[hubkey];
                    hubvals += "'" + hubval + "', ";
                    if ( hubkey === "hubRefresh" ) {
                        hasrefresh = true;
                    }
                }
                if ( hubvals.endsWith(", ") ) {
                    const len = hubvals.length;
                    hubvals = hubvals.substr(0, len-2);
                }
                if ( !hasrefresh ) {
                    hubvals += ", ''";
                }
                sqlstr += "(" + hubvals + "), ";
            });

            if ( sqlstr.endsWith(", ") ) {
                const len = sqlstr.length;
                sqlstr = sqlstr.substr(0, len-2);
            }

            // console.log(">>>> running query: ", sqlstr);
            var result = mydb.query(sqlstr)
            .then(result => {
                var ndevices = result.getAffectedItemsCount();
                console.log(">>>> wrote: ", ndevices, " hubs");
                return result;
            });

            return result;
        })
        .then(result => {

            // get all hubs from this user
            var res3 = mydb.getRows("hubs","*","userid = " + userid)
            .then(hubs => {

                var nohubid = 1;
                var stid = 1;
                var nstid = 1;
                var heid = 1;
                var isyid = 1;
                var fordid = 1;
                for (var ih=1; ih<=hubs.length; ih++) {
                    switch ( hubs[ih-1].hubtype ) 
                    {
                        case "None":
                            nohubid = ih;
                            break;

                        case "SmartThings":
                            stid = ih;
                            break;

                        case "NewSmartThings":
                            nstid = ih;
                            break;

                        case "Hubitat":
                            heid = ih;
                            break;

                        case "ISY":
                            isyid = ih;
                            break;
                            
                        case "Ford":
                        case "Lincoln":
                            fordid = ih;
                            break;
                    }
                }

                // write all the devices
                // build up the sql statement to add all these rows at once
                // note - the pvalue will be retrieved by the hub later
                var sqlstr = "INSERT INTO devices (`userid`, `hubid`, `deviceid`, `name`, `devicetype`, `hint`, `refresh`, `pvalue`) VALUES ";
                for (var idx in options.index) {
                    var items = idx.split("|");
                    var swtype = items[0];
                    var deviceid = items[1];
                    var nid = parseInt(deviceid);
                    var isHubitat = (typeof nid !== "undefined") && !isNaN(nid) && (nid.toString() === deviceid);
                    var origname = "unknown";
                    var pvalue = {name: origname};
                    
                    var hint = swtype;
                    var refresh = "normal";
                    var hubid;
                    try {
                        if ( swtype==="isy" ) {
                            hubid = isyid;
                        } else if ( swtype==="ford") {
                            hubid = fordid;
                        } else if ( isHubitat || deviceid.startsWith("h_") || deviceid.startsWith("h1_") ) {
                            hubid = heid;
                        } else if ( deviceid.length > 12 || deviceid.startsWith("st_") ) {
                            hubid = stid;
                        } else {
                            hubid = nohubid;
                        }
                    } catch(e) {
                        hubid = nohubid;
                    }
                    sqlstr += "(" + userid + "," + hubid + ",'" + deviceid + "','" + origname + "','" + swtype + "','" + 
                                    hint + "','" + refresh + "','" + encodeURI(JSON.stringify(pvalue)) + "'), ";
                }
        
                // remove the ending ", "
                if ( sqlstr.endsWith(", ") ) {
                    var len = sqlstr.length;
                    sqlstr = sqlstr.substr(0, len-2);
                }
        
                // now perform the query
                // console.log(">>>> running query: ", sqlstr);
                var res2 = mydb.query(sqlstr)
                .then(result => {
                    if ( result ) {
                        var ndevices = result.getAffectedItemsCount();
                        console.log(">>>> wrote: ", ndevices, " devices");
                    }
                    return result;
                })
                .then(result => {
                    var result = mydb.getRows("devices","*","userid = " + userid)
                    .then(devices => {
                        if ( devices && devices.length ) {
                            console.log(">>>> Successfully imported ", devices.length, " devcies from userid = ", userid);
                            writeThings(userid, devices);
                        } else {
                            console.log(">>>> error - no devices imported");
                        }
                        return devices;
                    });
                    return result;
                });
                return res2;
            });
            return res3;
        })
        .then ( result => {

            // add all other config settings
            // build up the sql statement to add all these rows at once
            var sqlstr = "INSERT INTO configs (`userid`, `configkey`, `configval`) VALUES ";
            for (var key in options.config) {
                if ( key!=="hubs" && key!=="pword" ) {
                    var strval = JSON.stringify(options.config[key]);
                    sqlstr += "('" + userid + "','" + key + "','" + strval + "'), ";
                }
            }
            
            // add all other main settings
            for (var key in options) {
                if ( key!=="config" && key!=="index" && key!=="rooms" && key!=="things" ) {
                    var strval = JSON.stringify(options[key]);
                    sqlstr += "('" + userid + "','" + key + "','" + strval + "'), ";
                }
            }

            // remove the ending ", "
            if ( sqlstr.endsWith(", ") ) {
                var len = sqlstr.length;
                sqlstr = sqlstr.substr(0, len-2);
            }

            // now perform the query
            // console.log(">>>> running query: ", sqlstr);
            var res2 = mydb.query(sqlstr)
            .then(result => {
                var ntotal = result.getAffectedItemsCount();
                console.log(">>>> wrote: ", ntotal, " configuration settings");
                return result;
            });

            return result;
        });

        return result;
    });
    return mainresult;
}

function clearTable(tablename, conditions) {
    if ( !conditions ) {
        conditions = "id > 0";
    }

   var result = mydb.deleteRow(tablename, conditions).then(result => {
        var n = result.getAffectedItemsCount();
        console.log("Deleted ", n, " rows from table: ", tablename);
        return result;
    })
    .then(result => {
        mydb.query("ALTER TABLE " + tablename + " AUTO_INCREMENT = 1");
        return result;
    });

    return result;
}

// open the database
var dbinfo = JSON.parse(fs.readFileSync("dbinfo.cfg","utf8"));
var mydb = new sqlclass.sqlDatabase(dbinfo.dbhost, dbinfo.dbname, dbinfo.dbuid, dbinfo.dbpassword);

// read the options file
const fname = "hmoptions.cfg";
var options = JSON.parse(fs.readFileSync(fname, 'utf8'));
var defaultid = 0;

// clear old stuff out
// we don't need to remove devices and things because they are linked to hubs
// and we don't need to remove rooms because they are linked to panels
// but I do it anyway just to be sure
clearTable("hubs")
.then(res => {
    clearTable("panels");
})
.then(res => {
    clearTable("rooms");
})
.then(res => {
    clearTable("devices");
})
.then(res => {
    clearTable("things");
})
.then(res => {
    clearTable("configs");
})
.then(res => {

    // get the first user in the hmoptions file
    // the promise returns the userid found or generated
    var users = Object.keys(options.config.pword);
    var firstname = users[0];
    var firstuser = options.config.pword[firstname];

    // lets look for username
    var result = mydb.getRow("users", "*", "uname = '"+firstname+"'")
    .then(row => {

        // if found, then update with password
        if ( row ) {
            defaultid = row.id;
            var result = mydb.updateRow("users", {password: firstuser[0]} , "id = '" + defaultid +"'")
            .then(result => {
                var isupdated = result.getAffectedItemsCount();
                if ( DEBUG ) {
                    console.log(">>>> updated ", isupdated, " rows in users, id = ", defaultid, " user: ", row);
                }
                result = writeOptions(defaultid, options);
                return row;
            });

        // if not found then add to database as a new user
        } else {
            var emailguess = firstname + "@gmail.com";
            var userrow = {email: emailguess, uname: firstname, password: firstuser[0], usertype: 1, defhub: "1"};
            result = mydb.addRow("users", userrow )
            .then(result => {
                defaultid = result.getAutoIncrementValue();
                userrow.id = defaultid;
                console.log(">>>> created new user row in users, id = ", defaultid, " user: ", userrow);
                console.log(">>>> warning - placeholder email value created = ", emailguess);
                result = writeOptions(defaultid, options);
                return userrow;
            });
        }
        return result;
    });
    return result;

})
.then(row => {

    var userid = row.id;
    console.log("Finished translating files for userid = ", userid);
});

function writeThings(userid, devices) {
    if ( !userid ) {
        console.log(">>>> error - cannot translate your hmoptions.cfg file. Invalid user or no user found.");
        return false;
    }
 
    // handle all panels
    mydb.getRows("panels","*","userid = " + userid)
    .then(rows => {

        rows.forEach(function(row) {

            var panelid = row.id;
            var panelname = row.pname;
            var hmfile = "hm_" + panelname + ".cfg";
        
            // read the rooms for each panel
            try {
                var roomthings = JSON.parse(fs.readFileSync(hmfile, 'utf8'));
                if ( DEBUG ) {
                    console.log(">>>> roomthings: ", roomthings.things);
                }
            } catch (e) {
                console.log(">>>> error - file: ", hmfile, " not found.");
                roomthings = null;
                return null;
            }

            // write the rooms for this panel
            var sqlstr = "";
            var sqlstr = "INSERT INTO rooms (`userid`, `panelid`, `rname`, `rorder`) VALUES ";
            for ( var roomname in roomthings.rooms ) {
                var roomorder = roomthings.rooms[roomname];
                sqlstr += "(" + userid + ", " + panelid + ", '" + roomname + "', " + roomorder + "), ";
            }
            sqlstr = nocomma(sqlstr);

            // now perform the query
            // console.log(">>>> running query: ", sqlstr);
            mydb.query(sqlstr)
            .then(result => {
                var ntotal = result.getAffectedItemsCount();
                console.log(">>>> wrote: ", ntotal, " rooms for panel ", panelname);

                mydb.getRows("rooms","id,rname", "userid="+userid+" AND panelid="+panelid)
                .then(rooms => {
                    if ( DEBUG ) {
                        console.log(">>>> rooms for user= ", userid," panel= ", panelid, ": ", rooms );
                    }
                    // now write the things for each room for this panel
                    // we only include roomid since panelid and roomname are found in the rooms table
                    // var sqlstrthings = "INSERT INTO things (`userid`, `roomid`, `panelid`, `rname`, `tileid`, `posx`, `posy`, `zindex`, `customname`) VALUES ";
                    // note - the field is called "tileid" but it is really the "id" of the device
                    //        but I didn't want to use "deviceid" because that could be confused with the actual device id in the hub
                    var sqlstrthings = "INSERT INTO things (`userid`, `roomid`, `tileid`, `posy`, `posx`, `zindex`, `torder`, `customname`) VALUES ";
                    for ( var i in rooms ) {
                        var roomname = rooms[i].rname;
                        var roomid = rooms[i].id;
                        var roomarray = roomthings.things[roomname];
                        var torder = 0;
                        roomarray.forEach(function(thingarray) {
                            var tileid = thingarray[0];
                            
                            var devidx = "";
                            for (var idx in options.index) {
                                if ( tileid && options.index[idx] === tileid ) {
                                    devidx = idx;
                                }
                            }

                            if ( devidx ) {
                                var idxtypes = devidx.split("|");
                                var swtype = idxtypes[0];
                                var swid = idxtypes[1];
                                var deviceid = 0;
                                for (i=0; i<devices.length; i++) {
                                    if ( devices[i]["devicetype"] === swtype && devices[i]["deviceid"] === swid ) {
                                        deviceid = devices[i].id;
                                        break;
                                    }
                                }
                                
                                if ( typeof tileid === "string" ) {
                                    tileid = parseInt(tileid);

                                    // if bogus info don't add this tile
                                    if ( isNaN(tileid) ) {
                                        tileid = 1; 
                                    }
                                }
                                
                                // use the old config file tileid if the device isn't found
                                // but this should never happen since all devices are written in the translation
                                if ( deviceid === 0 ) {
                                    deviceid = tileid;
                                }

                                var posy = thingarray[1];
                                if ( typeof posy === "string" ) {
                                    posy = parseInt(posy);
                                    if ( isNaN(posy) ) { posy = 0; }
                                }
                                var posx = thingarray[2];
                                if ( typeof posx === "string" ) {
                                    posx = parseInt(posx);
                                    if ( isNaN(posx) ) { posx = 0; }
                                }
                                var zindex = thingarray[3];
                                if ( typeof zindex === "string" ) {
                                    zindex = parseInt(zindex);
                                    if ( isNaN(zindex) ) { zindex = 1; }
                                }
                                var customname = thingarray[4];
                                customname = customname.replace(/'/g, "\\'");
                                customname = customname.replace(/"/g, '\\"');
                                // console.log(">>>> deviceid = ", deviceid, " tileid= ", tileid);
                                if ( DEBUG ) {
                                    console.log(">>>> room things: ", userid, roomid, roomname, deviceid, posy, posx, zindex, customname);
                                }
                                // sqlstrthings += "(" + userid + ", " + roomid + ", " + panelid + ", '" + roomname + "', " + tileid + ", " + posx + ", " + posy + ", " + zindex + ", '" + customname + "'), ";
                                torder++;
                                sqlstrthings += "(" + userid + ", " + roomid + ", " + deviceid + ", " + posy + ", " + posx + ", " + zindex + ", " + torder + ", '" + customname + "'), ";
                            }
                        });
                    }
                    sqlstrthings = nocomma(sqlstrthings);
                    mydb.query(sqlstrthings)
                    .then( result => {
                        var ntotal = result.getAffectedItemsCount();
                        console.log(">>>> wrote: ", ntotal, " things for panel ", panelname);
                        return result;
                    })
                    .catch( err => {
                        console.log(err);
                    });
                });
            return result;
            })
            .catch( err => {
                console.log(err);
            });
        });
    });

}

