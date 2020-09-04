'use strict';

const devhistory =  ` 
2.326   Fix program update bug to handle hex and other status items
2.325   Minor bugfix to linked volume sliders to display properly
2.324   Tweak level slider display for ISY hubs and clean up status clicks
2.323   Fix linked variables and programs to update properly in both directions
2.322   Use correct variable ID from ISY hub for variable tile
            - add await for xml conversions to increase robustness
            - remove usage of fast parser and use xml2js everywhere
2.321   Error check in tileedit and when reading var precision values
2.320   Add window shade icons and fix tile editor to handle spaces in attributes
2.319   Simulated websocket for rules for non responsive ISY nodes like buttons
2.318   New rule feature to allow use of existing field values for if check
            - so "if switch=@tilenum$switch, ..." to check against tilenum state
            - add program websocket to update last run fields
2.317   Add ::before and ::after features to Tile Editor
            - Image file to support http name for remote file links
            - Determine all modes supported
2.316   Fix thermostat bug for showing Temperature in ST field instead of on/off
2.315   Add slider for onlevel to control optionally separate from level
            - add customization info to the info page
2.314   Add support for ISY scenes
            - Options bugfix for weather region specification
2.313   Fix bug in rule width and height adjust
2.312   Wire up option to disable blackout on mode change properly
            - add error checking in json read of user cfg file
2.311   Audio tile tweaks for rule engine
            - fix weather tile upon refresh
            - add missing CSS for OFFLINE tile to red; change inactive to orange
2.310   Add a status field that is styled with little dots
2.309   Tile editor bugfix for tiles with spaces in names
            - fix width and height for images in music/audio tiles
            - return refresh command and read commands for devices
2.306   Add ability to click on visual fields in Tile Customizer
            - include level logic for actuators for window shades
            - fix bug to now include actuators in event handler logic
            - add closing and opening garage icons and fix logic in editor
2.305   Bugfix for "other" types in groovy file that used wrong attr variable
2.304   Rule engine bugfix for tests that contain special chars like time (9:00)
            - fix Accuweather refresh for forecast tables
2.303   bugfix for buttons and rules and anythign else returning array values
2.302   Add trigger for clock every minute so time can be a trigger
2.301   Rules bugfix to address spaces when writing logic statements
            - trigger rule for weather and clock tiles upon timer read
            - add Tile # on options page and inside blue circles when editing
            - support date and time in rule logic
            - auto blackout page when entering night mode
2.300   Update order of items in a tile
            - fix bug in setting cookie so it sustains over sessions
            - weather tile bugfix on updates
            - clean up excess debug console statements
            - bugfix mode updates
            - support climacell tiles in default skin
2.280   Fix momentary buttons and mode handler in groovy file for ST and HE
            - update music and audio image art handling to be more robust
            - clean up gear icon for editing
            - rule engine bugfix for attribute results pushed into subid
            - error checking for rule driven hub calls and clean up ISY calls
            - stability fixes 
2.279   Bugfix for icons in tile editor not showing up
2.278   Urgent bugfix that caused wrong and duplicate tile numbers for new things
2.277   Remove dynamic pages in groovy file that messes up OAUTH from HP side
2.276   Serious bugfix for new users doing OAUTH flow
2.275   Fix brain fart bug that only impacted new users - thanks again @ross1
            - obscure bug fix for push client calls for linked fields
2.274   Fix new user bug in readRoomThings function - thanks @ross1
2.273   Added buttons and actuators
            - upgrades to the RULE engine to handle timer overlaps and buttons
2.272   Login convenience features - return key and error checking
            - update tile editor to allow multiple tile options
            - upgrade rules to properly make TEXT fields when needed
            - bug fixes as usual
2.271   Bug fixes to the last update - minor but important if using customizer
            - restored the donate option since I am staying in hobby mode
2.270   Rewrote login and username module to work as designed in old PHP version
            - with this upgrade user logins have their own config setup
            - this also implements encrypted cookies for more security
            - fixed color light bug for user in ST (thanks)
            - Accuweather tile icon fix
2.260   Fix long-standing bug for user login issues (didn't work)
            - add support for album art for legacy music tiles used by Hubitat
            - finally... fix color updates from hub refreshes to work properly
            - harden logic for hidden tiles in the editor
            - usual array of miscellaneous bug fixes
            - update groovy file to procee hub updates more reliably
2.255   Important GUI editor upgrade supporting sorted and free form tiles
            - reorder now will only reorder those tiles not moved
            - and moved tiles will keep their absolute location now
            - many other bug fixes - better websocket calls
            - limit power tile updates from dominating the network
            - fix bug that now puts all color panels on top
            - clean up previously messed up custom tile name logic
            - add page specific formatting in the tile editor
2.254   Allow rules to create and update custom TEXT fields
            - improved the way audio tiles update
            - added ability to put reference other values in rules
2.253   Fix password bug and remove processLinks since rules are better
            - add option to subscribe and listen to polyglot MQTT events
2.252   Added special custom fields "allon" and "alloff"
            - this turns all lights on or off on any given page
2.251   Fixed frame cap bug by renaming frame#.html to Frame#.html
            - added ability to create Frame1.html file is code is known
2.250   Cleaned up handling of names and headers to hide headers by default
            - headers now will always contain the original tile name from hub
            - modified names in the GUI will only show in the tile name field
            - because of this change, some old skins will need updating
            - fixed color controls to always be on top
            - removed old pre-Node history from this list
2.243   Continued cleanup and bug fixes
            - change music icon to enable size changes in tile editor
            - included flag to completely neuter RULE engine for ISY
            - add "aid" to master and sibling tags to facilitate easier manipulation
            - fix tile width and height changes bug in tile editor
            - enhance clock time and date formatting and fix custom handling
            - tidy up extra tag to exclude command:: items
            - add a getclock api call and use it to update clock from js
            - improved logic for clicking on passive items that do nothing
2.242   Fix bug that prevented variable arrows from working
2.241   Hub reauth push happens everywhere now and other bug fixes
            - added flag to neuter all RULES capabilities
            - rtsp and other JSON object support returned from hubs
            - more bug fixes and tweaks
2.230   POST action fix and other bug fixes
            - redesigned customcss save architecture to be more robust
            - fix tile editor to properly deal with header edits
            - bug fix in Mode changes implemented in 2.229 for ST and HE
            - visual changes to default housepanel skin for thermostats
2.229   Fixed a few really nasty bugs impacting ST and HE hubs
            - equally gnarly bug fixed for ISY hub reading
            - fixed ISY thermostat editing features
            - more code cleanup in prep for pro transition
2.228   Added sorting capabilities:
            - sort catalog listing and add scroll bars
            - sort options and show info pages by hub, name, and type
2.227   Fix long-standing bug where new tiles had dup id's and got mixed
            - clean up hub treatment and fix bugs
2.226   New ISY features and bug fixes
            - suppoprt for ISY programs and state variables
            - fix readOptions to not read in so often
            - support rules acting upon variable values from ISY
            - only reload page of screen that is calling reload
            - numerous bug fixes
2.225   Added both Int and State variable support
2.224   Clean and speed up rules, add timer delay to rule syntax
2.223   Fix bug in sorting user custom fields and change slider skin setting
2.222   Found login bug and squashed it
2.221   Ported over and improved powerful RULE engine feature
            - change how links work to be faster and more robust
            - remove button to remove hub since it doesn't work yet
2.220   Fix startup bug so new hubs now work - and give up on npm installs
2.216   Clean up when options file is read and sync npm version number
2.215   Fix video embedded, provide arlo4.py, and enable ISY toggle for RULEs and api calls
2.214   Enable moved tiles to always show on top of all others
2.213   Relax login constraints to by default log everyone in
2.212   Fix auth bug to properly set hubId and cleanup debug statements
2.211   First public beta release
2.210   Enable thermostat operation for ISY hub and more bug fixes
2.206   Fix slider render bug and improve ISY status query
2.205   Fix tile editor bug that now enables multi tiles
2.204   Fix order of options table processing
2.203   Added OAUTH flow and hub data entry screen
2.202   Rules and Links implemented and numerous bug fixes - getting close...
2.201   First nearly fully functional Node.js version
2.200   Initial Node.js version release
`;

