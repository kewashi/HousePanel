
class sqlDatabase {

    constructor(dbname, dbuid, dbpassword) {        
        this.dbname = dbname;
        this.errorcode = null;
        this.recentresult = null;
        this.mydb = mysql(dbname);
        
        // this.setWorkingTable(defaultTable);
        this.conn = this.mydb.createConnection({
            host: "localhost",
            database: dbname,
            user: dbuid,
            password: dbpassword
        });
        this.conn.connect();
    }

    getDatabase() {
        return this.mydb;
    }
    

    isValid() {
        if ( this.conn ) return true;
        return false;
    }
    
    getError() {
        return this.errorcode;
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
        keystring = valstring = csep = "";

        foreach (insertarr as fieldkey => fieldvalue) {

            // build in skip for submit button as the default behavior
            // this allows a POST to be sent to this function directly
            if ( skipsubmit && fieldkey.toLowerCase() === "submit" ) continue;

            // settype(fieldvalue,"string");
            settype(fieldkey,"string");

            fieldkey = "`" + fieldkey + "`";
            if (is_string(fieldvalue) ) {
                fieldvalue = addslashes(fieldvalue);
                fieldvalue = "'" + fieldvalue + "'";
            }
 
            // skip this field if it is blank or set to NULL string
            if ( fieldvalue !== "NULL") {
                keystring = keystring + csep + fieldkey;
                valstring = valstring + csep + fieldvalue;
                csep = ", ";
            }

        }

        mysql = "INSERT INTO usertable ( keystring ) VALUES ( valstring )";
        result = this.query(mysql);
        this.recentresult = result;

        return result;  
    }
    
    updateRow(usertable, values, conditions) {
        if ( !this.conn ) die("addRow call attempted without an open DB connection.");
        if ( !usertable ) die("No table specified in call to addRow");
        if ( !conditions ) die("Attempted to update row with no conditions set");

        this.errorcode = NULL;
        // if (usertable=="") usertable = this.usertable;

        insertarr = values;
        updatestr = "";
        csep = "";

        foreach (insertarr as fieldkey => fieldvalue) {

            // settype(fieldvalue,"string");
            settype(fieldkey,"string");

            switch (this._dbtype) {
                case "sqlsrv":
                    if (is_string(fieldvalue) ) {
                        fieldvalue = str_replace(array("'","\""),"`",fieldvalue);
                    }
                    fieldvalue = "'" + fieldvalue + "'";
                    break;

                case "mysql":
                    fieldkey = "`" + fieldkey + "`";
                    if (is_string(fieldvalue) ) {
                        fieldvalue = addslashes(fieldvalue);
                        fieldvalue = "'" + fieldvalue + "'";
                    }
                    break;
            }
 
            // skip this field if it is blank or set to NULL string
            if ( fieldvalue !== false || fieldvalue !== "NULL") {
                updatestr .= csep + fieldkey + " = " + fieldvalue;
                csep = ", ";
            }

        }

        // make the update query
        result = NULL;
        
        mysql = "UPDATE usertable SET updatestr WHERE conditions";
        // throw new Exception("SQL = mysql");
        result = this.query(mysql);
        this.recentresult = result;

        return result;  
    }
    
    getRows(usertable, fields="", joins= "", conditions= "", orderby="", firstrow=false) {
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

        mysql = "SELECT keystring FROM usertable ";

        // add all of the joins provided do not remove the space in between
        if ( joins ) {
            if ( is_array(joins) ) {
                joinstr = explode(" ",joins);
                mysql .= " " + joinstr + " ";
                // foreach (joins as joinstr) {
                //     mysql .= " " + joinstr + " ";
                // }
            } else {
                mysql .= " " + joins + " ";
            }
        }
        
        // mysql = mysql + " " + joins + " ";
        // print_r(mysql);
        // echo br(2);
        // print_r(joins);

        // add on the optional conditions
        if (conditions) mysql .= " WHERE conditions";       

        // add on ordering if provided
        if (orderby) mysql .= " ORDER BY orderby ";
        
        // build the array of results
        result = this.query(mysql);

        showarr = NULL;
        if ( result ) {
            if (!firstrow) showarr = array();
            while ( row = this.fetchArray(result) ) {

                // help speed up getRow function with this patch            
                if (firstrow) return row;
            
                if (array_key_exists("Id",row)) {
                    index = row["Id"];
                    showarr[index] = row;
                    // showarr[] = row;
                } else {
                    showarr[] = row;
                }
            }
        }
        return showarr;
    }

