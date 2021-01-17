var mysqlx = require('mysql');
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
        // console.log(">>>> db info - startup: ", dbhost, dbname, dbuid, dbpassword);

        try {
            this.connection = mysqlx.createConnection(this.config);
            this.connection.connect();
        } catch (e) {
            console.log("db connect error: ", e);
        }
        // console.log(">>>> db info - config: ", this.config);
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
        console.log(">>>> sql error: ", msg);
    }

    warn(msg) {
        this.error = msg;
        console.log(">>>> sql warning: ", msg);
    }
    
    getJoinStr(usertable, idjoinfrom, jointable, idjointo, jtype) {
        if ( !usertable || !jointable ) {
            this.die("Two tables must specified in call to getJoinStr");
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
            this.die("No table specified in call to addRow");
            return null;
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
    updateRow(usertable, values, conditions, joins) {
        if ( !usertable ) {
            this.die("No table specified in call to updateRow");
            return null;
        }
        if ( !conditions ) {
            this.die("Attempted to update row with no conditions set");
            return null;
        }

        var updatestr = "";
        var keystring = "";
        var valstring = "";
        for (var fieldkey in values) {

            var fieldvalue = values[fieldkey];
            fieldkey = "`" + fieldkey.toString() + "`";
            fieldvalue = "'" + fieldvalue + "'";

            if ( updatestr==="" ) {
                updatestr = fieldkey + " = " + fieldvalue;
                keystring = fieldkey;
                valstring = fieldvalue;
            } else {
                updatestr += ", " + fieldkey + " = " + fieldvalue;
                keystring += ", " + fieldkey;
                valstring += ", " + fieldvalue;
            }
        }

        // update the fields requested
        var str = "UPDATE " + usertable;

        // add all of the joins provided do not remove the space in between
        if ( joins && typeof joins === "string" ) {
            str += " " + joins + " ";
        } else if ( joins && typeof joins === "object" && Array.isArray(joins)  ) {
            str += " " + joins.join(" ") + " ";
        }
        
        str += " SET " + updatestr + " ";

        if ( conditions ) {
            str += " WHERE " + conditions;
        }
        return this.query(str)
    }
    
    deleteRow(usertable, conditions, joins) {
        this.error = null;
        if ( !usertable ) {
            this.die("No table specified in call to updateRow");
            return null;
        }
        if ( !conditions ) {
            this.die("Attempted to delete row with no conditions set");
            return null;
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
            this.die("No table specified in call to getRows");
            return null;
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
                    // console.log(">>>> rowobjs: ", rowobjs);
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
