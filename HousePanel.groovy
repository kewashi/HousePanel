/**
 *  HousePanel
 *
 *  Copyright 2016 to 2020 by Kenneth Washington
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 * This is a Hubitat app that works with the HousePanel smart dashboard platform
 * 
 * Revision history
 * 05/17/2023 - remove momentaries and fix attribute checks
 * 05/11/2023 - modify mode setting to work with isy app
 * 05/02/2023 - clean up dimmers and shades
 * 04/30/2023 - fix windowShade operation
 * 04/05/2023 - update ip reporting to support use of user provided access tokens
 * 04/04/2023 - fix other, contact, and doors to work with custom device handlers
 * 03/13/2023 - change postHub to always use http and tweak logging
 * 02/18/2023 - fix thermostat to support directly changing temperatures
 * 02/13/2023 - rewrote logic for handling colors including a nasty bugfix in hsv2rgb
 * 02/11/2023 - removed event here since we do it on node side and changed to status_
 * 01/08/2023 - added variable support
 * 01/02/2023 - changed UI inspired by Homebridge and removed ST groovy stuff
 * 09/10/2022 - misc cleanup and report skipped functions due to parameters
 * 08/27/2022 - added action for presence to handle arrive and depart calls
 * 08/27/2022 - fix getThing to read all known attributes and updated ignore fields
 * 06/25/2022 - replaced shade and door controls to work properly with icons
 * 06/13/2022 - fix shade bugs, clean up buttons, and support button commands
 * 06/05/2022 - fix long standing hue color problem
 * 06/03/2022 - add support to post directly to an external https website & cleanup
 * 05/30/2022 - add direct support for window shades beyond other hack on 12/27/21
 * 04/24/2022 - handle color changes from the new HP web service
 * 12/27/2021 - add position for shades
 * 10/24/2020 - clean up logger for tracking hub push changes
              - remove routines since they are depracated and classic app is gone
 * 09/12/2020 - check for valid IP and port value entries for HP hub pushes
 * 07/20/2020 - add a status field for device items using getStatus() - thanks @phil_c
 * 07/18/2020 - include level for others and actuators so window shades work
                also fix bug to include actuators in the event handler logic
 * 07/13/2020 - fix bug in setOther where an invalid attr was passed - thanks @phil_c
 * 07/10/2020 - fix button rule callback to send scalar instead of object
 *            - remove all manual log.info and log.debug and user logger everywhere
 * 06/16/2020 - fix mode and momentary buttons that I broke in a prior update
 * 06/12/2020 - add toggle as a command for all light types
 * 06/09/2020 - remove dynamic pages since they mess up OAUTH from HP side
 * 05/29/2020 - added button and actuator support, remove depracated Lights type
 * 05/17/2020 - overhaul the way we do push notices via registration
 * 05/10/2020 - tidy up switch reg, power reporting, and add patch for audio
 * 04/09/2020 - mode change fix from 03/29 update
 * 04/02/2020 - fix bug in mode and return only one now
 * 03/29/2020 - clean up mode and fix hub pushes to be more reliable
 * 02/02/2020 - added secondary hub push and include hub id in the push
 * 01/10/2020 - add mode chenge hub push and clean up code
 * 12/20/2019 - bug fixes and cleanup
 * 12/19/2019 - update to include new Sonos audioNotification capability
 * 08/25/2019 - bugfix water leak to prevent error if wet and dry not supported
 *              update switches to include name
 * 08/18/2019 - added water action for setting dry and wet
 * 07/29/2019 - change Hubitat HubId to the actual Hub UID instead of App Id
 * 07/03/2019 - added DeviceWatch-Enroll new ignore field and fixed comment above
 *              work on fixing color reporting for bulbs - still not quite right
 * 05/27/2019 - remove blanks and images from groovy
 * 05/14/2019 - add native music artist, album, art fields when present
 * 05/11/2019 - clean up and tweak music; longer delays in subscribes
 * 05/03/2019 - user option to specify format of event time fields
 * 05/01/2019 - add try/catch for most things to prevent errors and more cleanup
 * 04/30/2019 - clean up this groovy file
 * 04/22/2019 - clean up SHM and HSM to return similar display fields
 *              - mimic Night setting in SHM to match how HSM works
 * 04/21/2019 - deal with missing prefix and other null protections
 * 04/18/2019 - add direct mode change for SHM and HSM (HE bug in HSM)
 * 04/17/2019 - merge groovy files with detector for hub type
 * 04/09/2019 - add history fields
 * 03/15/2019 - fix names of mode, blank, and image, and add humidity to temperature
 * 03/14/2019 - exclude fields that are not interesting from general tiles
 * 03/02/2019 - added motion sensors to subscriptions and fix timing issue
 * 02/26/2019 - add hubId to name query
 * 02/15/2019 - change hubnum to use hubId so we can remove hubs without damage
 * 02/10/2019 - redo subscriptions for push to make more efficient by group
 * 02/07/2019 - tweak to ignore stuff that was blocking useful push updates
 * 02/03/2019 - switch thermostat and music tiles to use native key field names
 * 01/30/2019 - implement push notifications and logger
 * 01/27/2019 - first draft of direct push notifications via hub post
 * 01/19/2019 - added power and begin prepping for push notifications
 * 01/14/2019 - fix bonehead error with switches and locks not working right due to attr
 * 01/05/2019 - fix music controls to work again after separating icons out
 * 12/01/2018 - hub prefix option implemented for unique tiles with multiple hubs
 * 11/21/2018 - add routine to return location name
 * 11/19/2018 - thermostat tweaks to support new custom tile feature 
 * 11/18/2018 - fixed mode names to include size cues
 * 11/17/2018 - bug fixes and cleanup to match Hubitat update
 * 10/30/2018 - fix thermostat bug
 * 08/20/2018 - fix another bug in lock that caused render to fail upon toggle
 * 08/11/2018 - miscellaneous code cleanup
 * 07/24/2018 - fix bug in lock opening and closing with motion detection
 * 06/11/2018 - added mobile option to enable or disable pistons and fix debugs
 * 06/10/2018 - changed icons to amazon web services location for https
 * 04/18/2018 - Bugfix curtemp in Thermostat, thanks to @kembod for finding this
 * 04/08/2018 - Important bug fixes for thermostat and music tiles
 * 03/11/2018 - Added Smart Home Monitor from Chris Hoadley
 * 03/10/2018 - Major speedup by reading all things at once
 * 02/25/2018 - Update to support sliders and color hue picker
 * 01/04/2018 - Fix bulb bug that returned wrong name in the type
 * 12/29/2017 - Changed bulb to colorControl capability for Hue light support
 *              Added support for colorTemperature in switches and lights
 * 12/10/2017 - Added name to each thing query return
 *            - Remove old code block of getHistory code
 * 
 */

import groovy.json.JsonOutput
import groovy.transform.Field
import java.text.SimpleDateFormat
import java.util.concurrent.Semaphore

public static String handle() { return "HousePanel" }

/**********************************************
    STATICALLY DEFINED VARIABLES
    inpired by Tonesto7 homebridge2 app
***********************************************/
@Field static final String appVersionFLD  = '3.4.8'
@Field static final String branchFLD      = 'master'
@Field static final String platformFLD    = 'Hubitat'
@Field static final String pluginNameFLD  = 'Hubitat-v2'
@Field static final Boolean devModeFLD    = false
@Field static final String sNULL          = (String) null
@Field static final String sBLANK         = ''
@Field static final String sSPACE         = ' '
@Field static final String sBULLET        = '\u2022'
@Field static final String sLINEBR        = '<br>'
@Field static final String sFALSE         = 'false'
@Field static final String sTRUE          = 'true'
@Field static final String sBOOL          = 'bool'
@Field static final String sENUM          = 'enum'
@Field static final String sSVR           = 'svraddr'
@Field static final String sCLN           = ':'
@Field static final String sNLCLN         = 'null:null'
@Field static final String sEVT           = 'evt'
@Field static final String sEVTLOGEN      = 'evtLogEn'
@Field static final String sDBGLOGEN      = 'dbgLogEn'
@Field static final String sDBG           = 'debug'
@Field static final String sUPD           = 'update'
@Field static final String sEVTUPD        = 'EventUpdate'
@Field static final String sAPPJSON       = 'application/json'
@Field static final String sSUCC          = 'Success'
@Field static final String sATK           = 'accessToken'
@Field static final String sMEDIUM        = 'medium'
@Field static final String sSMALL         = 'small'
@Field static final String sCLR4D9        = '#2784D9'
@Field static final String sCLR9B1        = '#0299B1'
@Field static final String sCLRRED        = 'red'
@Field static final String sCLRRED2       = '#cc2d3b'
@Field static final String sCLRGRY        = 'gray'
@Field static final String sCLRGRN        = 'green'
@Field static final String sCLRORG        = 'orange'
@Field static final String sTTM           = 'Tap to modify...'
@Field static final String sTTC           = 'Tap to configure...'
@Field static final String sTTP           = 'Tap to proceed...'
@Field static final String sTTV           = 'Tap to view...'
@Field static final String sTTS           = 'Tap to select...'
@Field static final String sASYNCCR       = 'asyncHttpCmdResp'
@Field static final String sLASTWU        = 'lastwebCoREUpdDt'
@Field static final String sINFO          = 'info'
@Field static final String sCMD           = 'command'
@Field static final String sCAP_SW        = 'capability.switch'
@Field static final String sSW            = 'switch'

/**********************************************
    APP HELPER FUNCTIONS
    inpired by Tonesto7 homebridge2 app
***********************************************/
static String getAppImg(String imgName) { return "https://kenw.com/wp-content/uploads/${imgName}" }
static String sectH3TS(String t, String st, String i = sNULL, String c=sCLR4D9) { return "<h3 style='color:${c};font-weight: bold'>${i ? "<img src='${i}' width='48'> " : sBLANK} ${t?.replaceAll("\\n", '<br>')}</h3>${st ?: sBLANK}" }
static String sectHead(String str, String img = sNULL) { return str ? "<h3 style='margin-top:0;margin-bottom:0;'>" + spanImgStr(img) + span(str, sCLR4D9, sNULL, true) + '</h3>' + "<hr style='background-color:${sCLRGRY};font-style:italic;height:1px;border:0;margin-top:0;margin-bottom:0;'>" : sBLANK }

// Root HTML Objects
static String span(String str, String clr=sNULL, String sz=sNULL, Boolean bld=false, Boolean br=false) { return str ? "<span ${(clr || sz || bld) ? "style='${clr ? "color: ${clr};" : sBLANK}${sz ? "font-size: ${sz};" : sBLANK}${bld ? 'font-weight: bold;' : sBLANK}'" : sBLANK}>${str}</span>${br ? sLINEBR : sBLANK}" : sBLANK }
static String div(String str, String clr=sNULL, String sz=sNULL, Boolean bld=false, Boolean br=false) { return str ? "<div ${(clr || sz || bld) ? "style='${clr ? "color: ${clr};" : sBLANK}${sz ? "font-size: ${sz};" : sBLANK}${bld ? 'font-weight: bold;' : sBLANK}'" : sBLANK}>${str}</div>${br ? sLINEBR : sBLANK}" : sBLANK }
static String spanImgStr(String img=sNULL) { return img ? span("<img src='${(!img.startsWith('http')) ? getAppImg(img) : img}' width='42'> ") : sBLANK }
static String strUnder(String str, Boolean showUnd=true) { return str ? (showUnd ? "<u>${str}</u>" : str) : sBLANK }
static String htmlLine(String color=sCLR4D9, Integer width = null) { return "<hr style='background-color:${color};height:1px;border:0;margin-top:0;margin-bottom:0;${width ? "width: ${width}px;" : sBLANK}'>" }
static String lineBr(Boolean show=true) { return show ? sLINEBR : sBLANK }
static String inputFooter(String str, String clr=sCLR4D9, Boolean noBr=false) { return str ? lineBr(!noBr) + divSmBld(str, clr) : sBLANK }

// Custom versions of the root objects above
static String spanBldBr(String str, String clr=sNULL, String img=sNULL)    { return str ? spanImgStr(img) + span(str, clr, sNULL, true, true)      : sBLANK }
static String spanBr(String str, String clr=sNULL, String img=sNULL)       { return str ? spanImgStr(img) + span(str, clr, sNULL, false, true)     : sBLANK }
static String spanSm(String str, String clr=sNULL, String img=sNULL)       { return str ? spanImgStr(img) + span(str, clr, sSMALL)                 : sBLANK }
static String spanSmBr(String str, String clr=sNULL, String img=sNULL)     { return str ? spanImgStr(img) + span(str, clr, sSMALL, false, true)    : sBLANK }
static String spanSmBld(String str, String clr=sNULL, String img=sNULL)    { return str ? spanImgStr(img) + span(str, clr, sSMALL, true)           : sBLANK }
static String spanSmBldUnd(String str, String clr=sNULL, String img=sNULL) { return str ? spanImgStr(img) + span(strUnder(str), clr, sSMALL, true) : sBLANK }
static String spanSmBldBr(String str, String clr=sNULL, String img=sNULL)  { return str ? spanImgStr(img) + span(str, clr, sSMALL, true, true)     : sBLANK }
static String divSmBld(String str, String clr=sNULL, String img=sNULL)      { return str ? div(spanImgStr(img) + span(str), clr, sSMALL, true)        : sBLANK }



definition(
    name: "${handle()}",
    namespace: "kewashi",
    author: "Kenneth Washington",
    description: "Tap here to install ${handle()} - a highly customizable smarthome dashboard. ",
    category: "Convenience",
    iconUrl: "",
    iconX2Url: "",
    oauth: [displayName: "HousePanel", displayLink: ""])

preferences {
    page(name: 'startPage')
    page(name: 'mainPage')
    page(name: 'deviceSelectPage')
    page(name: 'settingsPage')
    page(name: 'variablesPage')
}

mappings {
  path("/getallthings") {  action: [       POST: "getAllThings"     ] }
  path("/doaction") {      action: [       POST: "doAction"         ]  }
  path("/doquery") {       action: [       POST: "doQuery"          ]  }
  path("/gethubinfo") {    action: [       POST: "getHubInfo"       ]  }

}

def appInfoSect() {
    Boolean isNote = false
    String tStr = spanSmBld('HousePanel Version:', sCLRGRY) + spanSmBr(" ${appVersionFLD}", sCLRGRY)
    section (sectH3TS((String)app.name, tStr, getAppImg('hpicon3x.png'), 'blue')) {
        paragraph htmlLine(sCLRGRY)
    }
}

def startPage() {
    if (!getAccessToken()) { return dynamicPage(name: 'mainPage', install: false, uninstall: true) {
            section() { paragraph spanSmBldBr('OAuth Error', sCLRRED) + spanSmBld("OAuth is not Enabled for ${app?.getName()}!.<br><br>Please click remove and Enable Oauth under the Hubitat App Settings in the App Code page.") } }
    } else {
        return mainPage()
    }
}

