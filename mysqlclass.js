var mysqlx = require('mysql');
const DEBUGsql = false;
const DEBUGrow = false;

exports.sqlDatabase = class sqlDatabase {
    
    constructor(dbhost, dbname, dbuid, dbpassword) {        
        this.insertId = 0;
        this.impacted = 0;
        this.recentResults;
        this.error;
        // var hpcrt = fs.readFileSync(__dirname + 'rootCA.crt');

        this.config = {
            host: dbhost,
            user: dbuid,
            password: dbpassword,
            database: dbname
        };
        if ( DEBUGsql ) {
            console.log(">>>> db info - startup: ", dbhost, dbname, dbuid, dbpassword);
        }

        try {
            this.connection = mysqlx.createConnection(this.config);
            this.connection.connect();
        } catch (e) {
            console.log(">>>> db connect error: ", e);
        }
        if ( DEBUGsql ) {
            console.log(">>>> db connection config: ", this.config);
        }
    }

    getId() {
        return this.insertId;
    }

    getImpacted() {
        return this.impacted;
    }

    getResults() {
        return this.recentResults;
    }

    getError() {
        return this.error;
    }

    die(msg) {
        this.error = msg;
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

        var keystring = "";
        var valstring = "";
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
    updateRow(usertable, values, conditions) {
        if ( !usertable ) {
            return this.die("No table specified in call to updateRow");
        }
        if ( !conditions ) {
            return this.die("Attempted to update row with no conditions set");
        }


        var that = this;
        var promise = new Promise( function(resolve, reject) { 

            that.getRow(usertable, "*", conditions)
            .then( function(result) {

                // handle errors from getRow
                if ( that.error ) {
                    if ( typeof reject === "function" ) {
                        reject(that.error);
                    }
                }

                // if row is there then update it and return the update promise
                if ( result ) {
                    if ( DEBUGsql ) {
                        console.log(">>>> updating row: ", result);
                    }
                    var str = buildUpdateStr();
                    resolve (that.query(str) );
                    // resolve( doUpdate(that) );

                // otherwise add a new row and return the add promise
                } else {
                    if ( DEBUGsql ) {
                        console.log(">>>> adding row: ", values);
                    }
                    resolve (that.addRow(usertable, values) );
                }
            });

        });

        return promise;

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
            return str; // that.query(str);
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

        return this.query(str);
    }
    
    // use a promise 
    // the rows will have table names in the columns if joined is provided
    // if you want the table name without a join, use a blank string as the join
    getRows(usertable, fields, conditions, joins, orderby, firstrow, callback) {
        this.error = null;
        if ( !usertable ) {
            return this.die("No table specified in call to getRows");
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

        var options = {sql: str};
        if ( joins ) {
            options.nestTables = "_";
        }
        var rowobjs;
        var that = this;

        // create a custom promise that mimicks how the X lib works
        var promise = new Promise(function(resolve, reject) {
            that.connection.query(options, function(err, result, columns) {
                
                if ( err ) {
                    that.error = err;
                    if ( typeof reject === "function" ) {
                        reject(err);
                    }
                } else {

                    if ( typeof result !== "object" ) {
                        rowobjs = null;
                    } else if ( firstrow===true ) {
                        rowobjs = result[0];
                    } else {
                        rowobjs = result;
                    }
                    if ( DEBUGrow ) {
                        console.log(">>>> rowobjs: ", rowobjs);
                    }
                    that.recentResults = rowobjs;
                    resolve(rowobjs);
                }

                if ( callback ) {
                    callback(rowobjs);
                }

            });
        });
        return promise;
    }

    getRow(usertable, fields, conditions, joins, orderby, callback) {
        if ( !usertable ) {
            return this.die("No table specified in call to getRow");
        }

        return this.getRows(usertable, fields, conditions, joins, orderby, true, callback);
    }

    // generic user-defined query
    query(str, callback) {
        this.error = null;
        var that = this;

        var promise = new Promise(function(resolve, reject) {

            that.connection.query(str, function(err, sqlresult, fields) {
                if ( err ) {
                    sqlresult = null;
                    that.error = err;
                    if ( typeof reject === "function" ) {
                        reject(err);
                    }
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
        });
        return promise;
    }

    catch(err) {

    }

}