    getUniqueRows(usertable, fields="", joins= "", conditions= "", orderby="") {
        if ( !this.conn ) die("getRows call attempted without an open DB connection.");
        if ( !usertable ) die("No table specified in call to getUniqueRows");

        // if (usertable=="") usertable = this.usertable;
        if (fields=="") fields = "*";
    
        // can pass a string or an array to pick which fields to read from the table
        // if we pass an array then the unique field equals the first item if it is Id, or sort field
        // otherwise the sort field is the first field which should be Id
        if ( is_string(fields) ) {
            keystring = fields;
            if (substr(fields,0,3)=="Id,") {
                sortby = "Id";
            } else {
                sortby = orderby;
            }
        } else if (is_array(fields) && count(fields) ) {
            sortby = fields[0];
            keystring = implode(",",fields);
            // keystring = "";
            // csep = "";
            // foreach (fields as field) {
            //     keystring .= csep + field;
            //     csep = ", ";
            // }
        } else {
            keystring = "*";
        }

        mysql = "SELECT keystring FROM usertable";

        // add all of the joins provided do not remove the space in between
        if ( joins ) {
            if ( is_array(joins) ) {
                joinstr = explode(" ",joins);
                mysql .= " " + joinstr + " ";
                // foreach (joins as joinstr) {
                //     mysql .= " " + joinstr + " ";
                // }
            } else {
                mysql .= " " + joins + " ";
            }
        }
        
        // mysql = mysql + " " + joins + " ";
        // print_r(mysql);
        // echo br(2);
        // print_r(joins);

        // add on the optional conditions
        if (conditions) mysql .= " WHERE conditions";       

        // add on ordering if provided
        // orderby has special meaning in this unique function - it is the field to not duplicate
        // we instead sort by the first field given
        if (sortby) mysql .= " ORDER BY sortby ";
        
        // build the array of results
        result = this.query(mysql);

        if ( !result ) {
            showarr = NULL;
        } else {
            showarr = array();
            while ( row = this.fetchArray(result) ) {

                existing = false;
                foreach (showarr as val) {
                    if (val[orderby] == row[orderby]) {
                        existing = true;
                        break;
                    }
                }

                if (array_key_exists("Id",row)) {
                    index = row["Id"];
                    if (!existing)
                        showarr[index] = row;
                } else {
                    if ( !existing )
                        showarr[] = row;
                }
            }
        }
        return showarr;
    }

    fetchArray(result) {
        
        row = NULL;
        switch (this._dbtype) {
        
            case "sqlsrv":
                row = sqlsrv_fetch_array(result, SQLSRV_FETCH_ASSOC);
                break;
                
            case "mysql":
                row = mysql_fetch_assoc(result);
                break;
        }
        
        return row;
    }

    getRow(usertable, fields="", joins= "", conditions= "", orderby="") {
        
        row = this.getRows(usertable, fields, joins, conditions, orderby, true);
        /*
        rows = this.getRows(usertable, fields, joins, conditions, orderby);

        row = false;
        if (rows) {
            keys = array_keys(rows);
            idfirst = keys[0];
            row = rows[idfirst];
        }
        */
        
        return row;
        
    }

    getFields(usertable, userecent= false) {
        if ( !this.conn ) die("getFields call attempted without an open DB connection");
        if ( !usertable ) die("No table specified in call to getFields");
        // if (usertable=="") usertable = this.usertable;

        result = this.recentresult;
        if ( ! result or ! userecent) {
            result = this.query("SELECT * FROM usertable");
            this.recentresult = result;
        }

        keys = array();
        switch (this._dbtype) {
        
            case "sqlsrv":
                metakeys = sqlsrv_field_metadata(result);
                foreach ( metakeys as submeta ) {
                    keys[] = submeta['Name'];
                }
                break;
                
            case "mysql":
                i = 0;
                numfields = mysql_num_fields(result);
                while (i < numfields) {
                    submeta = mysql_fetch_field(result, i);
                    keys[] = submeta->name;
                    i++;
                }
                break;
        }
               
        this.free(result);
        return keys;
    }

    // get values of a specific column and return as an array
    getColumn(usertable, col, joins= "", conditions= "") {
        this.errorcode = NULL;
        if (usertable=="") usertable = this.usertable;
        if ( !usertable ) die("No table specified in call to addRow");

        mysql = "SELECT col FROM usertable";

        // add all of the joins provided do not remove the space in between
        if ( joins ) {
            if ( is_array(joins) ) {
                joinstr = explode(" ",joins);
                mysql .= " " + joinstr + " ";
                // foreach (joins as joinstr) {
                //     mysql .= " " + joinstr + " ";
                // }
            } else {
                mysql .= " " + joins + " ";
            }
        }
        
        // add on the optional conditions
        if (conditions) mysql .= " WHERE conditions";       

        result = this.query(mysql);

        if ( !result ) {
            showarr = false;
        } else {
            showarr = array();
            while ( row = this.fetchArray(result) ) {
                // id = row["id"];
                // showarr[id] = row[col];
                showarr[] = row[col];
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
    query(mysql) {
        var = NULL;
        if ( this.conn ) {
            result = mysql_query(mysql, this.conn);
            this.recentresult = result;
        }
        return result;
    }
    
    getJoinStr(usertable, idjoinfrom, jointable, idjointo, jtype = "INNER") {
        if ( !usertable ) die("No table specified in call to getJoinStr");
        // if (usertable=="") usertable = this.usertable;
        jstr1 = usertable + "." + idjoinfrom;
        jstr2 = jointable + "." + idjointo;
        jstr = " jtype JOIN jointable ON jstr1 = jstr2 ";
        return jstr;
    }

    closeConnection() {
        this.mydb.close(this.conn);
    }
    
    free(resource) {
        this.recentresult = NULL;
        this.errorcode = NULL;
        if ( !this.conn || !resource ) return;
         mysql_free_result(resource);
    }
       
}