def mainPage() {

    Boolean isInst = (state.isInstalled == true)
    // if ((Boolean)settings.enableWebCoRE && !webCoREFLD) { webCoRE_init() }

    if ( !state.globalVars ) {
        state.globalVars = getAllGlobalVars()
    }

    return dynamicPage(name: 'mainPage', nextPage: sBLANK, install: !isInst, uninstall: true) {

        appInfoSect()

        section(sectHead('Device Configuration:')) {
            String desc = sBLANK
            desc += myswitches ? spanSmBld("Switch${myswitches.size() > 1 ? 'es' : sBLANK}") + spanSmBr(" (${myswitches.size()})") : sBLANK
            desc += mydimmers ? spanSmBld("Dimmers${mydimmers.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mydimmers.size()})") : sBLANK
            desc += mybuttons ? spanSmBld("Pushable Button${mybuttons.size() > 1 ? "s" : sBLANK}") + spanSmBr(" (${mybuttons.size()})") : sBLANK
            desc += mybulbs ? spanSmBld("Bulb${mybulbs.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mybulbs.size()})") : sBLANK
            desc += mypowers ? spanSmBld("Power${mypowers.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mypowers.size()})") : sBLANK
            desc += mypresences ? spanSmBld("Presence${mypresences.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mypresences.size()})") : sBLANK
            desc += mymotions ? spanSmBld("Motion Sensor${mymotions.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mymotions.size()})") : sBLANK
            desc += mycontacts ? spanSmBld("Contact Sensor${mycontacts.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mycontacts.size()})") : sBLANK
            desc += mydoors ? spanSmBld("Door${mydoors.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mydoors.size()})") : sBLANK
            desc += mygarages ? spanSmBld("Garage Door${mygarages.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mygarages.size()})") : sBLANK
            desc += mylocks ? spanSmBld("Lock${mylocks.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mylocks.size()})") : sBLANK
            desc += myshades ? spanSmBld("Shade${myshades.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myshades.size()})") : sBLANK
            desc += mythermostats ? spanSmBld("Thermostat${mythermostats.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mythermostats.size()})") : sBLANK
            desc += mytemperatures ? spanSmBld("Temperature${mytemperatures.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mytemperatures.size()})") : sBLANK
            desc += myilluminances ? spanSmBld("Illuminance${myilluminances.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myilluminances.size()})") : sBLANK
            desc += myweathers ? spanSmBld("Weather${myweathers.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myweathers.size()})") : sBLANK
            desc += mywaters ? spanSmBld("Water${mywaters.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mywaters.size()})") : sBLANK
            desc += myvalves ? spanSmBld("Valve${myvalves.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myvalves.size()})") : sBLANK
            desc += mysmokes ? spanSmBld("Smoke${mysmokes.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mysmokes.size()})") : sBLANK
            desc += mymusics ? spanSmBld("Music${mymusics.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mymusics.size()})") : sBLANK
            desc += myaudios ? spanSmBld("Audio${myaudios.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myaudios.size()})") : sBLANK
            desc += myothers ? spanSmBld("Sensor${myothers.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myothers.size()})") : sBLANK
            desc += myactuators ? spanSmBld("Actuator${myactuators.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myactuators.size()})") : sBLANK

            desc += htmlLine(sCLR4D9, 150)
            desc += inputFooter(sTTM)

            href 'deviceSelectPage', title: spanSmBld('Device Selection'), required: false, description: (desc ? spanSm(desc, sCLR4D9) : inputFooter('Tap to select devices...', sCLRGRY, true))
        }

        section(sectHead('Variable Configuration:')) {
            String vdesc = sBLANK
        
            def numvar = 0
            state.globalVars.each { String varname, Map infomap ->
                numvar += settings["var_${varname}"] ? 1 : 0
            }
            vdesc += numvar > 0 ? spanSmBld("Variable${ (numvar > 1) ? 's' : sBLANK}") + spanSmBr(" (${numvar})") : sBLANK
            href 'variablesPage', title: spanSmBld('Variable Selection'), description: (vdesc ? spanSm(vdesc, sCLR4D9) : inputFooter('Tap to select variables...', sCLRGRY, true))
        }

        section(sectHead('App Preferences:')) {
            // String sDesc = getSetDesc()
            href 'settingsPage', title: spanSmBld('App Settings'), description: " Options "
            label title: spanSmBld('Label this Instance (optional)'), description: 'Rename this App', defaultValue: app?.name, required: false
        }
    }
}

def settingsPage() {
    return dynamicPage(name: 'settingsPage', nextPage: sBLANK, title: sBLANK, install: false, uninstall: false) {

        appInfoSect()

        section("HousePanel Configuration") {
            paragraph "Welcome to HousePanel. Below you will authorize your things for HousePanel."
            paragraph "prefix to uniquely identify certain tiles for this hub. " +
                    "If left blank, hub type will determine prefix; e.g., st_ for SmartThings or h_ for Hubitat"
            input (name: "hubprefix", type: "text", multiple: false, title: "Hub Prefix:", required: false, defaultValue: "st_")
            paragraph "Enable Pistons? You must have WebCore installed for this to work. Beta feature for Hubitat hubs."
            input (name: "usepistons", type: "bool", multiple: false, title: "Use Pistons?", required: false, defaultValue: false)
            paragraph "Timezone and Format for event time fields; e.g., America/Detroit, Europe/London, or America/Los_Angeles"
            input (name: "timezone", type: "text", multiple: false, title: "Timezone Name:", required: false, defaultValue: "America/Los_Angeles")
            input (name: "dateformat", type: "text", multiple: false, title: "Date Format:", required: false, defaultValue: "M/dd h:mm")
            paragraph "Specify these parameters to enable your panel to stay in sync with things when they change in your home. " +
                      "This is not a hard requirement but if you don't provide the IP of where you are hositng your panel will get out of sync."
            input "webSocketHost", "text", title: "Host IP", defaultValue: "192.168.4.4", required: false
            input "webSocketPort", "text", title: "Port", defaultValue: "8560", required: false
            paragraph "The Alternate 2nd and 3rd Host IP and Port values are used to send hub pushes to additional installations of HousePanel. " +
                    "If left as 0 additional hub pushes will not occur. Only use this if you are hosting two or three versions of HP " +
                    "that need to stay in sync with this smart home hub. Note: this is mostly used for development debugging and can be safely left as 0"
            input "webSocketHost2", "text", title: "2nd Host IP", defaultValue: "0", required: false
            input "webSocketPort2", "text", title: "2nd Port", defaultValue: "0", required: false
            input "webSocketHost3", "text", title: "3rd Host IP", defaultValue: "0", required: false
            input "webSocketPort3", "text", title: "3rd Port", defaultValue: "0", required: false
            input (
                name: "configLogLevel",
                title: "IDE Live Logging Level:\nMessages with this level and higher will be logged to the IDE.",
                type: "enum",
                options: ["0" : "None", "1" : "Error", "2" : "Warning", "3" : "Info", "4" : "Debug", "5" : "Trace"],
                defaultValue: "3",
                displayDuringSetup: true,
                required: false
            )
        }

    }
}

def deviceSelectPage() {
    return dynamicPage(name: 'deviceSelectPage', title: sBLANK, install: false, uninstall: false) {

        appInfoSect()

        section(sectHead('Define Specific Categories:')) {
            paragraph spanSmBldBr('Description:', sCLR4D9) + spanSm('Select devices to show in each category below', sCLR4D9)
            paragraph spanSmBldBr('NOTE: ') + spanSmBldBr('Duplicates are allowed, but not requried')
        }

        section(sectHead("Switches, Dimmers and Buttons", "bulbon.png")) {
                input "myswitches", "capability.switch", multiple: true, required: false, title: "Switches"
                input "mydimmers", "capability.switchLevel", hideWhenEmpty: true, multiple: true, required: false, title: "Switch Level Dimmers"
                input "mybuttons", "capability.pushableButton", hideWhenEmpty: true, multiple: true, required: false, title: "Buttons"
                input "mybulbs", "capability.colorControl", hideWhenEmpty: true, multiple: true, required: false, title: "Color Control Bulbs"
                input "mypowers", "capability.powerMeter", hideWhenEmpty: true, multiple: true, required: false, title: "Power Meters"
        }
        section (sectHead("Motion and Presence","boypresent.png")) {
                input "mypresences", "capability.presenceSensor", hideWhenEmpty: true, multiple: true, required: false, title: "Presence"
                input "mymotions", "capability.motionSensor", multiple: true, required: false, title: "Motion"
        }
        section (sectHead("Doors, Contacts, Locks, and Shades","closedoor.png")) {
                input "mycontacts", "capability.contactSensor", hideWhenEmpty: true, multiple: true, required: false, title: "Contact Sensors"
                input "mydoors", "capability.doorControl", hideWhenEmpty: true, multiple: true, required: false, title: "Doors"
                input "mygarages", "capability.garageDoorControl", hideWhenEmpty: true, multiple: true, required: false, title: "Garage Doors"
                input "mylocks", "capability.lock", hideWhenEmpty: true, multiple: true, required: false, title: "Locks"
                input "myshades", "capability.windowShade", hideWhenEmpty: true, multiple: true, required: false, title: "Window Shades"
        }
        section (sectHead("Thermostats and Weather")) {
                input "mythermostats", "capability.thermostat", hideWhenEmpty: true, multiple: true, required: false, title: "Thermostats"
                input "mytemperatures", "capability.temperatureMeasurement", hideWhenEmpty: true, multiple: true, required: false, title: "Temperature Measures"
                input "myilluminances", "capability.illuminanceMeasurement", hideWhenEmpty: true, multiple: true, required: false, title: "Illuminance Measurements"
                input "myweathers", "device.smartweatherStationTile", hideWhenEmpty: true, multiple: true, required: false, title: "Weather tile"
                // input "myaccuweathers", "device.accuweatherDevice", hideWhenEmpty: true, multiple: true, required: false, title: "AccuWeather tile"
        }
        section (sectHead("Water, Sprinklers and Smoke")) {
                input "mywaters", "capability.waterSensor", hideWhenEmpty: true, multiple: true, required: false, title: "Water Sensors"
                input "myvalves", "capability.valve", hideWhenEmpty: true, multiple: true, required: false, title: "Sprinklers"
                input "mysmokes", "capability.smokeDetector", hideWhenEmpty: true, multiple: true, required: false, title: "Smoke Detectors"
        }
        section (sectHead("Music and Audio","unmute.png")) {
                paragraph "Music things use the legacy Sonos device handler. Audio things use the new Audio handler that works with multiple audio device types including Sonos."
                input "mymusics", "capability.musicPlayer", hideWhenEmpty: true, multiple: true, required: false, title: "Music Players"
                input "myaudios", "capability.audioNotification", hideWhenEmpty: true, multiple: true, required: false, title: "Audio Devices"
        }
        section (sectHead("Other Sensors and Actuators")) {
                paragraph "Any thing can be added as an Other sensor or actuator. Other sensors and actuators bring in ALL fields and commands supported by the device."
                input "myothers", "capability.sensor", multiple: true, required: false, title: "Which Other Sensors"
                input "myactuators", "capability.actuator", multiple: true, required: false, title: "Which Other Actuators"
        }

    }
}

def variablesPage() {

    if ( !state.globalVars ) {
        state.globalVars = getAllGlobalVars()
    }
    // logger("rendering variables page; var count = ${state.globalVars.size()}", "info")

    return dynamicPage(name: 'variablesPage', title: sBLANK, install: false, uninstall: false) {

        appInfoSect()

        section(sectHead('Select variables to include:')) {
            state.globalVars.each { String varname, Map infomap ->
                def vartype = infomap["type"]
                def curval = infomap["value"]
                paragraph "Variable ${varname} (${vartype}) = ${curval}"
                input (name: "var_${varname}", type: "bool", multiple: false, title: "${varname}?", required: false, defaultValue: false)
            }
        }
    }
}

def installed() {
    initialize()
}

def updated() {
    unsubscribe()
    initialize()
}

def initialize() {
    state.usepistons = settings?.usepistons ?: false

    // reset variable usage
    removeAllInUseGlobalVar()

    state.directIP = settings?.webSocketHost ?: "0"
    state.directIP = state.directIP.trim()
    state.directPort = settings?.webSocketPort ?: "0"
    state.directPort = state.directPort.trim()

    state.directIP2 = settings?.webSocketHost2 ?: "0"
    state.directIP2 = state.directIP2.trim()
    state.directPort2 = settings?.webSocketPort2 ?: "0"
    state.directPort2 = state.directPort2.trim()

    state.directIP3 = settings?.webSocketHost3 ?: "0"
    state.directIP3 = state.directIP3.trim()
    state.directPort3 = settings?.webSocketPort3 ?: "0"
    state.directPort3 = state.directPort3.trim()

    state.tz = settings?.timezone ?: "America/Los_Angeles"
    state.prefix = settings?.hubprefix ?: getPrefix()
    state.dateFormat = settings?.dateformat ?: "M/dd h:mm"
    state.powervals = [test: "test"]

    configureHub();
    if ( state.usepistons ) {
        webCoRE_init()
    }
    state.loggingLevelIDE = settings.configLogLevel?.toInteger() ?: 3
    logger("Installed hub with settings: ${settings} ", "debug")
    
    def pattern = ~/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/
    def portpatt = ~/\d+/

    if ( (state.directIP.startsWith("http") || state.directIP ==~ pattern) && state.directPort ==~ portpatt ) {
        postHub(state.directIP, state.directPort, "initialize", "", "", "", "", "")
        logger("state changes will be posted to HP at IP: ${state.directIP}:${state.directPort} ", "info")

    } else {
        state.directIP = "0"
    }

    if ( (state.directIP2.startsWith("http") || state.directIP2 ==~ pattern) && state.directPort2 ==~ portpatt ) {
        postHub(state.directIP2, state.directPort2, "initialize", "", "", "", "", "")
        logger("state changes will also be posted to HP at: ${state.directIP2}:${state.directPort2} ", "info")
    } else {
        state.directIP2 = "0"
    }

    if ( (state.directIP3.startsWith("http") || state.directIP3 ==~ pattern) && state.directPort3 ==~ portpatt ) {
        postHub(state.directIP3, state.directPort3, "initialize", "", "", "", "", "")
        logger("state changes will also be posted to HP at: ${state.directIP3}:${state.directPort3} ", "info")
    } else {
        state.directIP3 = "0"
    }

    // register callbacks if one of the two is available
    if ( state.directIP!="0" || state.directIP2!="0" || state.directIP3!="0" ) {
        registerAll()
    } else {
        logger("state changes will not be posted to HP because no server IP was provided", "info")
    }
}

private String getPrefix() {
    def hubpre = 'h_'
    return hubpre
}

def configureHub() {
    if (!state.accessToken) {
        state.accessToken = createAccessToken()
    }
    // hubUID
    def hubip = app.getLocalApiServerUrl() 
    def cloudhubip = app.getApiServerUrl()
    state.endpt = app.getFullLocalApiServerUrl()
    def cloudendpt = app.getFullApiServerUrl()
    state.hubid = app.getHubUID() 

    logger("Use this information on the Auth page of HousePanel.", "info")
    logger("Hubitat Hub IP = ${hubip}", "info")
    logger("Hubitat Cloud Hub IP = ${cloudhubip}", "info")
    logger("Hubitat EndPoint = ${state.endpt}", "info")
    logger("Hubitat Cloud EndPoint = ${cloudendpt}", "info")
    logger("Hub ID = ${state.hubid}", "info")
    logger("Access Token = ${state.accessToken}, use this in useraccess field, or the Access Token can be obtained via OAUTH flow", "info")

    logger("Other useful information to know", "debug")
    logger("IP Address = ${state.directIP}", "debug")
    logger("webSocket Port = ${state.directPort}", "debug")
    logger("Alt IP Address = ${state.directIP2}", "debug")
    logger("Alt webSocket Port = ${state.directPort2}", "debug")
    logger("3rd IP Address = ${state.directIP3}", "debug")
    logger("3rd webSocket Port = ${state.directPort3}", "debug")
    logger("date Timezone for events = ${state.tz}", "debug")
    logger("date Format for events = ${state.dateFormat}", "debug")
}

