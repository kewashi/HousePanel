#!/usr/bin/env node

const mysqlx = require('mysql');
const sqlite3 = require('sqlite3');

const DEBUGsql = false;

exports.sqlDatabase = class sqlDatabase {
    
    constructor(dbhost, dbname, dbuid, dbpassword, dbtype) {        
        this.insertId = 0;
        this.impacted = 0;
        this.recentResults;
        this.recentAdd;
        this.recentRequest = "";
        this.error;
        this.dbtype = (dbtype==="mysql" || dbtype==="sqlite") ? dbtype : "sqlite";
        // var hpcrt = fs.readFileSync(__dirname + 'rootCA.crt');

        this.config = {
            host: dbhost,
            user: dbuid,
            password: dbpassword,
            database: dbname
        };
        if ( DEBUGsql ) {
            console.log(">>>> db info - startup: ", dbhost, dbname, dbuid, dbpassword, dbtype);
        }

        try {
            if ( this.dbtype==="mysql" ) {
                this.connection = mysqlx.createConnection(this.config);
                this.connection.connect();
            } else {
                if ( dbname.indexOf(".")=== -1 ) {
                    dbname = dbname + ".db";
                    this.config.database = dbname;
                }
                this.connection = new sqlite3.Database(dbname);
            }
        } catch (e) {
            console.log(">>>> db connect error: ", e);
        }
    }

    getId() {
        return this.insertId;
    }

    getImpacted() {
        return this.impacted;
    }

    getAdd() {
        return this.recentAdd;
    }

    getResults() {
        return this.recentResults;
    }

    getError() {
        return this.error;
    }

    getRequest() {
        return this.recentRequest;
    }

    die(msg) {
        this.error = msg;
        this.insertId = 0;
        this.impacted = 0;
        this.recentResults = null;
        if ( DEBUGsql ) {
            console.log(">>>> sql error: ", msg);
        }
        var promise = new Promise(function(resolve, reject) {
            reject(msg);
            // resolve(null);
        });
        return promise;
    }

    getJoinStr(usertable, idjoinfrom, jointable, idjointo, jtype) {
        if ( !usertable || !jointable ) {
            console.log(">>>> Two tables must be specified in call to getJoinStr");
            return null;
        }
        var jstr1 = usertable + "." + idjoinfrom;
        var jstr2 = jointable + "." + idjointo;
        if ( !jtype ) {
            jtype = "INNER";
        }
        var jstr = " " + jtype + " JOIN " + jointable + " ON " + jstr1 + " = " + jstr2;
        return jstr;
    }

    addRow(usertable, values) {
        if ( !usertable ) {
            return this.die("No table specified in call to addRow");
        }

        // lastid will be returned by the sql engine so set it here to 0
        this.insertID = 0;
        var keystring = "";
        var valstring = "";
        this.recentAdd = values;
        for (var fieldkey in values) {
            var fieldvalue = values[fieldkey];
            fieldkey= "`" + fieldkey.toString() + "`";
            fieldvalue ="'" + fieldvalue + "'";

            if ( keystring==="" ) {
                keystring = fieldkey;
                valstring = fieldvalue;
            } else {
                keystring += ", " + fieldkey;
                valstring += ", " + fieldvalue;
            }
        }
        var str = "INSERT INTO " + usertable + " ( " + keystring + ") VALUES ( " + valstring + " )";
        return this.query(str);
    }
    
    // this either updates or adds a new row to the table
    // it first tries to update. If it fails then conditions are ignored and an attempt to add values
    // will be made as a new row. This will only succeed if all required fields are provided
    // the force parameter if true will skip the test of addRow and assume the update query is valid
    // if it is not valid the query will throw an exception
    updateRow(usertable, values, conditions, force = false) {
        if ( !usertable ) {
            return this.die("No table specified in call to updateRow");
        }
        if ( !conditions ) {
            return this.die("Attempted to update row with no conditions set");
        }

        // if we know row is there, use force to go straight to update query
        // this option also requires the id field to be present
        if ( force && values.id ) {
            this.insertId = values.id;
            var str = buildUpdateStr();
            if ( DEBUGsql ) {
                console.log(">>>> force updating row with query: ", str );
            }
            return this.query(str);
        } else {
            var that = this;
            return that.getRow(usertable, "id", conditions)
            .then( result => {
                // if row is there then update it and return the update promise
                // also set the lastid field to the existing row so we can get it if needed
                if ( result ) {
                    that.insertId = result.id;
                    var str = buildUpdateStr();
                    if ( DEBUGsql ) {
                        console.log(">>>> updating row with query: ", str );
                    }
                    return that.query(str);

                // otherwise add a new row and return the add promise
                } else {
                    if ( DEBUGsql ) {
                        console.log(">>>> adding row to table ", usertable, " with values: ", values, " and conditions: ", conditions);
                    }
                    return that.addRow(usertable, values);
                }
            });
            
        }
            

        function buildUpdateStr() {
            var updatestr = "";
            for (var fieldkey in values) {

                var fieldvalue = values[fieldkey];
                fieldkey = "`" + fieldkey.toString() + "`";
                fieldvalue = "'" + fieldvalue + "'";

                if ( updatestr==="" ) {
                    updatestr = fieldkey + " = " + fieldvalue;
                } else {
                    updatestr += ", " + fieldkey + " = " + fieldvalue;
                }
            }

            // update the fields requested
            var str = "UPDATE " + usertable;
            // // add all of the joins provided do not remove the space in between
            // if ( joins && typeof joins === "string" ) {
            //     str += " " + joins + " ";
            // } else if ( joins && typeof joins === "object" && Array.isArray(joins)  ) {
            //     str += " " + joins.join(" ") + " ";
            // }
            
            str += " SET " + updatestr + " ";

            if ( conditions ) {
                str += " WHERE " + conditions;
            }
            return str;
        }
    }
    
    deleteRow(usertable, conditions, joins) {
        this.error = null;
        if ( !usertable ) {
            return this.die("No table specified in call to deleteRow");
        }
        if ( !conditions ) {
            return this.die("Attempted to delete row with no conditions set");
        }
        var str = "DELETE FROM " + usertable;

        // add all of the joins provided do not remove the space in between
        if ( joins && typeof joins === "string" ) {
            str += " " + joins + " ";
        } else if ( joins && typeof joins === "object" && Array.isArray(joins)  ) {
            str += " " + joins.join(" ") + " ";
        }

        if ( conditions !== "ALL" && conditions !== "all" ) {
            str += " WHERE " + conditions;
        }
        this.insertId = 0;

        return this.query(str);
    }
    
    getRow(usertable, fields, conditions, joins, orderby, callback) {
        return this.getRows(usertable, fields, conditions, joins, orderby, true, callback);
    }

    // use a promise 
    // the rows will have table names in the columns if joined is provided
    // if you want the table name without a join, use a blank string as the join
    getRows(usertable, fields, conditions, joins, orderby, firstrow, callback) {

        this.error = null;
        var that = this;

        // create a custom promise that mimicks how the X lib works
        var promise = new Promise(function(resolve, reject) {

            if ( !usertable ) {
                console.log(">>>> fatal DB error: No table specified in call to getRows");
                reject(null);
                return;
            }

            // can pass a string or an array to pick which fields to read from the table
            var keystring = "*";
            if ( typeof fields === "string" ) {
                if (fields=="") { fields = "*"; }
                keystring = fields;
            } else if ( typeof fields === "object" && Array.isArray(fields) ) {
                keystring = fields.join(", ");
            }
            var str = "SELECT " + keystring + " FROM " + usertable;

            // add all of the joins provided do not remove the space in between
            var isjoined = false;
            if ( joins && typeof joins === "string" ) {
                str += " " + joins + " ";
                isjoined = true;
            } else if ( joins && typeof joins === "object" && Array.isArray(joins)  ) {
                str += " " + joins.join(" ") + " ";
                isjoined = true;
            }
            
            // add on the optional conditions
            if (conditions && typeof conditions === "string")  { 
                str += " WHERE " + conditions; 
            } else if ( conditions && typeof conditions === "object") {
                str += " WHERE ";
                var addon = "";
                for ( var objkey in conditions) {
                    str += addon + "(" + objkey + " = '" + conditions[objkey] + "')";
                    addon = " AND ";
                }
            }

            // add on ordering if provided
            if (orderby && typeof orderby === "string") {
                str += " ORDER BY " + orderby; 
            }

            that.recentRequest = str;
            var options = {sql: str};

            // disable this because sqlite doesn't support it
            // so had to rewrite all the queries accordingly anyway
            // if ( joins ) {
            //     options.nestTables = "_";
            // }

            if ( that.dbtype === "mysql" ) {

                that.connection.query(options, function(err, result, columns) {
                    var rowobjs;
                    if ( err ) {
                        that.error = err;
                        reject(err);
                    } else {

                        if ( typeof result !== "object" ) {
                            rowobjs = null;
                            that.insertId = 0;
                        } else if ( firstrow===true ) {
                            rowobjs = result.length ? result[0] : null;
                            that.insertId = rowobjs ? rowobjs.id : 0;
                        } else {
                            rowobjs = result;
                            that.insertId = 0;
                        }
                        that.recentResults = rowobjs;
                        resolve(rowobjs);
                    }

                    if ( callback ) {
                        callback(rowobjs);
                    }

                });

            } else {
                if ( firstrow===true ) {
                    that.connection.get(options.sql, [], function(err, row) {
                        if ( row && typeof row === "object" && row.id!==null ) {
                            that.insertId = row.id;
                        } else {
                            that.insertId = 0;
                        }
                        getorall(err, row);
                    });
                } else {
                    that.connection.all(options.sql, [], function(err, rows) {
                        that.insertId = 0;
                        getorall(err, rows);
                    });
                }
            }
            function getorall(err, rows) {
                if ( err ) {
                    that.error = err;
                    if ( DEBUGsql ) {
                        console.log(">>>> sql error: ", err);
                    }
                    reject(null);
                } else {
                    that.recentResults = rows;
                    if ( callback && typeof callback === "function" ) {
                        callback(rows);
                    }
                    resolve(rows);
                }
            }
        });
        return promise;
    }

    // generic user-defined query
    query(str, callback) {
        this.error = null;
        var that = this;
        this.recentRequest = str;
        
        var promise = new Promise(function(resolve, reject) {

            if ( that.dbtype === "mysql" ) {
                that.connection.query(str, function(err, sqlresult, fields) {
                    if ( err ) {
                        sqlresult = null;
                        that.error = err;
                        reject(null);
                    } else {
                        that.insertId = sqlresult.insertId;
                        that.impacted = sqlresult.affectedRows;

                        // mimick X protocol
                        sqlresult.getAffectedItemsCount = function() {
                            return sqlresult.affectedRows;
                        }
                        sqlresult.getAutoIncrementValue = function() {
                            return sqlresult.insertId;
                        }
                        resolve(sqlresult);
                    }

                    if ( callback ) {
                        callback(sqlresult);
                    }
                });
            } else {

                // run a get if the query is a select
                if ( typeof str === "string" && str.toUpperCase().startsWith("SELECT") ) {
                    that.connection.get(str, [], function(err, row) {
                        if ( err ) {
                            reject(err);
                        } else {
                            if ( callback && typeof callback === "function" ) {
                                callback(row);
                            }
                            resolve(row);
                        }
                    });
                } else {
                    that.connection.run(str, [], function(err) {
                        if ( err ) {
                            that.error = err;
                            reject(err);
                        } else {
                            var sqlresult = {};
                            sqlresult.insertId = this.lastID ? this.lastID : that.insertId;
                            sqlresult.affectedRows = this.changes ? this.changes : null;
                            sqlresult.impactedId = that.insertId;
                            that.insertId = sqlresult.insertId;
                            that.impacted = sqlresult.affectedRows;

                            // mimick X protocol
                            sqlresult.getAffectedItemsCount = function() {
                                return this.affectedRows;
                            }
                            sqlresult.getAutoIncrementValue = function() {
                                return this.insertId;
                            }
                            // added this to ensure it only returns an existing impacted ID when doing updates
                            sqlresult.getImpactedId = function() {
                                return this.impactedId;
                            }
                            resolve(sqlresult);
                        }

                        if ( callback ) {
                            callback(sqlresult);
                        }
                    });
                }
            }
        });
        return promise;
    }

    catch(err) {
        if ( DEBUGsql ) {
            console.log(">>>> fatal DB error: ", err);
        }
    }

}