const oldhistory = `
2.118      Fix bug that prevented user from changing custom tile count
2.117      Load jquery locally and include files in the distro
2.116      Tweaks to enable floor plan skins and bug fixes
2.115      Finalize audio track refresh feature and remove bugs
             - handle music tiles properly and remove test bug
2.114      Allow track to update on hub refresh for audio devices
             - updated modern skin to work with new Sonos DH
2.113      Remove bogus line in groovy code
2.112      Added audioNotification capability for new Sonos DH (draft)
             - fixed up login again and added feature to disable pws
2.111      Minor bugfixes to 2.110 hub auth separation
2.110      Major rewrite of auth flow to move options to options page
             - username and password are now on the options page
             - bug fixes in timer refresh logic
             - bug fix to tile width to include slider for bulbs and switches
             - add hub filter to options and tile catalog drag pages
2.109      Add options parameter to enable or disable rules since it can be slow
2.108      Modify Rule to enable multiple actions and require 'if: ' to flag if
2.107      New Rule feature that allows non-visual triggers to be added to any tile
2.106      Macro feature tested and fine tuned to return results in console log
             - tile editor name update fixed to prevent spurious page reloads
             - returns name on switches now for viewing with API; GUI still ignores
             - protect from returning password and name in the GUI everywhere
2.105      Minor bugfix for leak sensors that dont support wet & dry commands
2.104      Bug Fixes and API improvements
             - enable auto search for correct hub if omitted in API calls
             - fix spurious hub creation when reauthorization performed
             - enable blink properly when waiting for authorization
             - fix tile editor list and tile customizer for weather tiles
2.103      link tile query fix and media art fine tune
             - add default icons for water sensors and enable water actions
2.100      User specific skin support
             - add custom tiles to user account
             - now save user account files in true json format
             - fix query to linked items
             - improve album art search and support tunein items
2.092      Major update to documentation on housepanel.net
             - tweak info window when inspected near right edge
             - enable album art upon first change in song
2.091      Fix LINK for custom tile actions; bugfix album art for grouped speakers
2.090      Add curl call to gather usage statistics on central server
2.087      Minor formatting cleanup in show info routine
2.086      Update install script to support user skins and updates easily
            - remove hubtype from main array to save load time as it wasn't used
2.085      Clean up handling of custom names
2.084      Bugfix auth code to handle PHP installs without builtin functions
            - change minimum username length to 3 and look for admin name
            - drag drop name fix
2.083      Properly load things and options for use in GUI and other bug fixes
2.082      Fixed snarky bug in auth that reset hubpush ports and other things
            - did more cleanup and robusting of auth flow
2.081      Security lock down - no longer accept blanks to make new bogus user
            - reauth request via api if not logged in will return to login page
            - default user name not set to admin rather set to blank now
            - reauth page still available if options file is missing
            - reset code will also launch to auth page all the time if enabled
2.080      Remove blank customtile.css files to avoid overwriting user version
            - LINK customizer bugfix
            - minor bug fix of weather tile name
            - custom field image default CSS fix, misc code cleanup
            - show status when click on tiles that typically have no actions
            - speed up initial load after refresh page
2.078      Bugfixes to 2.076 and 2.077 - skin missing from tileeditor
            - fix long standing bug of duplicate Node.js clients
            - properly close sockets upon disconnect and remove dups
2.077      Remove http requirement for URL entries to enable intent links
2.076      Various password updates and fixes
            - add password support for tiles using the custom field feature
            - change main password from simple hash to strong algorithm
            - fix bug in the action buttons and links in clock tiles
            - remove reserved fields from hub push results
            - enabled return and cancel keys in popup dialog boxes
2.075      js Time bugfixes
            - finish implementing the sorting feature for user fields
            - speedup by avoiding reading options on each tile make
2.073      Major speedup in Tile Customizer (customize.js)
            - prep work for sorting feature - not yet implemented
            - minor bug fixes
2.072      Honor time format in js updates every second
            - merge in README clean up pull request
            - enable multiple things in a query request
            - minor bugfix for auto of non-groovy tiles
            - update hpapi.py demo to work with current version
2.071      Bypass cache for updated frames and other special tiles
            - minor bug fix to tile editor for tile name setting
            - fix bug where special tile count was not being saved
            - fix bug that screwed up max number of custom tiles
            - fix bug for page changes not sticking
2.070      Bugfixes to beta 2.065, code cleanup, ignore DeviceWatch-Enroll
            - includes error checking for bogus hub calls
            - also fixed hidden check in tile editor for fields that match type
            - handled obscure cases for refreshing special tiles properly
2.065      Migrate image and blank tiles over to php server side
            - provide user way to select city in AccuWeather
            - but user must find the Location Code first
2.064      Fix music control siblings and improve Album Art reliability
2.063      Implement music icons for native Echo Speaks and Generic music
2.062      Retain edit and custom names upon refresh; minor bug fixes
2.061      Custom frame and video tile name bugfix
2.060      Auto detect and grab artist, album title, and album art image
2.057      Minor cleanup including proper detection of hidden status in editor
2.056      Groovy file update only to specify event date format
2.055      Update version number in Groovy file and more error checking
2.054      Clean up groovy file; add direct mode action buttons
2.053      Misc bug fixes: LINK on/off; tile editor tweaks
           - new feature in Tile Editor to pick inline/blcok & absolute/relative
2.052      Really fixed clobber this time (in hubpush). Added portrait CSS support
2.051      Another run at fixing name clobber; update modern skin for flash
2.050      Fix cloberred custom names; fix Hubitat event reporting; add timezone
2.049      Time zone fix for real time javascript digital clock
           - add version number to main screen
2.048      Visual cue for clicking on any tile for 3/4 of a second
2.047      Clean up SHM and HSM to deliver similar display fields and bug fixes
2.046      Avoid fatal error if prefix not given, fix Routine bug in groovy, etc
2.045      Merge groovy files into one with conditional hub detector
2.042      Minor tweak to CSS default for showing history only on some things
           - add dev history to show info and auto create version info from this
           - add on and off toggle icons from modern to the default skin
           - doc images update
2.040      Four event fields added to most tiles for reporting (ST only for now)
2.031      Use custom name for head title and name field
2.030      Fix HSM and SHM bugs and piston styling for modern skin
2.020      Macro rule graduate from beta to tested feature - still no gui
2.010      Grid snap feature and fix catalog for modern skin
2.000      Release of rule feature as non beta. Fixed level and other tweaks
1.998      Macro rules implemented as beta feature. No easy GUI provided yet
1.997      Improve crude rule feature to only do push from last client
           minor performance and aesthetic improvements in push Node code
1.996      Fix hubId bug in push file
           implement crude rule capability triggered by custom tile use
           - if a motion sensor is added to a light it will trigger it on
           - if a contact is added to a light, open will turn on, close off
           - if another switch is added to a light, it will trigger it too
1.995      Update install script to properly implement push service setup
           remove .service file because install script makes this
           clean up hubid usage to use the real id for each hub consistently
           refresh screen automatically after user reorders tiles
1.992      Bugfix for swapping skins to enable new skin's customtiles
           this also changes the custom tiles comments to avoid dups
           minor tweaks to the modern skin and controller look
1.991      New modern skin and include door in classes from tile names
1.990      Final cleanup before public release of hubpush bugfixes
           move housepanel-push to subfolder beneath main files
           update housepanel-push to include more robust error checking
           Fixed bug in housepanel-push service causing it to crash
           Corrected and cleaned up install.sh script to work with hubpush
1.989      Continued bug fixing hubpush and auth flow stuff
1.988      Major bugfix to auth flow for new users without a cfg file
1.987      Bugfix for broken hubpush after implementing hubId indexing
           publish updated housepanel-push.js Node.js program
1.986      Minor fix to use proper hub name and type in info tables
1.985      Finish implementing hub removal feature
           - added messages to inform user during long hub processes in auth
           - position delete confirm box near the tile
           - minor bug fixes
1.983      2019-02-14
             bugfix in auth page where default hub was messed up
1.982      2019-02-14
             change hubnum to use hubId so we can remove hubs without damage
1.981      Upgrade to install.sh script and enable hub removal
1.980      Update tiles using direct push from hub using Node.js middleman
1.972      Add ability to tailor fast polling to include any tile
           by adding a refresh user field with name fast, slow, or never
           - also added built-in second refresh for clock tiles
           - two new floor lamp icons added to main skin
           - fix bug so that hidden items in editor now indicate hidden initially
1.971      Fix clicking on linked tiles so it updates the linked to tile
           - also fixes an obscure bug with user linked query tiles
1.970      Tidy up customizer dialog to give existing info
1.966      Enable duplicate LINK items and add power meter things
1.965      Restored weather icons using new mapping info
1.964      Updated documentation and tweak CSS for Edge browser
1.963      Improved user guidance for Hubitat installations
1.962      Bring Hubitat and SmartThigns groovy files into sync with each other
           and in the process found a few minor bugs and fixed them
1.961      Important bug fixes to groovy code for switches, locks, valves
1.960      New username feature and change how auth dialog box works
           - fixed error in door controller
1.953      Fix room delete bug - thanks to @hefman for flagging this
1.952      Finalize GUI for tile customization (wicked cool)
           - fix bug in Music player for controls
           - revert to old light treatment in Hubitat
1.951      Bug fixes while testing major 1.950 update
           - fix bug that made kiosk mode setting not work in the Options page
           - fix bug that broke skin media in tile edit while in kiosk mode
           - use the user config date formats before setting up clock in a refresh
1.950      Major new update with general customizations for any tile
           - this is a major new feature that gives any tile the ability to
             add any element from any other tile or any user provided text
             so basically all tiles now behave like custom tiles in addition
             to their native behavior. You can even replace existing elements
             For example, the analog clock skin can be changed now by user
             User provided URL links and web service POST calls also supported
             Any URL link provided when clicked will open in a new tab/window
           - fix weird bug in processing names for class types
           - added ability to customize time formats leveraging custom feature
           - now refresh frames so their content stays current
           - include blanks, clocks, and custom tiles in fast non-hub refresh
           - enable frame html file names to be specified as name in TileEdit
           - lots of other cleanups and bug fixes
1.941      Added config tile for performing various options from a tile
           - also fixed a bug in cache file reload for customtiles
1.940      Fix bug in Tile Editor for rotating icon setting and slower timers
1.930      Fix thermostat and video tag obscure bugs and more
           - chnage video to inherit size
           - change tile editor to append instead of prepend to avoid overlaps
           - increase default polling speed
           - first release of install script install.sh
1.928      Disallow hidden whole tiles and code cleanup
1.927      Added flourescent graphic to default skin, fix edit of active tile
1.926      Doc update to describe video tiles and minor tweaks, added help button
1.925      Various patches and hub tweaks
           - Hub name retrieval from hub
           - Show user auth activation data
           - Hack to address Hubitat bug for Zwave generic dimmers
           - Added border styling to TileEditor
1.924      Update custom tile status to match linked tiles
           Added option to select number of custom tiles to use (beta)
1.923      TileEditor updates
           - new option to align icons left, center or right
           - added images of Sonos speakers to media library
           - fixed bug where header invert option was always clicked
           - renamed Text Width/Height to Item Width/Height
1.922      Updated default skin to make custom reflect originals in more places
1.921      Hybrid custom tile support using hmoptions user provided input
1.920      CSS cleanup and multiple new features
           - enable skin editing on the main page
           - connect customtiles to each skin to each one has its own
             this means all customizations are saved in the skin directory too
           - migrated fixed portions of skin to tileedit.css
           - fix plain skin to use as skin swapping demo
           - various bug fixes and performance improvements
1.910      Clean up CSS files to prepare for new skin creation
1.900      Refresh when done auth and update documentation to ccurrent version
1.809      Fix disappearing things in Hubitat bug - really this time...
1.808      Clean up page tile editing and thermostat bug fix
1.807      Fix brain fart mistake with 1.806 update
1.806      Multi-tile editing and major upgrade to page editing
1.805      Updates to tile editor and change outside image; other bug fixes
1.804      Fix invert icon in TileEditor, update plain skin to work
1.803      Fix http missing bug on hubHost, add custom POST, and other cleanup
1.802      Password option implemented - leave blank to bypass
1.801      Squashed a bug when tile instead of id was used to invoke the API
1.80       Merged multihub with master that included multi-tile api calls
1.793      Cleaned up auth page GUI, bug fixes, added hub num & type to tiles 
1.792      Updated but still beta update to multiple ST and HE hub support
1.791      Multiple ST hub support and Analog Clock
1.79       More bug fixes
           - fix icon setting on some servers by removing backslashes
           - added separate option for timers and action disable
1.78       Activate multiple things for API calls using comma separated lists
           to use this you mugit stst have useajax=doaction or useajax=dohubitat
           and list all the things to control in the API call with commas separating
1.77       More bug fixes
            - fix accidental delete of icons in hubitat version
            - incorporate initial width and height values in tile editor
1.76       Misc cleanup for first production release
            - fixed piston graphic in tileeditor
            - fix music tile status to include stop state in tileeditor
            - added ?v=hash to js and css files to force reload upon change
            - removed old comments and dead code

1.75       Page name editing, addition, and removal function and reorder bug fixes
1.74       Add 8 custom tiles, zindex bugfix, and more tile editor updates
1.73       Updated tile editor to include whole tile backgrounds, custom names, and more
1.72       Timezone bug fix and merge into master
1.71       Bug fixes and draft page edit commented out until fixed
1.7        New authentication approach for easier setup and major code cleanup
1.622      Updated info dump to include json dump of variables
1.621      ***IMPT**bugfix to prior 1.62 update resolving corrupt config files
1.62       New ability to use only a Hubitat hubg
1.61       Bugfixes to TileEditor
1.60       Major rewrite of TileEditor
1.53       Drag and drop tile addition and removal and bug fixes
1.52       Bugfix for disappearing rooms, add Cancel in options, SmartHomeMonitor add
1.51       Integrate skin-material from @vervallsweg to v1.0.0 to work with sliders
1.50       Enable Hubitat devices when on same local network as HP
1.49       sliderhue branch to implement slider and draft color picker
1.48       Integrate @nitwitgit (Nick) TileEdit V3.2
1.47       Integrate Nick's color picker and custom dialog
1.46       Free form drag and drop of tiles
1.45       Merge in custom tile editing from Nick ngredient-master branch
1.44       Tab row hide/show capabilty in kiosk and regular modes
           Added 4 generally customizable tiles to each page for styling
           Fix 1 for bugs in hue lights based on testing thanks to @cwwilson08
1.43       Added colorTemperature, hue, and saturation support - not fully tested
           Fixed bug in thermostat that caused fan and mode to fail
           Squashed more bugs
1.42       Clean up CSS file to show presence and other things correctly
           Change blank and image logic to read from Groovy code
           Keep session updated for similar things when they change
             -- this was done in the js file by calling refreshTile
           Fix default size for switch tiles with power meter and level
             -- by default will be larger but power can be disabled in CSS
1.41       Added filters on the Options page
           Numerous bug fixes including default Kiosk set to false
           Automatically add newly identified things to rooms per base logic
           Fix tablet alignment of room tabs
           Add hack to force background to show on near empty pages
1.4        Official merge with Open-Dash
           Misc bug fixes in CSS and javascript files
           Added kiosk mode flag to options file for hiding options button
1.32       Added routines capabilities and cleaned up default icons
1.31       Minor bug fixes - fixed switchlevel to include switch class
1.3        Intelligent class filters and force feature
           user can add any class to a thing using <<custom>>
           or <<!custom>> the only difference being ! signals
           to avoid putting custom in the name of the tile
           Note - it will still look really ugly in the ST app
           Also adds first three words of the thing name to class
           this is the preferred customizing approach
1.2        Cleaned up the Groovy file and streamlined a few things
           Added smoke, illuminance, and doors (for Garages)
           Reorganized categories to be more logical when selecting things
1.1 beta   Added cool piston graph for Webcore tiles 
           Added png icons for browser and Apple products
           Show all fields supported - some hidden via CSS
           Battery display on battery powered sensors
           Support Valves - only tested with Rachio sprinklers
           Weather tile changed to show actual and feels like side by side
           Power and Energy show up now in metered plugs
           Fix name of web page in title
           Changed backgrounds to jpg to make them smaller and load faster
           Motion sensor with temperature readings now show temperature too
0.8 beta   Many fixes based on alpha user feedback - first beta release
           Includes webCoRE integration, Modes, and Weather tile reformatting
           Also includes a large time tile in the default skin file
           Squashed a few bugs including a typo in file usage
0.7-alpha  Enable a skinning feature by moving all CSS and graphics into a 
           directory. Added parameter for API calls to support EU
0.6-alpha  Minor tweaks to above - this is the actual first public version
0.5-alpha  First public test version
0.2        Cleanup including fixing unsafe GET and POST calls
           Removed history call and moved to javascript side
           put reading and writing of options into function calls
           replaced main page bracket from table to div
0.1        Implement new architecture for files to support sortable jQuery
0.0        Initial release
`;