def addHistory(resp, item) {
    if (resp ) {
        
        // try {
        //     def start = new Date() - 7
        //     def thestates = item.eventsSince(start,["max":4])
        //     def i = 0;
        //     def priorval = ""
        //     def tz = TimeZone.getTimeZone( state.tz ?: "America/Los_Angeles" )
        //     thestates.each {
        //         if ( it.value!=priorval && it.value?.length()<120 ) {
        //             i++
        //             def evtvalue = it.value + " " + it.date.format(state.dateFormat ?: "M/dd h:mm", tz)
        //             resp.put("event_${i}", evtvalue )
        //             priorval = it.value
        //         }
        //     }
        // } catch (e) {
        //     logger("Cannot retrieve history for device ${item.displayName}", "debug")
        // }
        // also add in a status unless this device has native status field
        if ( item && !resp["status_"] ) {
            try {
                resp.put("status_", item?.getStatus() ?: "UNKNOWN" )
            } catch(e) {
                resp.put("status_", "UNKNOWN")
                log.error e
            }
        } else {
            resp.put("status_", "ACTIVE")
        }
    }
    return resp
}

def addBattery(resp, item) {
    addAttr(resp, item, "battery")
}

def addAttr(resp, item, attr) {
    if ( resp && item && item.hasAttribute(attr) ) {
        resp.put(attr, item.currentValue(attr))
    }
    return resp
}

def getSwitch(swid, item=null) {
    getThing(myswitches, swid, item)
}

def getDimmer(swid, item=null) {
    def resp = getThing(mydimmers, swid, item)
    resp.put("_DIM","DIM")
    resp.put("_BRIGHTEN","BRIGHTEN")
    return resp
}

def getBulb(swid, item=null) {
    def resp = getThing(mybulbs, swid, item)
    resp.put("_DIM","DIM")
    resp.put("_BRIGHTEN","BRIGHTEN")
    return resp
}

def getActuator(swid, item=null) {
    getThing(myactuators, swid, item)
}

def getButton(swid, item=null) {
    getThing(mybuttons, swid, item)
}

def getMotion(swid, item=null) {
    getThing(mymotions, swid, item)
}

def getContact(swid, item=null) {
    getThing(mycontacts, swid, item)
}

def getLock(swid, item=null) {
    getThing(mylocks, swid, item)
}

def getShade(swid, item=null) {
    def resp = getThing(myshades, swid, item)
    // resp.put("_stop","stopPositionChange")
    resp.put("_RAISE","RAISE")
    resp.put("_LOWER","LOWER")
    return resp
}

// this was updated to use the real key names so that push updates work
// note -changes were also made in housepanel.php and elsewhere to support this
def getMusic(swid, item=null) {
    getThing(mymusics, swid, item)
}

def getAudio(swid, item=null) {
    def raw = getThing(myaudios, swid, item)
    logger(raw, "trace" )
    
    // lets put it in the desired order
    def resp = [name: raw.name, audioTrackData: raw.audioTrackData,
        _rewind: raw._rewind, _previousTrack: raw._previousTrack,
        _pause: raw._pause, _play: raw._play, _stop: raw._stop,
        _nextTrack: raw._nextTrack, _fastForward: raw._fastForward,
        playbackStatus: raw.playbackStatus,
        _mute: raw._mute?:"mute", _unmute: raw._unmute?:"unmute", 
        _muteGroup: raw._muteGroup, _unmuteGroup: raw._unmuteGroup, 
        _volumeDown: raw._volumeDown, _volumeUp: raw._volumeUp,
        _groupVolumeDown: raw._groupVolumeDown, _groupVolumeUp: raw._groupVolumeUp,
        volume: raw.volume,
        mute: raw.mute, groupRole: raw.groupRole]

    resp = addHistory(resp, raw)
    return resp
}

// this was updated to use the real key names so that push updates work
// note -changes were also made in housepanel.php and elsewhere to support this
def getThermostat(swid, item=null) {
    def resp = getThing(mythermostats, swid, item)
    resp.put("_heat", "heat")
    resp.put("_cool", "cool")
    resp.put("_auto", "auto")
    resp.put("_off", "off")
    return resp
}

// use absent instead of "not present" for absence state
def getPresence(swid, item=null) {
    getThing(mypresences, swid, item)
}

def getWater(swid, item=null) {
    getThing(mywaters, swid, item)
}

def getValve(swid, item=null) {
    getThing(myvalves, swid, item)
}
def getDoor(swid, item=null) {
    getThing(mydoors, swid, item)
}
def getGarage(swid, item=null) {
    getThing(mygarages, swid, item)
}

def getIlluminance(swid, item=null) {
    item = item ? item : myilluminances.find{it.id == swid }
    def resp = false
    if ( item ) {
        resp = [name: item.displayName]
        resp = addBattery(resp, item)
        resp.put("illuminance", item.currentValue("illuminance") )
        resp = addHistory(resp, item)
    }
    return resp
}
def getSmoke(swid, item=null) {
    getThing(mysmokes, swid, item)
}

// return temperature for this capability and humidity if it has one
def getTemperature(swid, item=null) {
    item = item ? item : mytemperatures.find{it.id == swid }
    def resp = false
    if ( item ) {
        resp = [name: item.displayName]
        resp = addBattery(resp, item)
        resp.put("temperature", item.currentValue("temperature") )
        if ( item.hasAttribute("humidity") ) {
            resp.put("humidity", item.currentValue("humidity") )
        }
        resp = addHistory(resp, item)
    }
    return resp
}

def getWeather(swid, item=null) {
    def resp = getDevice(myweathers, swid, item)
    // if ( !resp ) {
    //     resp = getDevice(myaccuweathers, swid, item)
    // }
    return resp
}

def getOther(swid, item=null) {
    getThing(myothers, swid, item)
}

def getPower(swid, item=null) {
    def resp = getThing(mypowers, swid, item)
    try {
        state.powervals[swid] = Float.valueOf(resp.power)
    } catch (e) {
        state.powervals[swid] = 0.0
    }
    return resp
}

def getMyMode(swid, item=null) {
    def curmode = location.getCurrentMode()
//    def resp = [ name: "Mode ${swid}", sitename: location.getName(), themode: curmode?.getName() ];
    def resp = [ name: "Mode", sitename: location.getName(), themode: curmode?.getName() ];
    def allmodes = location.getModes()
    for (defcmd in allmodes) {
        def modecmd = defcmd.getName()
        resp.put("_${modecmd}",modecmd)
    }
    return resp
}

def getHSMState(swid, item=null) {
    // uses Hubitat specific call for HSM per 
    // https://community.hubitat.com/t/hubitat-safety-monitor-api/934/11
    def cmds = ["armAway", "armHome", "armNight", "disarm", "armRules", "disarmRules", "disarmAll", "armAll", "cancelAlerts"]
    def keys = ["armedAway", "armedHome", "armedNight", "disarmed"]
    // def keynames = ["Away", "Home", "Night", "Disarmed"]
    
    def key = location.hsmStatus ?: false
    def resp
    
    if ( !key ) {
        resp = [name : "Hubitat Safety Monitor", state: "Not Installed", "status_":"OFFLINE"]
        logger("location hsmStatus is invalid; it is not installed","debug")
    } else {
        resp = [name : "Hubitat Safety Monitor", state: key, "status_":"ONLINE"]
        logger("location hsmStatus returned: ${key}","debug")
        for (defcmd in cmds) {
            resp.put("_${defcmd}",defcmd)
        }
    }
    return resp
}

// change pistonName to name to be consistent
// but retain original for backward compatibility reasons
def getPiston(swid, item=null) {
    item = item ? item : webCoRE_list().find{it.id == swid}
    def resp = [name: item.name, pistonName: "idle"]
    return resp
}

// a generic device getter to streamline code
def getDevice(mydevices, swid, item=null) {
    def resp = false
    if ( mydevices ) {
    	item = item ? item : mydevices.find{it.id == swid }
    	if (item) {
            resp = [:]
            def attrs = item.getSupportedAttributes()
            attrs.each {att ->
                try {
                    def attname = att.name
                    def attval = item.currentValue(attname)
                    resp.put(attname,attval)
                } catch (e) {
                    logger("Attempt to read device attribute for ${swid} failed ${e}", "error")
                }
            }
    	}

        def reserved = ignoredCommands()
        item.getSupportedCommands().each { comm ->
            try {
                def comname = comm?.toString()
                def nparms = comm?.parameters?.size
                if ( nparms == null ) { nparms = 0 }
                if ( nparms==0 && !reserved.contains(comname)) {
                    resp.put("_"+comname, comname)
                } else {
                    logger("Hubitat skipped command: ${comname} with ${nparms} parameters","trace")
                }
            } catch (ex) {
                logger("Attempt to read device command for ${swid} failed ${ex}", "error")
            }
        }
        resp = addHistory(resp, item)
    }
    return resp
}

def ignoredAttributes() {
    // thanks to the authors of HomeBridge for this list
    def ignore = [
        'DeviceWatch-DeviceStatus', 'DeviceWatch-Enroll', 'checkInterval', 'healthStatus', 'devTypeVer', 'dayPowerAvg', 'apiStatus', 'yearCost', 'yearUsage','monthUsage', 'monthEst', 'weekCost', 'todayUsage',
        'supportedPlaybackCommands', 'groupPrimaryDeviceId', 'groupId', 'supportedTrackControlCommands', 'presets', "released",
        'maxCodeLength', 'maxCodes', 'readingUpdated', 'maxEnergyReading', 'monthCost', 'maxPowerReading', 'minPowerReading', 'monthCost', 'weekUsage', 'minEnergyReading',
        'codeReport', 'scanCodes', 'verticalAccuracy', 'horizontalAccuracyMetric', 'altitudeMetric', 'latitude', 'distanceMetric', 'closestPlaceDistanceMetric',
        'closestPlaceDistance', 'leavingPlace', 'currentPlace', 'codeChanged', 'codeLength', 'lockCodes', 'horizontalAccuracy', 'bearing', 'speedMetric',
        'speed', 'verticalAccuracyMetric', 'altitude', 'indicatorStatus', 'todayCost', 'longitude', 'distance', 'previousPlace','closestPlace', 'places', 'minCodeLength',
        'arrivingAtPlace', 'lastUpdatedDt', 'firmware', 'firmware0', 'firmware1', 'lastEvent', 'lastActivity', 'groups',
        'commStatus', 'bypassed', 'connectivity', 'tempScale', 'lqi', 'rssi', 'batteryVoltage'
    ]
    return ignore
}

def ignoredCommands() {
    // "groupVolumeUp", "groupVolumeDown", "muteGroup", "unmuteGroup",
    // "indicatorWhenOn","indicatorWhenOff","indicatorNever", "stopLevelChange",
    def ignore = ["setLevel","setHue","setSaturation","setColorTemperature","setColor","setAdjustedColor",
                  "enrollResponse","ping","configure","setAssociationGroup","setConfigParameter","release",
                  "reloadAllCodes","unlockWithTimeout","markDeviceOnline","markDeviceOffline","updateFirmware"
                  ]
    return ignore
}

// make a generic thing getter to streamline the code
def getThing(things, swid, item=null) {
    item = item ? item : things?.find{it.id == swid }
    def resp = item ? [:] : false
    def reservedcap = ignoredAttributes()
    if ( item ) {
        resp.put("name",item.displayName)
        item.getSupportedAttributes().each{attr -> 
            try {
                def othername = attr.name
                if ( othername && !reservedcap.contains(othername) ) {
                    def othervalue = item.currentValue(othername, true)
                    resp.put(othername,othervalue)
                }
            } catch (ex) {
                logger("Attempt to read attribute for ${swid} failed ${ex}", "error")
            } 
        }

        def reserved = ignoredCommands()
        // the commented code works but it gives commands that requires parameters
        // fixed to weed out commands with parameters
        item.getSupportedCommands().each { comm ->
            try {
                def comname = comm.toString()
                def nparms = comm.parameters?.size
                if ( nparms == null ) { nparms = 0 }
                if ( !nparms && !reserved.contains(comname)) {
                    resp.put("_"+comname, comname)
                } else {
                    logger("skipped command: ${comname} with ${nparms} parameters","debug")
                }
            } catch (ex) {
                logger("Attempt to read command for ${swid} failed ${ex}", "error")
            }
        }

        // this code below was used before I figured out how to get parameters above
        // def commoncommands = ["on","off","flash","open","close","start","stop","stopPositionChange",
        //                       "refresh","both","siren","strobe","push","hold","doubleTap","poll","getDings",
        //                       "setPreviousEffect","setNextEffect","lock","unlock","beep","setMotion"]
        // commoncommands.each { comm ->
        //     if ( item.hasCommand(comm) ) {
        //         resp.put("_"+comm, comm)
        //     }
        // }

        resp = addHistory(resp, item)
    }
    
    // fix color
    if ( resp["hue"] && resp["saturation"] && resp["level"]) {
        def h = resp["hue"].toInteger()
        def s = resp["saturation"].toInteger()
        def v = resp["level"].toInteger()
        resp["hue"] = h
        resp["saturation"] = s
        resp["level"] = v
        h = Math.round((h*360)/100)
        def newcolor = hsv2rgb(h, s, v)
        resp["color"] ? resp["color"] = newcolor : resp.put("color", newcolor)
    }
    
    return resp
}

// make a generic thing list getter to streamline the code
def getThings(resp, things, thingtype) {
    def n  = things ? things.size() : 0
    logger("Number of things of type ${thingtype} = ${n}", "debug")
    things?.each {
        try {
            def val = getThing(things, it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: thingtype]
        } catch (e) {}
    }
    return resp
}

def logStepAndIncrement(step)
{
    logger("Debug ${step}", "trace")
    return step+1
}
// This retrieves and returns all things
// used up front or whenever we need to re-read all things
def getAllThings() {

    state.powervals = [test: "test"]
    def resp = []
    def run = 1
    run = logStepAndIncrement(run)
    resp = getSwitches(resp)
    run = logStepAndIncrement(run)
    resp = getDimmers(resp)
    run = logStepAndIncrement(run)
    resp = getShades(resp)
    run = logStepAndIncrement(run)
    resp = getButtons(resp)
    run = logStepAndIncrement(run)
    resp = getBulbs(resp)
    run = logStepAndIncrement(run)
    resp = getContacts(resp)
    run = logStepAndIncrement(run)
    resp = getDoors(resp)
    run = logStepAndIncrement(run)
    resp = getGarages(resp)
    run = logStepAndIncrement(run)
    resp = getLocks(resp)
    run = logStepAndIncrement(run)
    resp = getMotions(resp)
    run = logStepAndIncrement(run)
    resp = getPresences(resp)
    run = logStepAndIncrement(run)
    resp = getThermostats(resp)
    run = logStepAndIncrement(run)
    resp = getTemperatures(resp)
    run = logStepAndIncrement(run)
    resp = getIlluminances(resp)
    run = logStepAndIncrement(run)
    resp = getValves(resp)
    run = logStepAndIncrement(run)
    resp = getWaters(resp)
    run = logStepAndIncrement(run)
    resp = getMusics(resp)
    run = logStepAndIncrement(run)
    resp = getAudios(resp)
    run = logStepAndIncrement(run)
    resp = getSmokes(resp)
    run = logStepAndIncrement(run)
    resp = getModes(resp)
    run = logStepAndIncrement(run)
    resp = getHSMStates(resp)
    run = logStepAndIncrement(run)
    resp = getOthers(resp)
    run = logStepAndIncrement(run)
    resp = getActuators(resp)
    run = logStepAndIncrement(run)
    resp = getPowers(resp)

    // optionally include pistons based on user option
    if (state.usepistons) {
        run = logStepAndIncrement(run)
        resp = getPistons(resp)
    }

    run = logStepAndIncrement(run)
    resp = getVariables(resp)

    return resp
}

