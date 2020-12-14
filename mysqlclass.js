
exports.sqlDatabase = class sqlDatabase {
    
    constructor(dbhost, dbname, dbuid, dbpassword) {        
        this.mysqlx = require('@mysql/xdevapi');
        this.dbname = dbname;
        this.errorcode = null;
        this.recentresult = null;
        this.insertId = 0;
        this.tables;
        this.session;

        this.config = {
            host: dbhost,
            port: 33060,
            schema: dbname,
            user: dbuid,
            password: dbpassword
        };

        // this.session = this.getSession();
        this.getSession()
            .then(session => {
                // console.log( session.inspect() );
                return session.getSchema(dbname);
            })
            .then(schema => {
                return schema.getTables();
            })
            .then(tables => {
                this.tables = tables;
                // tables.forEach( function(atable) {
                //     console.log( "Table: ", atable.getName() );
                // });
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

    die(msg) {
        console.log(">>>> sql error: ", msg);
    }
    
    getJoinStr(usertable, idjoinfrom, jointable, idjointo, jtype) {
        if ( !usertable || !jointable ) {
            this.die("Two tables must specified in call to getJoinStr");
            return false;
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
        var pr = this.getSession()
        .then(session => {
            var table = getSession().getTable(usertable);
            return table;
        });
        return pr;
    }
    
    addRow(usertable, values, skipsubmit) {
        if ( !usertable ) {
            this.die("No table specified in call to addRow");
            return false;
        }

        var keystring = "";
        var valstring = "";

        for (var fieldkey in values) {

            // build in skip for submit button as the default behavior
            // this allows a POST to be sent to this function directly
            if ( !skipsubmit || fieldkey.toLowerCase() !== "submit" ) {

                var fieldvalue = values[fieldkey];
                fieldkey= "`" + fieldkey + "`";
                // fieldvalue ="'" + encodeURI(fieldvalue) + "'";
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
    
    updateRow(usertable, values, conditions) {
        if ( !usertable ) {
            this.die("No table specified in call to updateRow");
            return false;
        }
        if ( !conditions ) {
            this.die("Attempted to update row with no conditions set");
            return false;
        }

        var updatestr = "";
        for (var fieldkey in values) {

            var fieldvalue = values[fieldkey];
            fieldkey = "`" + fieldkey.toString() + "`";
            fieldvalue = "'" + encodeURI(fieldvalue) + "'";

            if ( updatestr==="" ) {
                updatestr += fieldkey + " = " + fieldvalue;
            } else {
                updatestr += ", " + fieldkey + " = " + fieldvalue;
            }

        }
        var str = "UPDATE " + usertable + " SET " + updatestr + " WHERE " + conditions;
        return this.query(str);
    }
    
    deleteRow(usertable, conditions) {
        if ( !usertable ) {
            this.die("No table specified in call to updateRow");
            return false;
        }
        if ( !conditions ) {
            this.die("Attempted to delete row with no conditions set");
            return false;
        }
        var str = "DELETE FROM " + usertable + " WHERE " + conditions;
        return this.query(str);
    }
    
    // use a promise 
    getRows(usertable, fields, conditions, joins, orderby, firstrow, callback) {
        if ( !usertable ) {
            this.die("No table specified in call to getRows");
            return false;
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
        if ( joins && typeof joins === "string" ) {
            str += " " + joins + " ";
        } else if ( joins && typeof joins === "object" && Array.isArray(joins)  ) {
            str += " " + joins.join(" ") + " ";
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
        
        // console.log(">>>> query str: ", str);
        var pr = this.getSession()
            .then(session => {
                return session.sql(str).execute()
                .then( result => {
                    // console.log(">>>> query results: ", items );
                    if ( firstrow ) {
                        var rows = result.fetchOne();
                    } else {
                        rows = result.fetchAll();
                    }
                    // console.log(">>>> query results: ", rows );

                    if ( callback ) {
                        callback(rows);
                    }
                    return rows;
                })
                .catch( result => {
                    return null;
                })
            });

        // return the promise
        return pr;

    }

    getRow(usertable, fields, conditions, joins, orderby, callback) {
        return this.getRows(usertable, fields, conditions, joins, orderby, true, callback);
    }

    getFields(usertable) {
        if ( !usertable ) {
            this.die("No table specified in call to getFields");
            return;
        }

        var keys;
        var str = "SELECT * FROM " + usertable + " LIMIT 1";
        var pr = this.getSession()
            .then(session => {
                return session.sql(str).execute()
                .then( result => {
                    keys = result.getColumns()
                    var cols = [];
                    keys.forEach(function(acol) {
                        cols.push(acol.getColumnName());
                    });
                    return cols;
                });
            });
        return pr;
    }

    // generic user-defined query
    query(str, callback) {
        var pr = this.getSession()
            .then(session => {
                return session.sql(str).execute()
                .then( result => {
                    // console.log(">>>> query results: ", items );
                    this.affectedCount = result.getAffectedItemsCount();
                    this.insertId = result.getAutoIncrementValue();
                    if ( callback ) {
                        callback(result);
                    }
                    return result;
                });
            });
        return pr;
    }

}