var version = devhistory.substr(1,8).trim();

exports.DEV = devhistory;
exports.HPVERSION = version;
exports.APPNAME = 'HousePanel V' + version;

exports.hidden = function hidden(pname, pvalue, id) {
    var inpstr = "<input type='hidden' name='" + pname + "'  value='" + pvalue + "'";
    if (id) { inpstr += " id='" + id + "'"; }
    inpstr += " />";
    return inpstr;
}

exports.getHeader = function getHeader(skin, islogin) {
    
    var skip = ( typeof islogin !== "undefined" && islogin ) ;

    var $tc = '<!DOCTYPE html>';
    $tc += '<html><head><title>HousePanel</title>';
    $tc += '<meta content="text/html; charset=iso-8859-1" http-equiv="Content-Type">';
    
    // specify icon and color for windows machines
    $tc += '<meta name="msapplication-TileColor" content="#2b5797">';
    $tc += '<meta name="msapplication-TileImage" content="media/mstile-144x144.png">';
    
    // specify icons for browsers and apple
    $tc += '<link rel="icon" type="image/png" href="media/favicon-16x16.png" sizes="16x16"> ';
    $tc += '<link rel="icon" type="image/png" href="media/favicon-32x32.png" sizes="32x32"> ';
    $tc += '<link rel="icon" type="image/png" href="media/favicon-96x96.png" sizes="96x96"> ';
    $tc += '<link rel="apple-touch-icon" href="media/apple-touch-icon.png">';
    $tc += '<link rel="shortcut icon" href="media/favicon.ico">';
    
    // load jQuery and themes
    $tc += '<link rel="stylesheet" type="text/css" href="jquery-ui.css">';
    $tc += '<script src="jquery-1.12.4.min.js"></script>';
    $tc += '<script src="jquery-ui.min.js"></script>';

    // include hack from touchpunch.furf.com to enable touch punch through for tablets
    $tc += '<script src="jquery.ui.touch-punch.min.js"></script>';
    
    if ( !skip ) {
        // minicolors library
        $tc += '<script src="jquery.minicolors.min.js"></script>';
        $tc += '<link rel="stylesheet" href="jquery.minicolors.css">';

        // analog clock support
        $tc += '<!--[if IE]><script type="text/javascript" src="excanvas.js"></script><![endif]-->';
        $tc += '<script type="text/javascript" src="coolclock.js"></script>';
    }
    
    // load main script file
    $tc += '<script type="text/javascript" src="housepanel.js"></script>';  
    
    // load tile editor fixed css file with cutomization helpers
    $tc += "<script type='text/javascript' src='tileeditor.js'></script>";
    $tc += "<link id='tileeditor' rel='stylesheet' type='text/css' href='tileeditor.css'>";	

    if ( !skip ) {

        // load tile customizer
        $tc += '<script type="text/javascript" src="customize.js"></script>';
        
        // check for valid skin folder
        if (!skin) {
            skin = "skin-housepanel";
        }

        // load the main css file
        $tc += "<link rel=\"stylesheet\" type=\"text/css\" href=\"" + skin + "/housepanel.css\">";

        // load the custom tile sheet if it exists
        // replaced logic to make customizations skin specific
        $tc += "<link id=\"customtiles\" rel=\"stylesheet\" type=\"text/css\" href=\"" + skin + "/customtiles.css\">";
    }
    
    // begin creating the main page
    $tc += '</head><body>';
    $tc += '<div class="maintable">';
    return $tc;
}

exports.getFooter = function getFooter() {
    return "</div></body></html>";
}

exports.count = function count(obj) {
    if ( typeof obj === "object" )  {
        return Object.keys(obj).length;
    } else {
        return 0;
    }
}