def getVariables(resp) {
    state.globalVars = getAllGlobalVars()
    def vals = [:]
    def varlist = []
    def vid = "${state.prefix}variables"
    state.globalVars.each { String varname, Map infomap ->

        if ( settings["var_${varname}"] ) {
            def theval = infomap["value"]
            def vartype = infomap["type"]
        
            // fix up times and dates if they are only time or only date
            if ( vartype == "datetime" ) {
                if ( theval.startsWith("9999") ) {
                    // time only:  9999-99-99T14:25:09.009-0700
                    theval = theval.substring(11)
                } else if ( theval.endsWith("9999") ) {
                    // date only: 2022-10-13T99:99:99:999-9999
                    theval = theval.substring(0,10)
                }
            }

            // add only the selected variables and their types as fields to the single variable tile
            // the types will be hidden from display by default since it starts with "uom_"
            varlist << varname
            vals.put( varname, "${theval}" )
            vals.put( "uom_${varname}", "${vartype}")
            logger ("including variable ${varname} value: ${theval}","debug")
        }
    }

    if ( varlist.size() ) {
        addInUseGlobalVar( varlist )
        resp << [name: "Variables", id: vid, value: vals, type: "variables"]
    }
    return resp
}

def renameVariable(String oldName, String newName) {
    def vid = "${state.prefix}variables"
    def resp = []
    resp = getVariables(resp)
    def pvalue = resp[0]

    postHub(state.directIP, state.directPort, "update", "Variables", vid, oldName, "variables", pvalue)
    postHub(state.directIP2, state.directPort2, "update", "Variables", vid, oldName, "variables", pvalue)
    postHub(state.directIP3, state.directPort3, "update", "Variables", vid, oldName, "variables", pvalue)
}

// modified to only return one mode tile
def getModes(resp) {
    def vals = ["mode"]
    try {
        vals.each {
            def modeid = "${state.prefix}${it}"
            def val = getMyMode(modeid)
            resp << [name: val.name, id: modeid, value: val, type: "mode"]
        }
    } catch (e) {
        log.debug e
    }
    return resp
}

def getHSMStates(resp) {
    logger("Getting Hubitat Safety Monitor state for Hubitat Hub","debug");
    try{
        def val = getHSMState("${state.prefix}hsm")
        if ( val ) {
            resp << [name: "Hubitat Safety Monitor", id: "${state.prefix}hsm", value: val, type: "hsm"]
        }
    } catch (e) {}
    return resp
}

def getPistons(resp) {
    def plist = webCoRE_list()
    logger("Number of pistons = " + plist?.size() ?: 0, "debug")
    try {
        plist?.each {
            def val = getPiston(it.id, it)
            resp << [name: it.name, id: it.id, value: val, type: "piston"]
        }
    } catch (e) {}
    return resp
}

def getSwitches(resp) {
    try {
        myswitches?.each {
            def multivalue = getSwitch(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "switch" ]
        }
    } catch (e) {}
    return resp
}

def getBulbs(resp) {
    getThings(resp, mybulbs, "bulb")
}

def getDimmers(resp) {
    getThings(resp, mydimmers, "switchlevel")
}

def getMotions(resp) {
    getThings(resp, mymotions, "motion")
}

def getContacts(resp) {
    getThings(resp, mycontacts, "contact")
}

def getButtons(resp) {
    getThings(resp, mybuttons, "button")
}

def getActuators(resp) {
    getThings(resp, myactuators, "actuator")
}

def getShades(resp) {
    getThings(resp, myshades, "shade")
}

def getLocks(resp) {
    try {
        mylocks?.each {
            def multivalue = getLock(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "lock"]
        }
    } catch (e) {}
    return resp
}

def getMusics(resp) {
    try {
        mymusics?.each {
            def multivalue = getMusic(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "music"]
        }
    } catch (e) {}
    
    return resp
}

def getAudios(resp) {
    try {
        myaudios?.each {
            def multivalue = getAudio(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "audio"]
        }
    } catch (e) {}
    
    return resp
}

def getThermostats(resp) {
    try {
        mythermostats?.each {
            def multivalue = getThermostat(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "thermostat" ]
        }
    } catch (e) {}
    return resp
}

def getPresences(resp) {
    try {
        mypresences?.each {
            def multivalue = getPresence(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "presence"]
        }
    } catch (e) {}
    return resp
}
def getWaters(resp) {
    getThings(resp, mywaters, "water")
}
def getValves(resp) {
    getThings(resp, myvalves, "valve")
}
def getDoors(resp) {
    getThings(resp, mydoors, "door")
}
def getGarages(resp) {
    getThings(resp, mygarages, "garage")
}
def getIlluminances(resp) {
    try {
        myilluminances?.each {
            def val = getIlluminance(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "illuminance"]
        }
    } catch (e) {}
    return resp

}
def getSmokes(resp) {
    getThings(resp, mysmokes, "smoke")
}
def getTemperatures(resp) {
    try {
        mytemperatures?.each {
            def val = getTemperature(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "temperature"]
        }
    } catch (e) {}
    return resp
}

def getOthers(resp) {
    getThings(resp, myothers, "other")
}

def getPowers(resp) {
    try {
        mypowers?.each {
            def val = getPower(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "power"]
        }
    } catch (e) {
        log.error e
    }
    return resp
}

def getHubInfo() {
    def resp =  [ sitename: location.getName(),
                  hubId: state.hubid,
                  accessToken: state.accessToken,
                  endpt: state.endpt,
                  hubtype: "Hubitat" ]
    return resp
}

def autoType(swid) {
    def swtype
    swid = swid.toInteger()

    if ( mydimmers?.find{it.id.toInteger() == swid } ) { swtype= "switchlevel" }
    else if ( mybulbs?.find{it.id.toInteger() == swid } ) { swtype= "bulb" }
    else if ( myswitches?.find{it.id.toInteger() == swid } ) { swtype= "switch" }
    else if ( mybuttons?.find{it.id.toInteger() == swid } ) { swtype= "button" }
    else if ( mylocks?.find{it.id.toInteger() == swid } ) { swtype= "lock" }
    else if ( mymusics?.find{it.id.toInteger() == swid } ) { swtype= "music" }
    else if ( myaudios?.find{it.id.toInteger() == swid } ) { swtype= "audio" }
    else if ( mythermostats?.find{it.id.toInteger() == swid} ) { swtype = "thermostat" }
    else if ( mypresences?.find{it.id.toInteger() == swid } ) { swtype= "presence" }
    else if ( myweathers?.find{it.id.toInteger() == swid } ) { swtype= "weather" }
    // else if ( myaccuweathers?.find{it.id.toInteger() == swid } ) { swtype= "weather" }
    else if ( mymotions?.find{it.id.toInteger() == swid } ) { swtype= "motion" }
    else if ( mydoors?.find{it.id.toInteger() == swid } ) { swtype= "door" }
    else if ( mygarages?.find{it.id.toInteger() == swid } ) { swtype= "garage" }
    else if ( mycontacts?.find{it.id.toInteger() == swid } ) { swtype= "contact" }
    else if ( mywaters?.find{it.id.toInteger() == swid } ) { swtype= "water" }
    else if ( myvalves?.find{it.id.toInteger() == swid } ) { swtype= "valve" }
    else if ( myilluminances?.find{it.id.toInteger() == swid } ) { swtype= "illuminance" }
    else if ( mysmokes?.find{it.id.toInteger() == swid } ) { swtype= "smoke" }
    else if ( mytemperatures?.find{it.id.toInteger() == swid } ) { swtype= "temperature" }
    else if ( mypowers?.find{it.id.toInteger() == swid } ) { swtype= "power" }
    else if ( myshades?.find{it.id.toInteger() == swid } ) { swtype= "shade" }
    else if ( myothers?.find{it.id.toInteger() == swid } ) { swtype= "other" }
    else if ( myactuators?.find{it.id.toInteger() == swid } ) { swtype= "actuator" }
    else if ( swid=="${state.prefix}hsm" ) { swtype= "hsm" }
    else if ( swid=="${state.prefix}mode" ) { swtype= "mode" }
    else if ( state.usepistons && webCoRE_list().find{it.id.toInteger() == swid} ) { swtype= "piston" }
    else { swtype = "" }
    
    logger("swid = ${swid} swtype = ${swtype}","debug")

    return swtype
}

// this performs ajax action for clickable tiles
def doAction() {
    // returns false if the item is not found
    // otherwise returns a JSON object with the name, value, id, type
    def cmd = params.swvalue
    def swid = params.swid
    def swtype = params.swtype
    def swattr = params.swattr
    def subid = params.subid
    def cmdresult = false
    logger("doaction params: cmd= $cmd type= $swtype id= $swid subid= $subid attr= $swattr", "debug")
   
    // get the type if auto is set
    if ( (swtype=="auto" || swtype=="none" || !swtype) && swid ) {
        swtype = autoType(swid)
    } else if ( swid=="" || swid==null || swid==false ) {
        return false
    }

    switch (swtype) {
      case "audio" :
        cmdresult = setAudio(swid, cmd, swattr, subid)
        break
        
      case "switch" :
        cmdresult = setSwitch(swid, cmd, swattr, subid)
        break

      case "bulb" :
        cmdresult = setBulb(swid, cmd, swattr, subid)
        break

      case "switchlevel" :
        cmdresult = setDimmer(swid, cmd, swattr, subid)
        break

      case "lock" :
        cmdresult = setLock(swid, cmd, swattr, subid)
        break

      case "shade" :
        cmdresult = setShade(swid, cmd, swattr, subid)
        break

      case "thermostat" :
        cmdresult = setThermostat(swid, cmd, swattr, subid)
        break

      case "music" :
        cmdresult = setMusic(swid, cmd, swattr, subid)
        break

      // note: this requires a special handler for motion to manually set it
      case "motion" :
        cmdresult = setMotion(swid, cmd, swattr, subid)
        break

      case "mode" :
        cmdresult = setMode(swid, cmd, swattr, subid)
        break

      case "shm" :
        cmdresult = setSHMState(swid, cmd, swattr, subid)
        break

      case "hsm":
        cmdresult = setHSMState(swid, cmd, swattr, subid)
        break;
 
      case "valve" :
        cmdresult = setValve(swid, cmd, swattr, subid)
        break

      case "contact":
      	 cmdresult = setContact(swid, cmd, swattr, subid)
         break

      case "door" :
      	 cmdresult = setDoor(swid, cmd, swattr, subid)
         break

      case "garage" :
      	 cmdresult = setGarage(swid, cmd, swattr, subid)
         break

      case "piston" :
        if ( state.usepistons ) {
            webCoRE_execute(swid)
            cmdresult = getPiston(swid)
        }
        break

      case "water" :
        cmdresult = setWater(swid, cmd, swattr, subid)
        break

      case "button":
        cmdresult = setButton(swid, cmd, swattr, subid)
        break

      case "actuator":
        def item = myactuators.find{it.id == swid }
        cmdresult = setOther(swid, cmd, swattr, subid, item)
        break

      case "other" :
        cmdresult = setOther(swid, cmd, swattr, subid)
        break
        
      case "power":
        cmdresult = getPower(swid)
        break

      case "presence":
        cmdresult = setPresence(swid, cmd, swattr, subid)
        break

      case "weather":
        def item = myweathers.find{it.id == swid }
        if ( cmd && item?.hasCommand(cmd) ) {
            item."$cmd"()
        }
        cmdresult = getWeather(swid)
        break
    
      case "variables":
        cmdresult = setVariable(swid, cmd, swattr, subid)
        break

      default:
        cmdresult = setOther(swid, cmd, swattr, subid)
        break

    }
    logger("doAction results: " + cmdresult.toString() , "debug");
    return cmdresult
}

def doQuery() {
    def swid = params.swid
    def swtype = params.swtype
    def cmdresult = false

    // get the type if auto is set
    if ( swid=="all" ) {
        swtype = "all"
    } else if ( (swtype=="auto" || swtype=="none" || !swtype) && swid ) {
        swtype = autoType(swid)
    } else if ( swid=="" || swid==null || swid==false ) {
        return false
    }

    switch(swtype) {

    // special case to return an array of all things
    // each case below also now includes multi-item options for the API
    case "all" :
        cmdresult = getAllThings()
        break

    case "actuator" :
        cmdresult = getActuator(swid)
        break

    case "audio" :
        cmdresult = getAudio(swid)
        break
         
    case "button" :
    	cmdresult = getButton(swid)
        break
        
    case "switch" :
        cmdresult = getSwitch(swid)
        break
         
    case "bulb" :
        cmdresult = getBulb(swid)
        break
         
    case "switchlevel" :
        cmdresult = getDimmer(swid)
        break

    case "shade" :
        cmdresult = getShade(swid)
        break;
         
    case "motion" :
        cmdresult = getMotion(swid)
        break
        
    case "contact" :
        cmdresult = getContact(swid)
        break
      
    case "lock" :
        cmdresult = getLock(swid)
        break
         
    case "thermostat" :
        cmdresult = getThermostat(swid)
        break
         
    case "music" :
        cmdresult = getMusic(swid)
        break
        
    case "presence" :
        cmdresult = getPresence(swid)
        break
         
    case "water" :
        cmdresult = getWater(swid)
        break
         
    case "valve" :
        cmdresult = getValve(swid)
        break
        
    case "door" :
        cmdresult = getDoor(swid)
        break
        
    case "illuminance" :
        cmdresult = getIlluminance(swid)
        break
        
    case "smoke" :
        cmdresult = getSmoke(swid)
        break
        
    case "temperature" :
        cmdresult = getTemperature(swid)
        break
        
    case "weather" :
        cmdresult = getWeather(swid)
        break
        
    case "other" :
    	cmdresult = getOther(swid)
        break
        
    case "power":
        cmdresult = getPower(swid)
        break
        
    case "mode" :
        cmdresult = getMyMode(swid)
        break
        
    case "hsm" :
        cmdresult = getHSMState(swid)
        break

    }
   
    logger("doQuery: type= $swtype id= $swid result= $cmdresult", "debug");
    return cmdresult
}

def setSwitch(swid, cmd, swattr, subid) {
    logcaller("setSwitch", swid, cmd, swattr, subid)
    def resp = setGenericLight(myswitches, swid, cmd, swattr, subid)
    return resp
}

def setDoor(swid, cmd, swattr, subid) {
    logcaller("setDoor", swid, cmd, swattr, subid)
    setGenericDoor(mydoors, swid, cmd, swattr, subid)
}

def setContact(swid, cmd, swattr, subid) {
    logcaller("setContact", swid, cmd, swattr, subid)
    item  = mycontacts.find{it.id == swid }

    def resp = [:]
    if ( subid=="_on" && item.hasAttribute("switch") && item.hasCommand("on") ) {
        resp.put("switch", "on")
        item.on()
    } else if ( subid=="_off" && item.hasAttribute("switch") && item.hasCommand("off") ) {
        resp.put("switch", "off")
        item.off()
    } else if ( subid=="_open" && item.hasCommand("open")) {
        resp.put("contact", "open")
        item.open()
    } else if ( subid=="_close" && item.hasCommand("close")) {
        resp.put("contact", "closed")
        item.close()
    } else {
        resp.put("contact", item.currentValue("contact"))
    }

    if ( item.hasCommand("open") ) resp.put("_open","open");
    if ( item.hasCommand("close") ) resp.put("_close","close");
    if ( item.hasCommand("on") ) resp.put("_on","on");
    if ( item.hasCommand("off") ) resp.put("_off","off");
    return resp
}

