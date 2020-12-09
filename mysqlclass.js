
class sqlDatabase {

    constructor(dbname, dbuid, dbpassword) {        
        this.dbname = dbname;
        this.errorcode = null;
        this.recentresult = null;
        this.mysql = require('mysql');

        
        // this.setWorkingTable(defaultTable);
        this.conn = this.mysql.createConnection({
            host: "localhost",
            database: dbname,
            user: dbuid,
            password: dbpassword
        });
        this.conn.connect();
    }

    getDatabase() {
        return this.mysql;
    }

    getConnection() {
        return this.conn;
    }
    

    isValid() {
        if ( this.conn ) return true;
        return false;
    }
    
    getError() {
        return this.errorcode;
    }

    die(msg) {
        console.log((ddbg()), "Database error: ", msg);
    }
    
    addRow(usertable, values, fields, skipsubmit) {
        if ( !this.conn ) die("addRow call attempted without an open DB connection.");
        if ( !usertable ) die("No table specified in call to addRow");

        this.errorcode = NULL;
        // if (usertable=="") usertable = this.usertable;

        if ( fields ) {
            insertarr =  array_combine(fields, values);
        } else {
            insertarr = values;
        }

        var keystring = "";
        var valstring = "";

        for (var fieldkey in insertarr) {

            // build in skip for submit button as the default behavior
            // this allows a POST to be sent to this function directly
            if ( !skipsubmit || fieldkey.toLowerCase() !== "submit" ) {

                var fieldvalue = insertarr[fieldkey];
                fieldkey= "`" + fieldkey.toString() + "`";
                if ( typeof fieldvalue === "stirng" ) {
                    fieldvalue ="'" + encodeURI(fieldvalue) +  "'";
                }
    
                // skip this field if it is blank or set to NULL string
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

        const sqlstr = "INSERT INTO usertable ( keystring ) VALUES ( valstring )";
        result = this.query(sqlstr);
        this.recentresult = result;

        return result;  
    }
    
    updateRow(usertable, values, conditions) {
        if ( !usertable ) die("No table specified in call to addRow");
        if ( !conditions ) die("Attempted to update row with no conditions set");

        this.errorcode = NULL;
        var insertarr = values;
        var updatestr = "";
        var csep = "";

        for (var fieldkey in insertarr) {

            var fieldvalue = insertarr[fieldkey];
            fieldkey = "`" + fieldkey.toString() + "`";
            fieldvalue = "'" + this.conn.escape(fieldvalue) + "'";
 
            updatestr += csep + fieldkey + " = " + fieldvalue;
            csep = ", ";

        }

        // make the update query
        var str = "UPDATE " + usertable + " SET " + updatestr + " WHERE " + conditions;
        var result = this.query(str);
        this.recentresult = result;

        return result;  
    }
    
    getRows(usertable, fields="", joins= "", conditions= "", orderby="", firstrow) {
        if ( !this.conn ) die("getRows call attempted without an open DB connection.");
        if ( !usertable ) die("No table specified in call to getRows");

        // if (usertable=="") usertable = this.usertable;
    
        // can pass a string or an array to pick which fields to read from the table
        if ( is_string(fields) ) {
            if (fields=="") fields = "*";
            keystring = fields;
        } else if ( is_array(fields) && count(fields) ) {
            keystring = implode(",",fields);
        } else {
            keystring = "*";
        }

        var str = "SELECT " + keystring + " FROM " + usertable;

        // add all of the joins provided do not remove the space in between
        if ( joins ) {
            if ( is_array(joins) ) {
                joinstr = explode(" ",joins);
                str += " " + joinstr + " ";
                // foreach (joins as joinstr) {
                //     mysql .= " " + joinstr + " ";
                // }
            } else {
                str += " " + joins + " ";
            }
        }
        
        // add on the optional conditions
        if (conditions)  { str += " WHERE " + conditions; }

        // add on ordering if provided
        if (orderby) { str += " ORDER BY " + orderby; }
        
        // build the array of results
        result = this.query(str);

        if ( result ) {
            var showarr = [];
            while ( row = this.conn.fetchArray(result) ) {

                // help speed up getRow function with this patch            
                if (firstrow) return row;
            
                if (array_key_exists("Id",row)) {
                    index = row["Id"];
                    showarr[index] = row;
                    // showarr[] = row;
                } else {
                    showarr.push(row);
                }
            }
        }
        return showarr;
    }


    getRow(usertable, fields="", joins= "", conditions= "", orderby="") {
        row = this.getRows(usertable, fields, joins, conditions, orderby, true);
        return row;
    }

    getFields(usertable, userecent= false) {
        if ( !this.conn ) die("getFields call attempted without an open DB connection");
        if ( !usertable ) die("No table specified in call to getFields");
        // if (usertable=="") usertable = this.usertable;

        var result = this.query("SELECT * FROM usertable");

        var keys = [];
        var i = 0;
        numfields = mysql_num_fields(result);
        while (i < numfields) {
            var submeta = mysql_fetch_field(result, i);
            keys.push(submeta.name);
            i++;
        }
        return keys;
    }

    // get values of a specific column and return as an array
    getColumn(usertable, col, joins, conditions) {
        this.errorcode = NULL;
        if (usertable=="") usertable = this.usertable;
        if ( !usertable ) die("No table specified in call to addRow");

        var str = "SELECT col FROM usertable";

        // add all of the joins provided do not remove the space in between
        if ( joins ) {
            if ( is_array(joins) ) {
                for (j in joins) {
                    var joinstr = joins[j];
                    str += " " + joinstr + " ";
                }
            } else {
                str += " " + joins + " ";
            }
        }
        
        // add on the optional conditions
        if (conditions) { str += " WHERE " + conditions; }

        result = this.query(str, (joins!==null));

        if ( !result ) {
            showarr = false;
        } else {
            showarr = array();
            while ( row = this.fetchArray(result) ) {
                // id = row["id"];
                // showarr[id] = row[col];
                showarr.push (row[col]);
            }
        }
        return showarr;
    }

    // get maximum ID field
    // Max function does not work reliably for some reason
    getMaxid(usertable, idcol="Id") {
        this.errorcode = NULL;
        if ( !usertable ) die("No table specified in call to getMaxid");
        // if (usertable=="") usertable = this.usertable;

        // if (this._dbtype=="mysql" ) {
        //     mysql = "SELECT MAX(idcol) FROM usertable";
        //     result = this.query(mysql);
        //     return result;
        // }

        mysql = "SELECT idcol FROM usertable";
        result = this.query(mysql);

        if ( !result ) {
            maxid = 0;
        } else {
            maxid = -999999;
            while ( row = this.fetchArray(result) ) {
                nextid = row[idcol];
                if (nextid > maxid) maxid = nextid;
            }
        }
        return maxid;
    }

    // generic user-defined query
    async query(str, nested) {
        if ( this.conn ) {
            var options = {sql: str, nestTables: nested};
            await this.conn.query(options, function(err, results, fields) {
                console.log( results );
                this.recentresult = results;
            });
        }
        return result;
    }
    
    getJoinStr(usertable, idjoinfrom, jointable, idjointo, jtype) {
        if ( !usertable ) die("No table specified in call to getJoinStr");
        var jstr1 = usertable + "." + idjoinfrom;
        var jstr2 = jointable + "." + idjointo;
        if ( !jtype ) {
            jtype = "INNER";
        }
        var jstr = " " + jtype + " JOIN " + jointable + " ON " + jstr1 + " = " + jstr2;
        return jstr;
    }

    closeConnection() {
        this.conn.close();
    }
       
}
