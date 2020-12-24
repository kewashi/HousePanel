
exports.sqlDatabase = class sqlDatabase {
    
    constructor(dbhost, dbname, dbuid, dbpassword) {        
        this.mysqlx = require('@mysql/xdevapi');
        this.insertId = 0;
        this.tablenames;
        this.session;
        this.recentResults = null;
        this.error;

        this.config = {
            host: dbhost,
            port: 33060,
            schema: dbname,
            user: dbuid,
            password: dbpassword
        };

        // save the table names for later use
        // this takes some time so you can't use it right away
        var that = this;
        this.getSession()
            .then(session => {
                // console.log( session.inspect() );
                return session.getSchema(dbname);
            })
            .then(schema => {
                return schema.getTables();
            })
            .then(tables => {
                that.tablenames = [];
                tables.forEach( function(atable) {
                    that.tablenames.push(atable.getName());
                });
                return tables;
            })
            .catch(results => {
                return [];
            });
    }

    async getSession() {
        if ( !this.session ) {
            var mysession = await this.mysqlx.getSession(this.config);
            this.session = mysession;
        }
        return this.session;
    }
    
    getId() {
        return this.insertId;
    }

    isTable(atable) {
        var isvalid = (this.tablenames.indexOf(atable) !== -1);
        return isvalid;
    }

    getResults() {
        return (this.error ? null : this.recentResults);
    }

    die(msg) {
        this.error = msg;
        console.log(">>>> sql error: ", msg);
    }

    warn(msg) {
        this.error = msg;
        // console.log(">>>> sql warning: ", msg);
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

    getTable(usertable) {
        this.error = null;
        var pr = this.getSession()
        .then(session => {
            var table = getSession().getTable(usertable);
            return table;
        })
        .catch(reason => {
            this.warn(reason);
            return null;
        });
        return pr;
    }
    
    addRow(usertable, values, skipsubmit) {
        this.error = null;
        if ( !usertable ) {
            this.die("No table specified in call to addRow");
            return null;
        }

        var keystring = "";
        var valstring = "";
        for (var fieldkey in values) {

            // build in skip for submit button as the default behavior
            // this allows a POST to be sent to this function directly
            if ( !skipsubmit || fieldkey.toLowerCase() !== "submit" ) {

                var fieldvalue = values[fieldkey];
                fieldkey= "`" + fieldkey.toString() + "`";
                fieldvalue ="'" + fieldvalue + "'";
    
                // skip this field if it is blank or set to null string
                if ( typeof fieldvalue !== "undefined" ) {
                    if ( keystring==="" ) {
                        keystring = fieldkey;
                        valstring = fieldvalue;
                    } else {
                        keystring += ", " + fieldkey;
                        valstring += ", " + fieldvalue;
                    }
                }
            }

        }
        var str = "INSERT INTO " + usertable + " ( " + keystring + ") VALUES ( " + valstring + " )";
        return this.query(str);
    }
    
    // this either updates or adds a new row to the table
    // it first tries to update. If it fails then conditions are ignored and an attempt to add values
    // will be made as a new row. This will only succeed if all required fields are provided
    updateRow(usertable, values, conditions) {
        this.error = null;
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
        var str = "UPDATE " + usertable + " SET " + updatestr + " WHERE " + conditions;
        var results = this.query(str)
        .then(qres => {

            // if failed, try adding a new row which will only work if all required fields are given
            if ( qres && qres.getAffectedItemsCount() === 0 ) {
                var str = "INSERT INTO " + usertable + " ( " + keystring + ") VALUES ( " + valstring + " )";
                return this.query(str);
            } else {
                return qres;
            }
        });
        return results;
    }
    
    deleteRow(usertable, conditions) {
        this.error = null;
        if ( !usertable ) {
            this.die("No table specified in call to updateRow");
            return null;
        }
        if ( !conditions ) {
            this.die("Attempted to delete row with no conditions set");
            return null;
        }
        if ( conditions === "ALL" || conditions === "all" ) {
            var str = "DELETE FROM " + usertable;
        } else {
            str = "DELETE FROM " + usertable + " WHERE " + conditions;
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

        // turns the results into a json object with the column names attached
        // if the query involved a join, the table names are prepended
        function makeobj(cols, row) {
            var rowobj = {};
            for (var i=0; i<cols.length; i++) {
                var colname = cols[i].getColumnLabel();
                if ( isjoined ) {
                    colname = cols[i].getTableLabel() + "_" + colname;
                }
                rowobj[colname] = row[i];
            }
            return rowobj;
        }
        
        var pr = this.getSession()
            .then(session => {
                return session.sql(str).execute()
                .then( result => {
                    var columns = result.getColumns();
                    if ( firstrow ) {
                        var rows = result.fetchOne();
                        var rowobjs = makeobj(columns, rows);
                    } else {
                        rows = result.fetchAll();
                        rowobjs = [];
                        rows.forEach(function(row) {
                            var obj = makeobj(columns, row);
                            rowobjs.push(obj);
                        });
                    }
                    this.recentResults = rowobjs;
                    if ( callback ) {
                        callback(rows);
                    }
                    return rowobjs;
                })
                .catch(reason => {
                    this.warn(reason);
                    return null;
                })
            });

        // return the promise
        return pr;
    }

    getRow(usertable, fields, conditions, joins, orderby, callback) {
        return this.getRows(usertable, fields, conditions, joins, orderby, true, callback);
    }

    getFields(usertable, callback) {
        this.error = null;
        if ( !usertable ) {
            this.die("No table specified in call to getFields");
            return null;
        }

        var keys;
        var str = "SELECT * FROM " + usertable + " LIMIT 1";
        var pr = this.getSession()
            .then(session => {
                return session.sql(str).execute()
                .then( result => {
                    keys = result.getColumns()
                    var cols = [];
                    if ( keys ) {
                        keys.forEach(function(acol) {
                            cols.push(acol.getColumnName());
                        });
                    }
                    if ( callback ) {
                        callback(cols);
                    }
                    return cols;
                });
            })
            .catch(reason => {
                this.warn(reason);
                return null;
            });
        return pr;
    }

    // generic user-defined query
    query(str, callback) {
        this.error = null;
        var pr = this.getSession()
            .then(session => {
                return session.sql(str).execute()
                .then( result => {
                    this.insertId = result.getAutoIncrementValue();
                    if ( callback ) {
                        callback(result);
                    }
                    return result;
                });
            })
            .catch(reason => {
                this.warn(reason);
                return null;
            });
        return pr;
    }

}