def setGarage(swid, cmd, swattr, subid) {
    logcaller("setGarage", swid, cmd, swattr, subid)
    setGenericDoor(mygarages, swid, cmd, swattr, subid)
}

def setGenericDoor(things, swid, cmd, swattr, subid, item=null) {
    def newonoff
    def resp = false
    item  = item ? item : things.find{it.id == swid }
    if (item) {
        if ( subid=="door" && (cmd=="open" || cmd=="OPEN" || swattr.endsWith(" closed") || swattr.endsWith(" closing") ) ) {
            cmd = "open"
            newonoff = (subid=="door" && swattr.endsWith(" closed")) ? "opening" : "open";
        } else if ( subid=="door" && (cmd=="close" || cmd=="CLOSE" || swattr.endsWith(" open") || swattr.endsWith(" opening") ) ) {
            cmd = "close"
            newonoff = (subid=="door" && swattr.endsWith(" open")) ? "closing" : "closed";
        } else {
            if (subid.startsWith("_")) {
                cmd = subid.substring(1)
                subid = ""
                newonoff = cmd
            } else {
                if ( subid=="door" ) {
                    newonoff = (item.currentValue(subid)=="closed" ||
                                item.currentValue(subid)=="closing" )  ? "open" : "closed"
                    cmd = (newonoff == "open") ? "open" : "close"
                } else if ( subid=="switch" ) {
                    newonoff = (item.currentValue(subid)=="off")  ? "on" : "off"
                    cmd = (newonoff == "on") ? "on" : "off"
                } else {
                    newonoff = item.currentValue(subid)
                }
            }
        }
        // newonoff=="open" ? item.open() : item.close()
        // if command is valid, do it
        if ( item.hasCommand(cmd) ) {
            item."$cmd"()
        }
        // resp = [door: newonoff]
        resp = [:]
        if ( item.hasAttribute("contact") ) {
            resp.put("contact", item.currentValue("contact") )
        }
        if ( item.hasAttribute("door") ) {
            resp.put("door", item.currentValue("door") )
        }
        resp.put(subid, newonoff)
        if ( item.hasCommand("open") ) resp.put("_open","open");
        if ( item.hasCommand("close") ) resp.put("_close","close");
        if ( item.hasCommand("on") ) resp.put("_on","on");
        if ( item.hasCommand("off") ) resp.put("_off","off");

        // resp = addAttr(resp, item, "contact")
        // resp = addBattery(resp, item)
    }
    return resp
}

// shades are really different than doors and lights so had to write a special routine
def setShade(swid, cmd, swattr, subid) {
    logcaller("setShade", swid, cmd, swattr, subid)
    def item  = myshades.find{it.id == swid }
    def resp = false

    if (item ) {
        
        def newlevel = false
        def newposition = false
        def newonoff = item.currentValue("windowShade")
        def curposition = item.currentValue("position").toInteger()
        def newname = item.displayName

        if (subid.startsWith("_")) {
            cmd = subid.substring(1)
        }

        // handle cases where shade icon is clicked on - either opens or closes
        if ( subid=="windowShade" ) {
            if ( cmd=="close" || swattr.endsWith(" open" ) || (swattr.endsWith(" partially_open") && curposition >= 50) ) {
                cmd = "close"
                newonoff = "closed"
                item.close()
                if ( item.hasAttribute("position") ) {
                    newposition = 0
                    item.setPosition(newposition)
                    if ( item.hasAttribute("level") ) {
                        item.setLevel(newposition)
                }
                }
            } else if ( swattr.endsWith(" open" ) || (swattr.endsWith(" partially_open") && curposition >= 50) ) {
                cmd = "close"
                newonoff = "closing"
                newposition = 0
                if ( item.hasAttribute("level") ) {
                    newlevel = 0
                    }
            } else if ( swattr.endsWith(" open" ) || (swattr.endsWith(" partially_open") && curposition >= 50) ) {
                cmd = "close"
                newonoff = "closing"
                newposition = 0
                if ( item.hasAttribute("level") ) {
                    newlevel = 0
                }
            } else if ( cmd=="open" || swattr.endsWith(" closed") || (swattr.endsWith(" partially_open") && curposition < 50) ) {
                cmd = "open"
                newonoff = "open"
                newposition = 100
                item.open()
                if ( item.hasAttribute("position") ) {
                    newposition = 100
                    item.setPosition(newposition)
                    if ( item.hasAttribute("level") ) {
                        item.setLevel(newposition)
                    }
                }
            } else if ( item.hasCommand(cmd) ) {
                item."$cmd"()
            }

        } else if ( subid=="level-up" || subid=="position-up" || subid=="RAISE" || subid=="raise" ||
                    cmd=="level-up" || cmd=="position-up" || cmd=="RAISE" || cmd=="raise" ) {
            newposition = curposition
            def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
            if ( del > 10 ) { del = 10 }
            newposition = (newposition >= 100 - del) ? 100 : newposition - ( newposition % del ) + del
            // newlevel = (newlevel >= 95) ? 100 : newlevel - (newlevel % 5) + 5
            item.setPosition(newposition)
            if ( item.hasAttribute("level") ) {
                item.setLevel(newposition)
            }

        } else if ( subid=="level-dn" || subid=="position-dn" || subid=="LOWER" || subid=="lower" ||
                    cmd=="level-dn" || cmd=="position-dn" || cmd=="LOWER" || cmd=="lower" ) {

            // 
            newposition = curposition
            def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
            if ( del > 10 ) { del = 10 }
            // del = (newlevel % 5) == 0 ? 5 : newlevel % 5
            del = (newposition % del) == 0 ? del : newposition % del
            newposition = (newposition <= del) ? del : newposition - del
            item.setPosition(newposition)
            if ( item.hasAttribute("level") ) {
                item.setLevel(newposition)
            }

        // handle slider cases
        } else if ( ((subid=="level" || subid=="position") && cmd.isNumber()) || swattr.isNumber() ) {

            if ( swattr.isNumber() ) {
                newposition = swattr.toInteger()
            } else {
                newposition = cmd.toInteger()
            }
            newposition = (newposition >100) ? 100 : newposition
            newposition = (newposition < 0) ? 0 : newposition
            
            item.setPosition(newposition)
            if ( item.hasAttribute("level") ) {
                item.setLevel(newposition)
            }
            if ( newposition == 0 ) {
                newonoff = "closed"
            } else if ( newposition == 100 ) {
                newonoff = "open"
            } else {
                newonoff = "partially open"
            }

        } else if ( subid=="name" ) {
            newname = cmd

        // handle direct command cases and other edge casees such as API calls
        } else {

            // allow for name changes by using name in subid field (see below)
            if ( item.hasCommand(cmd) ) {
                if ( cmd == "open" ) {
                    newonoff = "open"
                    newposition = 100
                } else if ( cmd == "close" ) {
                    newonoff = "closed"
                    newposition = 0
                }
                item."$cmd"()

            // GUI can't send this but API can or a custom link can
            } else if (cmd=="toggle" ) {
                if ( newonoff=="closed" ) {
                    cmd = "open"
                    newonoff = "open"
                    newposition = 100
                } else {
                    cmd = "close"
                    newonoff = "closed"
                    newposition = 0
                }
                item."$cmd"()
            }
              
        }

        // return the fields that were changed
        resp = ["name": newname, "windowShade": newonoff]
        if ( newposition ) { 
            resp.put("position", newposition) 
            if ( item.hasAttribute("level") ) {
                resp.put("level", newposition)
            }
        }

    }
    return resp
}

// special function to set motion status
def setMotion(swid, cmd, swattr, subid) {
    def resp = false
    def newsw
    def item  = mymotions.find{it.id == swid }
    logcaller("setMotion", swid, cmd, swattr, subid)
    // anything but active will set the motion to inactive
    if (item && item.hasCommand("startmotion") && item.hasCommand("stopmotion") ) {
        if (cmd=="active" || cmd=="move") {
            item.startmotion()
            newsw = "active"
        } else {
            item.stopmotion()
            newsw = "inactive"
        }
        resp = [motion: newsw]
        resp = addBattery(resp, item)
    } else if (item) {
        resp = getMotion(item)
    }
    return resp
}

// replaced this code to treat bulbs as Hue lights with color controls
def setBulb(swid, cmd, swattr, subid) {
    logcaller("setBulb", swid, cmd, swattr, subid)
    def resp = setGenericLight(mybulbs, swid, cmd, swattr, subid)
    return resp
}

def setPresence(swid, cmd, swattr, subid) {
    logcaller("setPresence", swid, cmd, swattr, subid)
    def resp = false
    item  = item ? item : mypresences.find{it.id == swid }
    if ( item ) {
        if (subid.startsWith("_")) {
            cmd = subid.substring(1)
        }
        if ( item.hasCommand(cmd) ) {
            item."$cmd"()
            resp = getPresence(swid, item)
        } else {
            resp = getPresence(swid, item)
        }
    }
}

// new way of processing buttons using user provided button numbers
// a non-zero button number must be passed into cmd
// and the command signalled from the subid value
def setButton(swid, cmd, swattr, subid, item=null ) {
    logcaller("setButton", swid, cmd, swattr, subid, "debug")
    def resp = false
    def buttonnum = cmd.isNumber() ? cmd.toInteger() : 0
    item  = item ? item : mybuttons.find{it.id == swid }
    
    if ( item && buttonnum ) {
        // resp  = [button: cmd]
        if (subid.startsWith("_")) {
            def revmap = ["push": "pushed", "hold":"held", "doubleTap": "doubleTapped", "release": "released"]
            cmd = subid.substring(1)
            subid = revmap[cmd] ?: ""
        } else if ( subid == "numberOfButtons" ) {
            cmd = ""
        } else {
            def butmap = ["pushed": "push", "held":"hold", "doubleTapped": "doubleTap", "released": "release"]
            cmd = butmap[subid] ?: "";
        }

        log.info "cmd = ${cmd} subid = ${subid} buttonnum = ${buttonnum}"
        if ( item.hasCommand(cmd) ) {
            item."$cmd"(buttonnum)
        }
        if ( subid ) {
            resp = [:]
            resp.put(subid, buttonnum)
        }
    }

    // log.debug "findval = ${findval} resp = ${resp}"
    return resp
}

def setVariable(swid, cmd, swattr, subid ) {

    try {
        setGlobalVar(subid, cmd)
    } catch(e) {}
    def resp = [:]
    resp.put(subid, cmd)
    return resp
}

// other types have actions starting with _ 
// and we accommodate switches, shades, and api calls with valid cmd values
// replaced button check with full blown button call
def setOther(swid, cmd, swattr, subid, item=null ) {
    def resp = false
    def newsw
    item  = item ? item : myothers.find{it.id == swid }
    def lightflags = ["switch","level","hue","saturation","colorTemperature","color"]
    def doorflags = ["door","contact"]
    def buttonflags = ["pushed","held","doubleTapped","released"]
    
    if ( item ) {
        logcaller(item.getDisplayName(), swid, cmd, swattr, subid, "debug")
        if (subid.startsWith("_")) {
            subid = subid.substring(1)
            resp = [:]
            if ( item.hasCommand(subid) ) {
                item."$subid"()
                resp = getOther(swid, item)
            }
        } else if ( lightflags.contains(subid) ) {
            resp = setGenericLight(myothers, swid, cmd, swattr, subid, item)
        } else if ( doorflags.contains(subid) ) {
            resp = setGenericDoor(myothers, swid, cmd, swattr, subid, item)
        } else if ( subid=="windowShade" ) {
            resp = setShade(swid, cmd, swattr, subid)
        } else if ( buttonflags.contains(subid) ) {
            resp = setButton(swid, cmd, swattr, subid, item)
        } else if ( item.hasCommand(cmd) ) {
            item."$cmd"()
            resp = getOther(swid, item)
        } else {
            resp = getOther(swid, item)
        }
    }
    return resp
}

// control audio devices
// much like music but the buttons are real commands
def setAudio(swid, cmd, swattr, subid) {
    def resp = false
    def item  = myaudios.find{it.id == swid }
    
    if ( item ) {
        logcaller(item.getDisplayName(), swid, cmd, swattr, subid)
        resp = getAudio(swid, item)

        if ( (subid=="_mute" || subid=="mute") && swattr.contains(" unmuted" ) ) {
            item.mute()
            resp["mute"] = "muted"
        } else if ( (subid=="_unmute" || subid=="mute") && swattr.contains(" muted" ) ) {
            item.unmute()
            resp["mute"] = "unmuted"

        // handle volume and group volume up specially because their cmd ops don't work
        // down odly enough works but I put it here too just to make them consistent
        // note that this workaround only changes this item not the whole group
        } else if ( subid=="_groupVolumeUp" || subid=="_volumeUp" ) {
            def grpvol = item.currentValue("volume")
            grpvol = (grpvol > 95) ? 100 : grpvol + 5
            item.setVolume(grpvol)
            resp["volume"] = grpvol

        } else if ( subid=="_groupVolumeDown" || subid=="_volumeDown" ) {
            def grpvol = item.currentValue("volume")
            grpvol = (grpvol < 5) ? 0 : grpvol - 5
            item.setVolume(grpvol)
            resp["volume"] = grpvol

        } else if ( subid=="volume" ) {
            def newvol = item.currentValue("volume")
            try {
                newvol = cmd.toInteger()
            } catch (e) {
            }
            item.setVolume(newvol)
            resp["volume"] = newvol
        } else if (subid.startsWith("_")) {
            subid = subid.substring(1)
            if ( item.hasCommand(subid) ) {
                item."$subid"()
                resp = getAudio(swid, item)
                resp = getAudio(swid, item)
            }
        }
        else if ( item.hasCommand(cmd) ) {
            item."$cmd"()
            resp = getAudio(swid, item)
            resp = getAudio(swid, item)
        }
    }
    return resp
}

// handle water devices
def setWater(swid, cmd, swattr, subid) {
    logcaller("setWater", swid, cmd, swattr, subid)
    def resp = false
    def item  = mywaters.find{it.id == swid }
    if (item) {
        def newsw = item.currentValue
        if ( subid=="water" && swattr.endsWith(" dry") && item.hasCommand("wet") ) {
            item.wet()
        } else if ( subid=="water" && swattr.endsWith(" wet") && item.hasCommand("dry") ) {
            item.dry()
        } else if ( subid.startsWith("_") ) {
            subid = subid.substring(1)
            if ( item.hasCommand(subid) ) {
                item."$subid"()
            }
        } else if ( item.hasCommand(cmd) ) {
            item."$cmd"()
        }
        resp = getThing(mywaters, swid, item)
    }
    return resp

}

def setMode(swid, cmd, swattr, subid) {
    logcaller("setMode", swid, cmd, swattr, subid)
    def resp = false
    def newsw
    def idx
    def allmodes = location.getModes()
    
    // if the mode icon was clicked on or we send API themode as subid
    if ( subid=="themode" && swattr ) {
        def themode = swattr.substring(swattr.lastIndexOf(" ")+1)
        idx=allmodes.findIndexOf{it.name == themode}

        // first try to rotate the mode based on existing mode
        if (idx!=null) {
            idx = idx+1
            if (idx == allmodes.size() ) { idx = 0 }
            newsw = allmodes[idx].getName()

        // next try using whatever mode was sent as cmd
        } else {
            idx=allmodes.findIndexOf{it.name == cmd}
            if ( idx!=null) {
                newsw = allmodes[idx].getName()
            } else {
                newsw = allmodes[0].getName()
            }
        }

    // handle commands sent by GUI or user
    } else if (subid.startsWith("_")) {
        cmd = subid.substring(1)
        idx=allmodes.findIndexOf{it.name == cmd}
        newsw = (idx!=null) ? cmd : allmodes[0].getName()

    // finally use cmd sent directly if attr was missing
    } else if ( cmd ) {
        idx=allmodes.findIndexOf{it.name == cmd}
        newsw = (idx!=null) ? cmd : allmodes[0].getName()

    // default is to do set mode again to current
    } else {
        newsw = allmodes[0].getName()
    }

    logger("Mode changed to $newsw", "debug");
    location.setMode(newsw);
    resp =  [ themode: newsw ];
    
    return resp
}

def setSHMState(swid, cmd, swattr, subid){
    def cmds = ["away", "stay", "night", "off"]
    def keynames = ["Away", "Home", "Night", "Disarmed"]
    logcaller("setSHMState", swid, cmd, swattr, subid)

    // first handle toggling on icon in gui using attr information
    // default is disarm if something isn't understood
    if ( subid=="state" && swattr && swattr.startsWith("shm") ) {
        cmd = false
        def i = 0
        for (defkey in keynames) {
            i++
            if ( swattr.endsWith(defkey) ) {
                if ( i >= keynames.size() ) { i = 0 }
                cmd = cmds[i]
                break
            }
        }
        
        if ( !cmd ) {
            i = 0
            for (defkey in cmds) {
                i++
                if ( swattr.endsWith(defkey) ) {
                    if ( i >= cmds.size() ) { i = 0 }
                    cmd = cmds[i]
                    break
                }
            }
        }
        
    // handle commands sent by GUI
    } else if (subid.startsWith("_")) {
        cmd = subid.substring(1)
    }
    
    // mimic night by setting mode to night and changing to away
    def k = cmds.findIndexOf{ it == cmd }
    if ( k < 0 ) { k = 3 }
    def statusname = keynames[k]
    
    if ( cmd=="night" ) {
        cmd = "stay"
        // location.setMode("Night");
        logger("SHM Night mode set which acts just like Stay", "debug");
    }

    // handle API commands sent by name
    if ( cmd && cmds.contains(cmd) ) {
        sendLocationEvent(name: "alarmSystemStatus" , value : cmd )
    }

    
    logger("SHM state set to $cmd and given name= $statusname", "debug")
    def resp = [name : "Smart Home Monitor", state: statusname]
    for (defcmd in cmds) {
        resp.put("_${defcmd}",defcmd)
    }
    return resp
}

// def hsmStatusHandler(evt) {
//     log.info "HSM state set to ${evt.value}" + (evt.value=="rule" ? $evt.descriptionText : "" )
// }
// def hsmAlertHandler(evt) {
//     log.info "HSM alert: ${evt.value}"
// }

def setHSMState(swid, cmd, swattr, subid){

    logcaller("setHSMState", swid, cmd, swattr, subid)
    def key = location.hsmStatus?: false
    if ( !key ) {
        def noresp = [name : "Hubitat Safety Monitor", state: "Not Installed"]
        return noresp
    }
    
    def cmds = ["armAway", "armHome", "armNight", "disarm", "disarmAll", "cancelAlerts"]
    def keys = ["armingAway", "armingHome", "armingNight", "disarmed", "allDisarmed", "disarmed"]

    def states = ["armedAway", "armedHome", "armedNight", "disarmed"]


    // first handle toggling on icon in gui using attr information
    // use the keys array to accomodate friendly and native names of modes
    def i = 0
    if ( subid=="state" && swattr && swattr.startsWith("hsm") ) {

        if ( swattr.endsWith(" disarmed") ) {
            cmd = "armAway"
        } else if ( swattr.endsWith(" armedAway") ) {
            cmd = "armHome"
        } else if ( swattr.endsWith(" armedHome") ) {
            cmd = "armNight"
        } else if ( swattr.endsWith(" armedNight") ) {
            cnd = "disarm"
        } else {
            cmd = "disarm"
        }

    // handle commands sent by GUI or user
    } else if (subid.startsWith("_")) {
        cmd = subid.substring(1)
    }

    // deal with invalid names a user might give using api;the gui would never send anything invalid
    if ( !cmd || !cmds.contains(cmd) ) {
        cmd = "disarm"
    }
    
    // send command to change the alarm mode
    sendLocationEvent(name: "hsmSetArm", value: cmd)
    logger("HSM arm set with cmd= ${cmd}", "debug")

    def k = cmds.findIndexOf{ it == cmd }
    def resp = []
    if ( k >= 0 ) {
        resp = [state: keys[k]]
    }
    return resp
}

def setDimmer(swid, cmd, swattr, subid) {
    logcaller("setDimmer", swid, cmd, swattr, subid)
    def resp = setGenericLight(mydimmers, swid, cmd, swattr, subid)
    return resp
}

// handle functions for bulbs, dimmers, and lights
// hardened this to also handle regular switches
// this is way more complex than I like but it has to handle a bunch
// of potential GUI options for processing dimmers and colors
// up and down arrows, sliders, etc. 
// and it has to handle API calls that could have all sorts of options
def setGenericLight(mythings, swid, cmd, swattr, subid, item= null) {
    def resp = false
    item  = item ? item : mythings.find{it.id == swid }
    def hue = false
    def saturation = false
    def temperature = false
    def newcolor = false
    def newlevel = false
    def newname = item.displayName
    def swtrigger = "switch"
    
    if (item ) {
        
        // logcaller(item.getDisplayName(), swid, cmd, swattr, subid, "trace")
        def newonoff = item.currentValue("switch")

        // do this for link commands on switches that have secondary subid's
        if ( subid.startsWith("switch") ) {
            swtrigger = subid
            subid = "switch"
        }

        switch(subid) {
        
        // this branch is legacy - gui no longer sends toggle as attr
        // i left this in code since API could still send toggle as attr
        case "switch":
            if ( swattr.endsWith(" on" ) ) {
                cmd = "off"
            } else if ( swattr.endsWith(" flash" ) ) {
                cmd = "flash"
            } else if ( swattr.endsWith(" off" ) ) {
                cmd = "on"
            } else if ( cmd=="toggle" ) {
                cmd = newonoff=="off" ? "on" : "off"
            }
            newonoff = cmd
            break

        case "contact":
            if ( swattr.endsWith(" open" ) ) {
                cmd = "close"
            } else if ( swattr.endsWith(" closed" ) ) {
                cmd = "open"
            }
            newonoff = cmd
            break

        // handle cases where switches have buttons
        case "pushed":
        case "held":
        case "doubleTapped":
        case "released":
            return setButton(swid, cmd, swattr, subid, item)
            break

        case "toggle":
            newonoff = newonoff=="off" ? "on" : "off"
            cmd = newonoff
            break
        
        // enable name change
        case "name":
            newname = cmd
            cmd = ""
            break
         
        case "level-up":
        case "BRIGHTEN":
        case "brighten":
        case "_BRIGHTEN":
            if ( item.hasAttribute("level") ) {
                newlevel = item.currentValue("level")
                newlevel = newlevel.toInteger()

                def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
                if ( del > 10 ) { del = 10 }
                newlevel = (newlevel >= 100 - del) ? 100 : newlevel - ( newlevel % del ) + del
                // newlevel = (newlevel >= 95) ? 100 : newlevel - (newlevel % 5) + 5
                item.setLevel(newlevel)
                if ( item.hasAttribute("hue") && item.hasAttribute("saturation") && item.hasAttribute("color") ) {
                    def hue100 = item.currentValue("hue").toInteger()
                    def h = Math.round((hue100 * 360) / 100)
                    def s = item.currentValue("saturation").toInteger()
                    def v = newlevel
                    newcolor = hsv2rgb(h, s, v)
                    // item.setColor([hue: hue100, saturation: s, level: v])
                    logger("level command result: hue= ${hue100}, h= ${h} s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
                }
            }
            newonoff = "on"
            break
              
        case "level-dn":
        case "DIM":
        case "dim":
        case "_DIM":
            if ( item.hasAttribute("level") ) {
                newlevel = item.currentValue("level")
                newlevel = newlevel.toInteger()
                def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
                if ( del > 10 ) { del = 10 }
                // del = (newlevel % 5) == 0 ? 5 : newlevel % 5
                del = (newlevel % del) == 0 ? del : newlevel % del
                newlevel = (newlevel <= del) ? del : newlevel - del
                item.setLevel(newlevel)
                if ( item.hasAttribute("hue") && item.hasAttribute("saturation") && item.hasAttribute("color") ) {
                    def hue100 = item.currentValue("hue").toInteger()
                    def h = Math.round((hue100 * 360) / 100)
                    def s = item.currentValue("saturation").toInteger()
                    def v = newlevel
                    newcolor = hsv2rgb(h, s, v)
                    // item.setColor([hue:hue100, saturation: s, level: v])
                    logger("level command result: hue= ${hue100}, h= ${h} s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
                }
                newonoff = "on"
            } else {
                newonoff = "off"
            }
            break
         
        case "level":
            if ( cmd.isNumber() && item.hasAttribute("level") ) {
                newlevel = cmd.toInteger()
                newlevel = (newlevel >100) ? 100 : newlevel
                newlevel = (newlevel < 0) ? 0 : newlevel
                item.setLevel(newlevel)
                if ( item.hasAttribute("position") ) {
                    item.setPosition(newlevel)
                }
                if ( item.hasAttribute("hue") && item.hasAttribute("saturation") ) {
                    def hue100 = item.currentValue("hue").toInteger()
                    def h = Math.round((hue100 * 360) / 100)
                    def s = item.currentValue("saturation").toInteger()
                    def v = newlevel
                    newcolor = hsv2rgb(h, s, v)
                    // item.setColor([hue: hue100, saturation: s, level: v])
                    logger("level command result: hue= ${hue100}, h= ${h} s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
                }
                newonoff = (newlevel == 0) ? "off" : "on"
            }
            break
         
        case "hue-up":
                hue = item.currentValue("hue").toInteger()
                hue = (hue >= 95) ? 100 : hue - (hue % 5) + 5
                item.setHue(hue)
                def h = Math.round((hue * 360) / 100)
                def s = item.currentValue("saturation").toInteger()
                def v = item.currentValue("level").toInteger()
                newcolor = hsv2rgb(h, s, v)
                // item.setColor([hue:hue, saturation: s, level: v])
                newonoff = "on"
                logger("hue command result: hue= ${hue}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
            break
              
        case "hue-dn":
                hue = item.currentValue("hue").toInteger()
                def del = (hue % 5) == 0 ? 5 : hue % 5
                hue = (hue <= 5) ? 5 : hue - del
                item.setHue(hue)
                def h = Math.round((hue * 360) / 100)
                def s = item.currentValue("saturation").toInteger()
                def v = item.currentValue("level").toInteger()
                newcolor = hsv2rgb(h, s, v)
                // item.setColor([hue:hue, saturation: s, level: v])
                newonoff = (v == 0) ? "off" : "on"
                logger("hue command result: hue= ${hue}, h= ${h}, del= ${del} s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
            break
              
        case "hue":
                hue = item.currentValue("hue").toInteger()
                /* temperature drifts up so we cant use round down method */
                if ( cmd.isNumber() ) {
                    hue = cmd.toInteger()
                }
                item.setHue(hue)
                def h = Math.round((hue * 360) / 100)
                def s = item.currentValue("saturation").toInteger()
                def v = item.currentValue("level").toInteger()
                newcolor = hsv2rgb(h, s, v)
                // item.setColor([hue:hue, saturation: s, level: v])
                newonoff = (v == 0) ? "off" : "on"
                logger("hue command result: hue= ${hue}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
            break

        case "saturation-up":
                saturation = item.currentValue("saturation").toInteger()
                saturation = (saturation >= 95) ? 100 : saturation - (saturation % 5) + 5
                item.setSaturation(saturation)
                def hue100 = item.currentValue("hue").toInteger()
                def h = Math.round((hue100 * 360) / 100)
                def s = saturation
                def v = item.currentValue("level").toInteger()
                newcolor = hsv2rgb(h, s, v)
                // item.setColor([hue: hue100, saturation: s, level: v])
                newonoff = "on"
                logger("saturation command result: hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
            break
              
        case "saturation-dn":
                saturation = item.currentValue("saturation").toInteger()
                def del = (saturation % 5) == 0 ? 5 : saturation % 5
                saturation = (saturation <= 5) ? 5 : saturation - del
                item.setSaturation(saturation)
                def hue100 = item.currentValue("hue").toInteger()
                def h = Math.round((hue100 * 360) / 100)
                def s = saturation
                def v = item.currentValue("level").toInteger()
                newcolor = hsv2rgb(h, saturation, v)
                // item.setColor([hue: hue100, saturation: s, level: v])
                newonoff = (v == 0) ? "off" : "on"
                logger("saturation command result: hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
            break
              
        case "saturation":
                saturation = item.currentValue("saturation").toInteger()
                if ( cmd.isNumber() ) {
                    saturation = cmd.toInteger()
                }
                item.setSaturation(saturation)
                def hue100 = item.currentValue("hue").toInteger()
                def h = Math.round((hue100 * 360) / 100)
                def s = saturation
                def v = item.currentValue("level").toInteger()
                newcolor = hsv2rgb(h, s, v)
                // item.setColor([hue: hue100, saturation: s, level: v])
                newonoff = (v == 0) ? "off" : "on"
                logger("saturation command result: hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")                
            break

        case "colorTemperature-up":
                temperature = item.currentValue("colorTemperature").toInteger()
                temperature = (temperature >= 6500) ? 6500 : temperature - (temperature % 100) + 100
                item.setColorTemperature(temperature)
                newonoff = "on"
            break
              
        case "colorTemperature-dn":
                temperature = item.currentValue("colorTemperature").toInteger()
                /* temperature drifts up so we cant use round down method */
                def del = 100
                temperature = (temperature <= 2700) ? 2700 : temperature - del
                temperature = (temperature >= 6500) ? 6500 : temperature - (temperature % 100)
                item.setColorTemperature(temperature)
                newonoff = "on"
            break
              
        case "colorTemperature":
                temperature = item.currentValue("colorTemperature").toInteger()
                /* temperature drifts up so we cant use round down method */
                if ( cmd.isNumber() ) {
                    temperature = cmd.toInteger()
                    item.setColorTemperature(temperature)
                }
                newonoff = "on"
            break

        // this supports api calls and clicking on color circle
        // the level is not returned to prevent slider from moving around
        case "color":
            logger("color command request:  ${cmd}", "debug")
            if (cmd.startsWith("hsl(") && cmd.length()==16) {
                def h = cmd.substring(4,7).toInteger()
                def hue100 = Math.round((h * 100) / 360)
                def s = cmd.substring(8,11).toInteger()
                def v = cmd.substring(12,15).toInteger()
                newcolor = hsv2rgb(h, s, v)
                item.setColor([hue: hue100, saturation: s, level: v])
                newlevel = v
                newonoff = "on"
                logger("color click: hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","info")                
            } else if ( cmd.startsWith("#") ) {
                newcolor = cmd;
                def r = cmd.substring(1,3)
                def g = cmd.substring(3,5)
                def b = cmd.substring(5,7)
                r = Integer.parseInt(r,16)
                g = Integer.parseInt(g,16)
                b = Integer.parseInt(b,16)
                def hsv = rgb2hsv(r, g, b)
                def h = hsv[0]
                def hue100 = hsv[3]
                // Math.round((h * 100) / 360)
                def s = hsv[1]
                def v = hsv[2]
                item.setColor([hue: hue100, saturation: s, level: v])
                newlevel = v
                newonoff = "on"
                logger("color command: , r,g,b = ${r}, ${g}, ${b}, hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","info")                
            }
            break
              
        default:
            if (subid.startsWith("_")) {
                newonoff = subid.substring(1)
                cmd = newonoff
            } else if ( cmd=="level" && swattr.isNumber() && item.hasAttribute("level") ) {
                // set the level if a number is given for attr
                newlevel = swattr.toInteger()
                item.setLevel(newlevel)
                newonoff = "on"
                cmd = "on"
            } else if ( item.hasCommand(cmd) ) { // cmd=="on" || cmd=="off" || cmd=="flash" || cmd=="open" || cmd=="close") {
                newonoff = cmd
            } else if (cmd=="toggle") {
                newonoff = newonoff=="off" ? "on" : "off"
                cmd = newonoff
            }
            break               
        }

        // execute the new command
        if ( item.hasCommand(cmd) ) {
            item."$cmd"()
        }

        // return the fields that were changed
        resp = ["name": newname]
        if ( item.hasAttribute("switch") && (newonoff=="on" || newonoff=="off") ) {
            resp.put(swtrigger, newonoff)
        }
        if ( item.hasAttribute("color") && newcolor ) { resp.put("color", newcolor) }
        if ( item.hasAttribute("hue") && hue ) { resp.put("hue", hue) }
        if ( item.hasAttribute("saturation") && saturation ) { resp.put("saturation", saturation) }
        if ( item.hasAttribute("colorTemperature") && temperature ) { resp.put("colorTemperature", temperature) }
        if ( item.hasAttribute("level") && newlevel ) { resp.put("level", newlevel) }
        if ( item.hasAttribute("position") && newlevel ) { resp.put("position", newlevel) }

        if ( item.hasCommand("open") ) { resp.put("_open","open"); }
        if ( item.hasCommand("close") ) { resp.put("_close","close"); }
        if ( item.hasCommand("on") ) { resp.put("_on","on"); }
        if ( item.hasCommand("off") ) { resp.put("_off","off"); }
    }
    logger("generic light setter returned: ${resp}", "debug")
    return resp
}

def hsv2rgb(h, s, v) {
    def r, g, b
    def oh = h
    def os = s
    def ov = v

    h = Math.round(h);
    s /= 100.0
    v /= 100.0
    if ( h == 360 ) {
        h = 0
    } else {
        h = h / 60
    }
    def i = Math.floor(h);
    def f = h - i;
    def p = v * (1 - s);
    def q = v * (1 - f * s);
    def t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    r = Math.round(r*255).toInteger()
    g = Math.round(g*255).toInteger()
    b = Math.round(b*255).toInteger()

    def rhex = Integer.toHexString(r)
    def ghex = Integer.toHexString(g)
    def bhex = Integer.toHexString(b)

    if ( rhex.length() == 1 ) rhex = "0"+rhex;
    if ( ghex.length() == 1 ) ghex = "0"+ghex;
    if ( bhex.length() == 1 ) bhex = "0"+bhex;
    // rhex = rhex == "0" ? "00" : rhex
    // ghex = ghex == "0" ? "00" : ghex
    // bhex = bhex == "0" ? "00" : bhex
    def hexval = "#"+rhex+ghex+bhex
    return hexval
}

def mapMinMax(value,oldMin,oldMax,newMin, newMax) {
  def r = (newMax-newMin)*(value-oldMin)/(oldMax-oldMin)+newMin
  r = Math.round(r)
  return r.toInteger()
}

def rgb2hsv(r, g, b) {
    r /= 255
    g /= 255
    b /= 255

    def max = Math.max(r, Math.max(g, b))
    def min = Math.min(r, Math.min(g, b))
    def h = max
    def v = max
    def d = max - min
    def s = max == 0 ? 0 : d / max;
    if (max == min) {
        h = 0
    } else {
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0)
                break
            case g:
                h = (b - r) / d + 2
                break
            case b:
                h = (r - g) / d + 4
                break
        }
        h /= 6
    }

    def h100 = h*100
    h100 = h100.toInteger()
    h = h*360
    h = h.toInteger()
    // h = mapMinMax(h,0,1,0,360);
    s *= 100
    s = s.toInteger()
    v *= 100
    v = v.toInteger()
    // def hsvstr = "hsl(${h},${s},${v})"
    return [h, s, v, h100]
}

def setLock(swid, cmd, swattr, subid) {
    logcaller("setLock", swid, cmd, swattr, subid)
    def resp = false
    def newsw
    def item  = mylocks?.find{it.id == swid }
    if (item) {
        if (cmd=="toggle") {
            newsw = item.currentLock=="locked" ? "unlocked" : "locked"
            if ( newsw=="locked" ) {
               item.lock()
            } else {
               item.unlock()
            }
        } else if ( subid=="lock" && (cmd=="lock" || swattr.endsWith("unlocked") ) ) {
            item.lock()
            newsw = "locked";
        } else if ( subid=="lock" && (cmd="unlock" || swattr.endsWith("locked") ) ) {
            item.unlock()
            newsw = "unlocked";
        } else if ( cmd=="unknown" ) {
            newsw = item.currentLock
        } else if (cmd=="unlock") {
            item.unlock()
            newsw = "unlocked"
        } else if (cmd=="lock") {
            item.lock()
            newsw = "locked"
        } else if (subid.startsWith("_")) {
            cmd = subid.substring(1)
            newsw = cmd=="lock" ? "locked" : "unlocked"
            if ( item.hasCommand(cmd) ) {
                item."$cmd"()
            }
        } else {
            newsw = item.currentLock
        }

        // include battery
        resp = [lock: newsw]
        if ( item.hasAttribute("battery") ) {
            resp.put("battery", item.currentValue("battery"))
        }
    }
    return resp
}

def setValve(swid, cmd, swattr, subid) {
    logcaller("setValve", swid, cmd, swattr, subid)
    def resp = false
    def item  = myvalves.find{it.id == swid }
    if (item) {
        def newsw = item.currentValue("valve")
        if ( subid=="valve" && swattr.endsWith(" open") ) {
            item.close()
        } else if ( subid=="valve" && swattr.endsWith(" closed") ) {
            item.open()
        } else if ( subid=="switch" && swattr.endsWith(" on") ) {
            item.off()
        } else if ( subid=="switch" && swattr.endsWith(" off") ) {
            item.on()
        } else if ( subid.startsWith("_") ) {
            subid = subid.substring(1)
            if ( item.hasCommand(subid) ) {
                item."$subid"()
            }
        } else if ( item.hasCommand(cmd) ) {
            item."$cmd"()
        }
        resp = getThing(myvalves, swid, item)
    }
    return resp
}

def setThermostat(swid, cmd, swattr, subid) {
    logcaller("setThermostat", swid, cmd, swattr, subid)
    def resp = false
    def newsw
    def item  = mythermostats.find{it.id == swid }

    try {
        cmd = cmd.toInteger()
        cmd = Math.min(90, cmd)
        cmd = Math.max(50, cmd)
    } catch(e) { }

    if (item) {

        // case "heat-up":
        if ( subid=="heatingSetpoint-up" ) {
            newsw = cmd + 1
            item.setHeatingSetpoint(newsw)
            newsw = newsw.toString()
            resp = [heatingSetpoint: newsw]
        }

        // case "heat-dn":
        else if ( subid=="heatingSetpoint-dn" ) {
            newsw = cmd - 1
            item.setHeatingSetpoint(newsw)
            newsw = newsw.toString()
            resp = [heatingSetpoint: newsw]
        }
          
        else if ( subid=="heatingSetpoint" ) {
            newsw = cmd
            item.setHeatingSetpoint(newsw)
            newsw = newsw.toString()
            resp = [heatingSetpoint: newsw, thermostatMode: "heat"]
        }
        
        // case "cool-up":
        else if ( subid=="coolingSetpoint-up" ) {
            newsw = cmd + 1
            item.setCoolingSetpoint(newsw)
            newsw = newsw.toString()
            resp = [coolingSetpoint: newsw]
        }
        
        // case "cool-dn":
        else if ( subid=="coolingSetpoint-dn" ) {
            newsw = cmd - 1
            item.setCoolingSetpoint(newsw)
            newsw = newsw.toString()
            resp = [coolingSetpoint: newsw]
        }
          
        else if ( subid=="coolingSetpoint" ) {
            newsw = cmd
            item.setCoolingSetpoint(newsw)
            newsw = newsw.toString()
            resp = [coolingSetpoint: newsw, thermostatMode: "cool"]
        }
          
        // case "thermostat thermomode heat":
        else if ( subid=="_emergencyHeat" ) {
            if ( item.hasCommand("emergencyHeat") ) {
                item.emergencyHeat()
                newsw = "emergency"
            } else {
                item.heat()
                newsw = "heat"
            }
            resp = [thermostatMode: newsw]
        }

        // case "thermostat thermomode cool":
        else if ( subid=="_cool" || (subid=="thermostatMode" && cmd=="heat") ) {
            item.cool()
            newsw = "cool"
            resp = [thermostatMode: newsw]
        }
          
        // case "thermostat thermomode auto":
        else if ( subid=="_auto" || (subid=="thermostatMode" && cmd=="cool") ) {
            item.auto()
            newsw = "auto"
            def midpt = item.currentValue("temperature")
            def heatpt = midpt - 3
            def coolpt = midpt + 3
            item.setHeatingSetpoint(heatpt)
            item.setCoolingSetpoint(coolpt)
            resp = [heatingSetpoint: heatpt, coolingSetpoint: coolpt, thermostatMode: "auto"]
        }
          
        // case "thermostat thermomode off":
        else if ( subid=="_off" || (subid=="thermostatMode" && (cmd=="auto")) ) {
            item.off()
            newsw = "off"
            resp = [thermostatMode: newsw]
        }
          
        // case "thermostat thermomode heat":
        else if ( subid=="_heat" || (subid=="thermostatMode" && cmd=="off") ) {
            item.heat()
            newsw = "heat"
            resp = [thermostatMode: newsw]
        }
          
        // case leaving on, go to auto
        else if ( subid=="_fanAuto" || (subid=="thermostatFanMode" && cmd=="on") ) {
            item.fanAuto()
            newsw = "auto"
            resp = [thermostatFanMode: newsw]
        }
          
        // case leaving auto, go to either circulate or on
        else if ( subid=="_fanCirculate" || (subid=="thermostatFanMode" && cmd=="auto") ) {
            if ( item.hasCommand("fanCirculate") ) {
                item.fanCirculate()
                newsw = "circulate"
            } else {
                item.fanOn()
                newsw = "on"
            }
            resp = [thermostatFanMode: newsw]
        }
        
        // case leaving circulate, got to on:
        else if ( subid=="_fanOn" || (subid=="thermostatFanMode" && cmd=="circulate") ) {
            item.fanOn()
            newsw = "on"
            resp = [thermostatFanMode: newsw]
            // resp['thermostatFanMode'] = newsw
        }

        // these three just return the states but they should never be called
        else if ( subid=="temperature" ) {
            newsw = item.currentValue(subid)
            resp = [temperature: newsw]
        }
          
        else if ( subid=="state" ) {
            newsw = item.currentValue(subid)
            resp = [state: newsw]
        }
          
        else if ( subid=="humidity" ) {
            newsw = item.currentValue(subid)
            resp = [humidity: newsw]
        }
           
        // define actions for python end points
        // if no action is taken the full state is returned
        else {
            if (subid.startsWith("_")) {
                cmd = subid.substring(1)
            } else {
                cmd = subid
            }
            if ( item.hasCommand(cmd) ) {
                item."$cmd"()
            }
            resp = getThermostat(swid, item)
        }
      
    }
    return resp
}

def setMusic(swid, cmd, swattr, subid) {
    logcaller("setMusic", swid, cmd, swattr, subid)
    def resp = false
    def item  = mymusics.find{it.id == swid }
    def newsw
    if (item) {
        resp = getMusic(swid, item)
        
        // fix old bug from addition of extra class stuff
        // had to fix this for all settings
        if ( subid=="mute" && swattr.contains(" unmuted" )) {
            newsw = "muted"
            item.mute()
            resp['mute'] = newsw
        } else if ( subid=="mute" && swattr.contains(" muted" )) {
            newsw = "unmuted"
            item.unmute()
            resp['mute'] = newsw
        } else if ( subid=="level-up" || swattr.contains(" level-up") ) {
            newsw = cmd.toInteger()
            newsw = (newsw >= 95) ? 100 : newsw - (newsw % 5) + 5
            item.setLevel(newsw)
            resp['level'] = newsw
        } else if ( subid=="level-dn" || swattr.contains(" level-dn") ) {
            newsw = cmd.toInteger()
            def del = (newsw % 5) == 0 ? 5 : newsw % 5
            newsw = (newsw <= 5) ? 0 : newsw - del
            item.setLevel(newsw)
            resp['level'] = newsw
        } else if ( subid=="level" || swattr.contains(" level") ) {
            newsw = cmd.toInteger()
            item.setLevel(newsw)
            resp['level'] = newsw
        } else if ( subid=="music-play" || swattr.contains(" music-play") ) {
            newsw = "playing"
            item.play()
            resp['status'] = newsw
            // resp['trackDescription'] = item.currentValue("trackDescription")
        } else if ( subid=="music-stop" || swattr.contains(" music-stop") ) {
            newsw = "stopped"
            item.stop()
            resp['status'] = newsw
            // resp['trackDescription'] = ""
        } else if ( subid=="music-pause" || swattr.contains(" music-pause") ) {
            newsw = "paused"
            item.pause()
            resp['status'] = newsw
        } else if ( subid=="music-previous" || swattr.contains(" music-previous") ) {
            item.previousTrack()
            resp = getMusic(swid, item)
            // resp['trackDescription'] = item.currentValue("trackDescription")
        } else if ( subid=="music-next" || swattr.contains(" music-next") ) {
            item.nextTrack()
            resp = getMusic(swid, item)
            // resp['trackDescription'] = item.currentValue("trackDescription")
        } else if ( subid.startsWith("_") ) {
            subid = subid.substring(1)
            if ( item.hasCommand(subid) ) {
                item."$subid"()
                resp = getMusic(swid, item)
                // resp['trackDescription'] = item.currentValue("trackDescription")
            }
        } else if ( cmd && item.hasCommand(cmd) ) {
            item."$cmd"()
            resp = getMusic(swid, item)
            // resp['trackDescription'] = item.currentValue("trackDescription")
        }
    }
    return resp
}

def registerAll() {
    List mydevices = ["myswitches", "mydimmers", "mybulbs", "mypresences", "mybuttons",
                      "mymotions", "mycontacts", "mydoors", "mygarages", "mylocks", "mythermostats", "myshades",
                      "mytemperatures", "myilluminances", "myweathers",
                      "mywaters", "mysmokes", "mymusics", "myaudios", "mypowers", "myothers", "myactuators"]

    // register mode changes
    registerLocations()

    // register all the devices in time steps
    def delay = 5
    mydevices.each { item -> 
        if ( settings[item]?.size() > 0 ) {
            logger("registering ${item} ", "debug")
            runIn(delay, "register_${item}", [overwrite: true])
            delay = delay + 5
        }
    }
}

def registerLocations() {
    // lets subscribe to mode changes
    subscribe(location, "mode", modeChangeHandler)

    subscribe(location, "hsmStatus", hsmStatusHandler)
    // subscribe(location, "hsmAlerts", hsmAlertHandler)

    // register the variables
    state.globalVars.each { String varname, Map infomap ->
        if ( settings["var_${varname}"] ) {
            subscribe(location, "variable:${varname}", "variableHandler")
        }
    }
}

def register_myswitches() {
    registerChangeHandler(settings?.myswitches)
}
def register_mydimmers() {
    registerChangeHandler(settings?.mydimmers)
}
def register_mybulbs() {
    registerChangeHandler(settings?.mybulbs)
}
def register_mypresences() {
    registerChangeHandler(settings?.mypresences)
}
def register_mymotions() {
    registerChangeHandler(settings?.mymotions)
}
def register_mycontacts() {
    registerChangeHandler(settings?.mycontacts)
}
def register_mydoors() {
    registerChangeHandler(settings?.mydoors)
}
def register_mygarages() {
    registerChangeHandler(settings?.mygarages)
}
def register_mylocks() {
    registerChangeHandler(settings?.mylocks)
}
def register_mythermostats() {
    registerChangeHandler(settings?.mythermostats)
}
def register_mytemperatures() {
    registerChangeHandler(settings?.mytemperatures)
}
def register_myilluminances() {
    registerChangeHandler(settings?.myilluminances)
}
def register_myweathers() {
    registerChangeHandler(settings?.myweathers)
}
def register_mywaters() {
    registerChangeHandler(settings?.mywaters)
}
def register_mysmokes() {
    registerChangeHandler(settings?.mysmokes)
}
def register_mymusics() {
    registerChangeHandler(settings?.mymusics)
}
def register_myaudios() {
    registerChangeHandler(settings?.myaudios)
}
def register_mypowers() {
    registerChangeHandler(settings?.mypowers)
}
def register_myothers() {
    registerChangeHandler(settings?.myothers)
}
def register_myactuators() {
    registerChangeHandler(settings?.myactuators)
}
// def register_myaccuweathers() {
//     registerChangeHandler(settings?.myaccuweathers)
// }
def register_mybuttons() {
    registerChangeHandler(settings?.mybuttons)
}
def register_myshades() {
    registerChangeHandler(settings?.myshades)
}

def registerCapabilities(devices, capability) {
    subscribe(devices, capability, changeHandler)
    logger("Registering ${capability} for ${devices?.size() ?: 0} things", "debug")
}

def registerChangeHandler(devices) {
    devices?.each { device ->
        List theAtts = device?.supportedAttributes?.collect { it?.name as String }?.unique()
        logger("atts: ${theAtts}", "debug")
        theAtts?.each {att ->
            Boolean skipAtt = false
            if(!(ignoredAttributes().contains(att))) {
                subscribe(device, att, "changeHandler")
                logger("Registering ${device?.displayName}.${att}", "debug")
            }
        }
    }
}

def changeHandler(evt) {
    def src = evt?.source
    def deviceid = evt?.deviceId
    def deviceName = evt?.displayName
    def attr = evt?.name
    def value = evt?.value
    def skip = false
    
    def devtype = autoType(deviceid)
    logger("handling id = ${deviceid} devtype = ${devtype} name = ${deviceName} attr = ${attr} value = ${value}", "trace")

    // handle power changes to skip if not changed by at least 15%
    // this value was set by trial and error for my particular plug
    if ( attr=="power" ) {
        try {
            // log.info state.powervals
            def delta = 0.0
            def oldpower = state.powervals[deviceid] ?: 0.0
            oldpower = Float.valueOf(oldpower)
            state.powervals[deviceid] = Float.valueOf(value)
            if ( oldpower==0.0 && state.powervals[deviceid] < 1.0 ) {
                skip = true
            } else if ( oldpower==0.0 ) {
                skip = false
            } else {
                delta = (state.powervals[deviceid]- oldpower) / oldpower 
                if ( delta < 0.0 ) {
                    delta = 0.0 - delta
                }
                skip = (delta < 0.15)
            }
            logger("delta = ${delta} skip = ${skip}", "debug")
            
        } catch (e) {
            skip= false
            logger("problem in change handler for power device. oldpower: ${oldpower} error msg: ${e}", "error")
        }
    }
    
    // log.info "Sending ${src} Event ( ${deviceName}, ${deviceid}, ${attr}, ${value} ) to HousePanel clients  log = ${state.loggingLevelIDE}"
    // log.info "skip= ${skip} deviceName= ${deviceName} attr= ${attr} value= ${value}"
    if ( !skip && deviceName && deviceid && attr && value) {

        def item = mybulbs?.find{it.id.toInteger() == deviceid.toInteger()}
        if ( (attr=="hue" || attr=="saturation" || attr=="level" || attr=="color") && item && item.hasAttribute("color") ) {

            // fix color bulbs - force attr to color if hue, saturation, or level changes
            def h
            def h100
            def s
            def v 
            def c
            def color
            if ( attr == "color" && value.substring(0,1)=="#") {
                def r = value.substring(1,3)
                def g = value.substring(3,5)
                def b = value.substring(5,7)
                r = Integer.parseInt(r,16)
                g = Integer.parseInt(g,16)
                b = Integer.parseInt(b,16)
                def hsv = rgb2hsv(r, g, b)
                h = hsv[0]
                hue100 = hsv[3] 
                //  Math.round((h * 100) / 360)
                s = hsv[1]
                v = hsv[2]
                // c = item.currentValue("colorTemperature").toInteger()
                color = value
            } else {
                h100 = attr=="hue" ? value.toInteger() : item.currentValue("hue").toInteger()
                s = attr=="saturation" ? value.toInteger() : item.currentValue("saturation").toInteger()
                v = attr=="level" ? value.toInteger() : item.currentValue("level").toInteger()
                // c = attr=="colorTemperature" ? value.toInteger() : item.currentValue("colorTemperature").toInteger()
                h = mapMinMax(h100,0,100,0,360)     //  Math.round((h100*360)/100)
                color = hsv2rgb(h, s, v)
            }

            // for colors we have to set all parameters at the same time to avoid race conditions
            def colorarray = [h100, s, v, color]
            postHub(state.directIP, state.directPort, "update", deviceName, deviceid, "color", devtype, colorarray)
            postHub(state.directIP2, state.directPort2, "update", deviceName, deviceid, "color", devtype, colorarray)
            postHub(state.directIP3, state.directPort3, "update", deviceName, deviceid, "color", devtype, colorarray)

            // set it to change color based on attribute change
            logger("color update: ${deviceName} id ${deviceid} type ${devtype} changed to ${color} by changing ${attr} to ${value}, h100: ${h100}, h: ${h}, s: ${s}, v: ${v} ", "info") 
        } else {
            // make the original attribute change
            postHub(state.directIP, state.directPort, "update", deviceName, deviceid, attr, devtype, value)
            postHub(state.directIP2, state.directPort2, "update", deviceName, deviceid, attr, devtype, value)
            postHub(state.directIP3, state.directPort3, "update", deviceName, deviceid, attr, devtype, value)

            logger("thing update: ${deviceName} id ${deviceid} type ${devtype} changed to ${value} by changing ${attr} to ${value}", "info")
        }

    }
}

def modeChangeHandler(evt) {
    // modified to simplify modes to only deal with one tile
    // send group of hub actions for mode changes
    def themode = evt?.value
    def deviceName = evt?.displayName
    def attr = evt?.name
    logger("New mode= ${themode} with attr= ${attr} and name= ${deviceName} to HousePanel clients", "debug")
    if (themode && deviceName && state?.directIP && state?.directPort) {
        def modeid = "${state.prefix}mode"
        logger("Sending new mode= ${themode} with id= ${modeid} to HousePanel clients", "debug")
        postHub(state.directIP, state.directPort, "update", deviceName, modeid, "themode", "mode", themode)
        postHub(state.directIP2, state.directPort2, "update", deviceName, modeid, "themode", "mode", themode)
        postHub(state.directIP3, state.directPort3, "update", deviceName, modeid, "themode", "mode", themode)
    }
}

def hsmStatusHandler(evt) {
    // modified to simplify modes to only deal with one tile
    // send group of hub actions for mode changes
    def themode = evt?.value
    def deviceName = evt?.displayName
    def attr = evt?.name
    logger("New HSM= ${themode} with attr= ${attr} and name= ${deviceName} to HousePanel clients", "debug")
    if (themode && state?.directIP && state?.directPort) {
        def modeid = "${state.prefix}hsm"
        postHub(state.directIP, state.directPort, "update", deviceName, modeid, "state", "hsm", themode)
        postHub(state.directIP2, state.directPort2, "update", deviceName, modeid, "state", "hsm", themode)
        postHub(state.directIP3, state.directPort3, "update", deviceName, modeid, "state", "hsm", themode)
    }
}

def variableHandler(evt) {
    // modified to simplify modes to only deal with one tile
    // send group of hub actions for mode changes
    def vid = "${state.prefix}variables"
    def theval = evt?.value
    def varname = evt?.name

    if ( varname.startsWith("variable:") ) {
        // name returned as "variable:name" so we get everything after the :
        varname = varname.substring(9)
        logger("Variable changed, name = ${varname}, val = ${theval}", "debug")

        postHub(state.directIP, state.directPort, "update", "Variables", vid, varname, "variable", theval)
        postHub(state.directIP2, state.directPort2, "update", "Variables", vid, varname, "variable", theval)
        postHub(state.directIP3, state.directPort3, "update", "Variables", vid, varname, "variable", theval)
    }
}

def postHub(ip, port, msgtype, name, id, attr, type, value) {
    def abody = [
                msgtype: msgtype,
                hubid: state.hubid,
                change_name: name,
                change_device: id,
                change_attribute: attr,
                change_type: type,
                change_value: value
            ]

    if ( msgtype && ip && ip!="0" && port && port!="0"  ) {
        logger("HousePanel postHub ${msgtype} to IP= ${ip}:${port} name= ${name} id= ${id} attr= ${attr} type= ${type} value= ${value}", "debug")
        if (ip.startsWith("http") ) {
            sendHttpPost(ip, port, abody)
        } else {
            def iphttp = "http://${ip}"
            sendHttpPost(iphttp, port, abody)
            // def params = [
            //     method: "POST",
            //     path: "/",
            //     headers: [
            //         HOST: "${ip}:${port}",
            //         'Content-Type': 'application/json'
            //     ],
            //     body: abody
            // ]
            // def result = hubitat.device.HubAction.newInstance(params)
            // sendHubCommand(result)
        }
    }
}

void sendHttpPost(ip, port, Map body) {
    def contentType = "application/json"
    Map params = [
        uri: "${ip}:${port}",
        requestContentType: contentType,
        contentType: contentType,
        body: body,
        ignoreSSLIssues: true,
        timeout: 20
    ]
    asynchttpPost("asyncHttpCmdResp", params, [execDt: now(), ip: ip])
}

void asyncHttpCmdResp(response, data) {
    def dt = now() - data.execDt
    if ( data.ip == state.directIP ) {
        logger("Resp: ${response} | Process time: ${dt}", "info")
    } else {
        logger("Resp: ${response} | Process time: ${dt}", "trace")
    }
}

// Wrapper nction for all logging.
private logcaller(caller, swid, cmd, swattr, subid, level="debug") {
    logger("${caller}: swid= $swid cmd= $cmd swattr= $swattr subid= $subid", level)
}

private logger(msg, level = "debug") {

    switch(level) {
        case "error":
            if (state.loggingLevelIDE >= 1) log.error msg
            break

        case "warn":
            if (state.loggingLevelIDE >= 2) log.warn msg
            break

        case "info":
            if (state.loggingLevelIDE >= 3) log.info msg
            break

        case "debug":
            if (state.loggingLevelIDE >= 4) log.debug msg
            break

        case "trace":
            if (state.loggingLevelIDE >= 5) log.trace msg
            break

        default:
            log.debug msg
            break
    }
}

private getWebData(Map params, Boolean text=true) {
    try {
        httpGet(params) { resp ->
            if (resp?.status != 200) { logger("${resp?.status} $params","warn") }
            if (resp?.data) {
                if (text) { return resp.data.text?.toString() }
                return resp.data
            } else {
                return null
            }
        }
    } catch (ex) {
        logger("Problem obtaining uri = ${params.uri} from web", "error") 
        log.error ex
        return null
    }
}

// we only get this token to confirm OAUTH is configured
// for making API calls we use the Bearer Token obtained via OAUTH flow
Boolean getAccessToken() {
    try {
        if (!state.accessToken) {
            state.accessToken = createAccessToken()
            logger('App Access Token Missing... Generating New Token!!!', "warn")
            return true
        }
        return true
    } catch (ex) {
            String msg = "Error: OAuth is not Enabled for ${app.getName()}!. Please click remove and Enable Oauth under in the HE console 'Apps Code'"
            logger("getAccessToken Exception: ${msg}", "error")
            return false
    }
}

/*************************************************************************/
/* webCoRE Connector v0.2                                                */
/*************************************************************************/
/*  Copyright 2016 Adrian Caramaliu <ady624(at)gmail.com>                */
/*                                                                       */
/*  This program is free software: you can redistribute it and/or modify */
/*  it under the terms of the GNU General Public License as published by */
/*  the Free Software Foundation, either version 3 of the License, or    */
/*  (at your option) any later version.                                  */
/*                                                                       */
/*  This program is distributed in the hope that it will be useful,      */
/*  but WITHOUT ANY WARRANTY; without even the implied warranty of       */
/*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the         */
/*  GNU General Public License for more details.                         */
/*                                                                       */
/*  You should have received a copy of the GNU General Public License    */
/*  along with this program.  If not, see <http://www.gnu.org/licenses/>.*/
/*************************************************************************/
private webCoRE_handle(){return'webCoRE'}
private webCoRE_init(pistonExecutedCbk)
{
    state.webCoRE=(state.webCoRE instanceof Map?state.webCoRE:[:])+(pistonExecutedCbk?[cbk:pistonExecutedCbk]:[:]);
    subscribe(location,"${webCoRE_handle()}.pistonList",webCoRE_handler);
    if(pistonExecutedCbk)subscribe(location,"${webCoRE_handle()}.pistonExecuted",webCoRE_handler);webCoRE_poll();
}
private webCoRE_poll(){sendLocationEvent([name: webCoRE_handle(),value:'poll',isStateChange:true,displayed:false])}
public  webCoRE_execute(pistonIdOrName,Map data=[:]){def i=(state.webCoRE?.pistons?:[]).find{(it.name==pistonIdOrName)||(it.id==pistonIdOrName)}?.id;if(i){sendLocationEvent([name:i,value:app.label,isStateChange:true,displayed:false,data:data])}}
public  webCoRE_list(mode)
{
    def p=state.webCoRE?.pistons;
    if(p)p.collect{
        mode=='id'?it.id:(mode=='name'?it.name:[id:it.id,name:it.name])
        logger("Reading piston: ${it}", "debug");
    }
    return p
}
public  webCoRE_handler(evt){switch(evt.value){case 'pistonList':List p=state.webCoRE?.pistons?:[];Map d=evt.jsonData?:[:];if(d.id&&d.pistons&&(d.pistons instanceof List)){p.removeAll{it.iid==d.id};p+=d.pistons.collect{[iid:d.id]+it}.sort{it.name};state.webCoRE = [updated:now(),pistons:p];};break;case 'pistonExecuted':def cbk=state.webCoRE?.cbk;if(cbk&&evt.jsonData)"$cbk"(evt.jsonData);break;}}
