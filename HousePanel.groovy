/*
 * HousePanel
 *
 * Copyright > 2016 to 2020 by Kenneth Washington
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at:
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 * for the specfific language governing permissions and limitations under the License.
 *
 * This is a Hubitat app that works with the HousePanel smart dashboard platform
 * It also supports Hubitat NodeServer installations on the Universal Devices platform
 * Removed history info to keep it now in the devhistory.js file for diaplay in app
 */

import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import groovy.transform.Field
import java.text.SimpleDateFormat
import java.util.concurrent.Semaphore

public static String handle() { return "HousePanel" }

/**********************************************
    STATICALLY DEFINED VARIABLES
    inpired by Tonesto7 homebridge2 app
***********************************************/
@Field static final String appVersionFLD  = '3.2.5'
@Field static final String sNULL          = (String) null
@Field static final String sBLANK         = ''
@Field static final String sLINEBR        = '<br>'
@Field static final String sSMALL         = 'small'
@Field static final String sCLRBLUE       = '#2784D9'
@Field static final String sCLRRED        = 'red'
@Field static final String sCLRGRY        = 'gray'
@Field static final String sCLRGRN        = 'green'

/**********************************************
    APP HELPER FUNCTIONS
    inpired by Tonesto7 homebridge2 app
***********************************************/
static String getAppImg(String imgName) { return "https://housepanel.net/wp-content/uploads/${imgName}" }
static String sectH3TS(String t, String st, String i = sNULL, String c=sCLRBLUE) { return "<h3 style='color:${c};font-weight: bold'>${i ? "<img src='${i}' width='48'> " : sBLANK} ${t?.replaceAll("\\n", sLINEBR)}</h3>${st ?: sBLANK}" }
static String sectHead(String str, String img = sNULL) { return str ? "<h3 style='margin-top:0;margin-bottom:0;'>" + spanImgStr(img) + span(str, sCLRBLUE, sNULL, true) + '</h3>' + "<hr style='background-color:${sCLRGRY};font-style:italic;height:1px;border:0;margin-top:0;margin-bottom:0;'>" : sBLANK }

// Root HTML Objects
static String span(String str, String clr=sNULL, String sz=sNULL, Boolean bld=false, Boolean br=false) { return str ? "<span ${(clr || sz || bld) ? "style='${clr ? "color: ${clr};" : sBLANK}${sz ? "font-size: ${sz};" : sBLANK}${bld ? 'font-weight: bold;' : sBLANK}'" : sBLANK}>${str}</span>${br ? sLINEBR : sBLANK}" : sBLANK }
static String div(String str, String clr=sNULL, String sz=sNULL, Boolean bld=false, Boolean br=false) { return str ? "<div ${(clr || sz || bld) ? "style='${clr ? "color: ${clr};" : sBLANK}${sz ? "font-size: ${sz};" : sBLANK}${bld ? 'font-weight: bold;' : sBLANK}'" : sBLANK}>${str}</div>${br ? sLINEBR : sBLANK}" : sBLANK }
static String spanImgStr(String img=sNULL) { return img ? span("<img src='${(!img.startsWith('http')) ? getAppImg(img) : img}' width='42'> ") : sBLANK }
static String divSmBld(String str, String clr=sNULL, String img=sNULL)     { return str ? div(spanImgStr(img) + span(str), clr, sSMALL, true)      : sBLANK }
static String htmlLine(String color=sCLRBLUE, Integer width = null) { return "<hr style='background-color:${color};height:1px;border:0;margin-top:0;margin-bottom:0;${width ? "width: ${width}px;" : sBLANK}'>" }
static String lineBr(Boolean show=true) { return show ? sLINEBR : sBLANK }
static String inputFooter(String str, String clr=sCLRBLUE, Boolean noBr=false) { return str ? lineBr(!noBr) + divSmBld(str, clr) : sBLANK }

// Custom versions of the root objects above
static String spanSm(String str, String clr=sNULL, String img=sNULL)       { return str ? spanImgStr(img) + span(str, clr, sSMALL)                 : sBLANK }
static String spanSmBr(String str, String clr=sNULL, String img=sNULL)     { return str ? spanImgStr(img) + span(str, clr, sSMALL, false, true)    : sBLANK }
static String spanSmBld(String str, String clr=sNULL, String img=sNULL)    { return str ? spanImgStr(img) + span(str, clr, sSMALL, true)           : sBLANK }
static String spanSmBldBr(String str, String clr=sNULL, String img=sNULL)  { return str ? spanImgStr(img) + span(str, clr, sSMALL, true, true)     : sBLANK }

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
            // desc += myweathers ? spanSmBld("Weather${myweathers.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myweathers.size()})") : sBLANK
            desc += mywaters ? spanSmBld("Water${mywaters.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mywaters.size()})") : sBLANK
            desc += myvalves ? spanSmBld("Valve${myvalves.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myvalves.size()})") : sBLANK
            desc += mysmokes ? spanSmBld("Smoke${mysmokes.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mysmokes.size()})") : sBLANK
            desc += mycosensors ? spanSmBld("Smoke${mycosensors.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mycosensors.size()})") : sBLANK
            desc += myco2sensors ? spanSmBld("Smoke${myco2sensors.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myco2sensors.size()})") : sBLANK
            desc += mymusics ? spanSmBld("Music${mymusics.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${mymusics.size()})") : sBLANK
            desc += myaudios ? spanSmBld("Audio${myaudios.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myaudios.size()})") : sBLANK
            desc += myothers ? spanSmBld("Sensor${myothers.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myothers.size()})") : sBLANK
            desc += myactuators ? spanSmBld("Actuator${myactuators.size() > 1 ? 's' : sBLANK}") + spanSmBr(" (${myactuators.size()})") : sBLANK

            desc += htmlLine(sCLRBLUE, 200)
            desc += inputFooter('Tap to select devices...')

            href 'deviceSelectPage', title: spanSmBld('Device Selection'), required: false, description: (desc ? spanSm(desc, sCLRBLUE) : inputFooter('Tap to select devices...', sCLRGRY, true))
        }

        section(sectHead('Variable Configuration:')) {
            String vdesc = sBLANK
        
            def numvar = 0
            state.globalVars.each { String varname, Map infomap ->
                numvar += settings["var_${varname}"] ? 1 : 0
            }
            vdesc += numvar > 0 ? spanSmBld("Variable${ (numvar > 1) ? 's' : sBLANK}") + spanSmBr(" (${numvar})") : sBLANK
            vdesc += htmlLine(sCLRBLUE, 200)
            vdesc += inputFooter("Tap to select Variables...", sCLRBLUE, false)
            href 'variablesPage', title: spanSmBld('Variable Selection'), description: (vdesc ? spanSm(vdesc, sCLRBLUE) : inputFooter('Tap to select variables...', sCLRGRY, true))
        }

        section(sectHead('App Preferences:')) {
            String vdesc = sBLANK

            vdesc += spanSmBld("Hub Prefix: ", sCLRBLUE) + spanSmBr("${settings.hubprefix}" )
            vdesc += spanSmBld("Weather Tomorrow.io API key: ", sCLRBLUE) + spanSmBr("${settings.weatherapi}" )
            vdesc += spanSmBld("Weather ZipCode: ", sCLRBLUE) + spanSmBr("${settings.weatherzip}" )
            vdesc += htmlLine(sCLRBLUE, 600)
            vdesc += spanSmBld("accessToken: ", sCLRBLUE) + spanSmBr("${state.accessToken}" )
            vdesc += spanSmBld("App ID: ", sCLRBLUE) + spanSmBr("${app.id}" )
            vdesc += spanSmBld("Hubname: ", sCLRBLUE) + spanSmBr("${state.hubname}" )
            vdesc += spanSmBld("Local Endpt: ", sCLRBLUE) + spanSmBr("${state.endpt}" )
            vdesc += spanSmBld("Cloud Endpt: ", sCLRBLUE) + spanSmBr("${state.cloudendpt}" )
            vdesc += spanSmBld("callback IPs: ", sCLRBLUE) + spanSmBr("${settings.webSocketHost}" + ", ${settings.webSocketHost2}" + ", ${settings.webSocketHost3}" )
            vdesc += spanSmBld("callback Ports: ", sCLRBLUE) + spanSmBr("${settings.webSocketPort}" + ", ${settings.webSocketPort2}" + ", ${settings.webSocketPort3}" )
            vdesc += htmlLine(sCLRBLUE, 600)
            vdesc += inputFooter("Tap to update App Preferences...", sCLRBLUE, false)
            href 'settingsPage', title: spanSmBld('App Preferences'), description: vdesc
            label title: spanSmBld('Label this Instance (optional)'), description: 'Rename this App', defaultValue: app?.name, required: false
        }
    }
}

def settingsPage() {
    return dynamicPage(name: 'settingsPage', nextPage: sBLANK, title: sBLANK, install: false, uninstall: false) {

        appInfoSect()

        section("HousePanel Configuration") {
            paragraph "Select a prefix to uniquely identify certain tiles for this hub. "
            input (name: "hubprefix", type: "text", multiple: false, title: "Hub Prefix:", required: false, defaultValue: "h_")
            input (name: "weatherapi", type: "text", multiple: false, title: "Tomorrow.io API key", required: false, defaultValue: "")
            input (name: "weatherzip", type: "text", multiple: false, title: "Zip Code for Weather", required: false, defaultValue: "10001")
            // paragraph "Enable Pistons? You must have WebCore installed for this to work. Beta feature for Hubitat hubs."
            // input (name: "usepistons", type: "bool", multiple: false, title: "Use Pistons?", required: false, defaultValue: false)
            paragraph "Specify these parameters to enable your panel to stay in sync with things when they change in your home. " +
                      "This is required if you are using HousePanel to support an ISY node server. Otherwise, for Hubitat dashboards, "
                      "this is not a hard requirement. However, if you don't provide the IP of where you are hositng your hpserver.js app, your panel will get out of sync. " +
                      "A single Port number or a range can be provided, such as 9100-9105. If a range is given all ports inclusive of the the range will be updated." +
                      "Ranges are inclusive, so 9100-9105 will update ports 9100, 9101, 9102, 9103, 9104, and 9105. "
                      "ISY node server users must set the restPort configuration parameter to a value inside one of these ranges"
            input "webSocketHost", "text", title: "Host IP", defaultValue: "192.168.1.1", required: true
            input "webSocketPort", "text", title: "Port or Range", defaultValue: "9100", required: true
            paragraph "The Alternate 2nd and 3rd Host IP and Port values/ranges are used to send hub pushes to additional installations of HousePanel. " +
                    "If left as 0 additional hub pushes will not occur. Only use this if you are hosting two or three versions of HP " +
                    "that need to stay in sync with this smart home hub. This app also supports the ISY Hubitat Node Server, and for that case " +
                    "you should set one of these to the port used there. Otherwise, this setting is mostly used for development debugging and can be safely left as 0"
            input "webSocketHost2", "text", title: "2nd Host IP", defaultValue: "0", required: false
            input "webSocketPort2", "text", title: "2nd Port or Range", defaultValue: "0", required: false
            input "webSocketHost3", "text", title: "3rd Host IP", defaultValue: "0", required: false
            input "webSocketPort3", "text", title: "3rd Port or Range", defaultValue: "0", required: false
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
            paragraph spanSmBldBr('Description:', sCLRBLUE) + spanSm('Select devices to show in each category below', sCLRBLUE)
            paragraph spanSmBldBr('NOTE: ') + spanSmBldBr('Duplicates are allowed, but not recommended.')
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
        section (sectHead("Thermostats and Climate","thermometer.png")) {
                input "mythermostats", "capability.thermostat", hideWhenEmpty: true, multiple: true, required: false, title: "Thermostats"
                input "mytemperatures", "capability.temperatureMeasurement", hideWhenEmpty: true, multiple: true, required: false, title: "Temperature Measures"
                input "myilluminances", "capability.illuminanceMeasurement", hideWhenEmpty: true, multiple: true, required: false, title: "Illuminance Measurements"
                // input "myweathers", "device.smartweatherStationTile", hideWhenEmpty: true, multiple: true, required: false, title: "Weather tile"
                // input "myaccuweathers", "device.accuweatherDevice", hideWhenEmpty: true, multiple: true, required: false, title: "AccuWeather tile"
        }
        section (sectHead("Water, Sprinklers and Detectors","sprinkler-on.png")) {
                input "mywaters", "capability.waterSensor", hideWhenEmpty: true, multiple: true, required: false, title: "Water Sensors"
                input "myvalves", "capability.valve", hideWhenEmpty: true, multiple: true, required: false, title: "Sprinklers"
                input "mysmokes", "capability.smokeDetector", hideWhenEmpty: true, multiple: true, required: false, title: "Smoke Detectors"
                input "mycosensors", "capability.carbonMonoxideDetector", hideWhenEmpty: true, multiple: true, required: false, title: "CO Detectors"
                input "myco2sensors", "capability.carbonDioxideMeasurement", hideWhenEmpty: true, multiple: true, required: false, title: "CO2 Detectors"
        }
        section (sectHead("Music and Audio","unmute.png")) {
                paragraph "Music things use the legacy Sonos device handler. Audio things use the new Audio handler that works with multiple audio device types including Sonos."
                input "mymusics", "capability.musicPlayer", hideWhenEmpty: true, multiple: true, required: false, title: "Music Players"
                input "myaudios", "capability.audioNotification", hideWhenEmpty: true, multiple: true, required: false, title: "Audio Devices"
        }
        section (sectHead("Other Sensors and Actuators","switchon.png")) {
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
    // state.usepistons = settings?.usepistons ?: false
    state.usepistons = false

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

    state.weatherzip = settings.weatherzip ?: "94070"
    state.weatherapi = settings.weatherapi ?: ""

    state.prefix = settings?.hubprefix ?: getPrefix()
    state.powervals = [:]

    configureHub();
    if ( state.usepistons ) {
        webCoRE_init()
    }
    state.loggingLevelIDE = settings.configLogLevel?.toInteger() ?: 3
    logger("Installed hub ${state.hubname} with settings: ${settings} ", "debug")
    
    def pattern = ~/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/
    def portpatt = ~/\d{3,}-?(\d{3,})?/

    // report and send to servers name=hubname, id=app.id, type=Hubitat, value=array(accessToken, endpt, cloudendpt) 
    // def postHubRange(ip, port, msgtype, name, id, subid, type, value) {
    if ( (state.directIP.startsWith("http") || state.directIP ==~ pattern) && state.directPort ==~ portpatt ) {
        postHubRange(state.directIP, state.directPort, "initialize", state.hubname, app.id, "", "Hubitat", [state.accessToken, state.endpt, state.cloudendpt])
        logger("state changes will be posted to HP at IP: ${state.directIP}:${state.directPort} ", "info")

    } else {
        state.directIP = "0"
    }

    if ( (state.directIP2.startsWith("http") || state.directIP2 ==~ pattern) && state.directPort2 ==~ portpatt ) {
        postHubRange(state.directIP2, state.directPort2, "initialize", state.hubname, app.id, "", "Hubitat", [state.accessToken, state.endpt, state.cloudendpt])
        logger("state changes will also be posted to HP at: ${state.directIP2}:${state.directPort2} ", "info")
    } else {
        state.directIP2 = "0"
    }

    if ( (state.directIP3.startsWith("http") || state.directIP3 ==~ pattern) && state.directPort3 ==~ portpatt ) {
        postHubRange(state.directIP3, state.directPort3, "initialize", state.hubname, app.id, "", "Hubitat", [state.accessToken, state.endpt, state.cloudendpt])
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
    state.endpt = app.getFullLocalApiServerUrl()
    state.cloudendpt = app.getFullApiServerUrl()
    state.hubid = app.getHubUID()
    state.hubname = location.getName()

    logger("You must provide the Access Token and the App ID values. The end point shown will be automatically created","info")
    logger("Access Token = ${state.accessToken}","info")
    logger("App ID = ${app.id}", "info")
    logger("Hub Name = ${state.hubname}", "info")
    logger("Hubitat Local EndPoint = ${state.endpt}", "info")
    logger("Hubitat Cloud EndPoint = ${state.cloudendpt}", "info")
    logger("Hub ID = ${state.hubid}", "info")

    logger("Updates pushed to the following IP addresses and ports","debug")
    logger("1st IP Address = ${state.directIP}", "debug")
    logger("1st Port = ${state.directPort}", "debug")
    logger("2nd IP Address = ${state.directIP2}", "debug")
    logger("2nd Port = ${state.directPort2}", "debug")
    logger("3rd IP Address = ${state.directIP3}", "debug")
    logger("3rd Port = ${state.directPort3}", "debug")
}

def addStatus(resp, item) {
    try {
        def newstatus = item?.getStatus() ?: "UNKNOWN"
        resp["status_"] ? resp["status_"] = newstatus : resp.put("status_", newstatus)
    } catch(e) {
        logger(e, "error")
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
    resp.put("_dim","dim")
    resp.put("_brighten","brighten")
    return resp
}

def getBulb(swid, item=null) {
    def resp = getThing(mybulbs, swid, item)
    resp.put("_dim","dim")
    resp.put("_brighten","brighten")
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
    resp.put("_raise","raise")
    resp.put("_lower","lower")
    return resp
}

def clone(obj) {
    def jsonslurper = new JsonSlurper()
    def strobj = JsonOutput.toJson(obj)
    def newobj = jsonslurper.parseText(strobj)
    return newobj
}

def translateObjects(pvalue, musicmap) {
    Map newvalue = [:]
    def moreobjects = false
    def jsonslurper = new JsonSlurper()
    def tval

    if ( pvalue instanceof Map ) {
        pvalue.each{String tkey, stval -> 
            try {
                tval = jsonslurper.parseText(stval)
            } catch(e) {
                tval = stval
            }

            if ( tval instanceof Map ) {

                // if this key has an object as the value, break it into parts
                tval.each{String jtkey, jtval ->

                    // convert the key using our map
                    if ( musicmap.containsKey(jtkey) ) {
                        jtkey = musicmap[jtkey]
                    }

                    // skip this element if the mapping has an empty string
                    // otherwise add the element. create augmented key if the key exists
                    if ( jtkey != "" ) {
                        // logger("jtkey: ${jtkey} jtval: ${jtval}","warn")

                        // set flag to recurse if there is an object in the value
                        if ( jtval instanceof Map ) {
                            moreobjects = true
                        }
                        if ( newvalue.containsKey(jtkey) ){
                            if ( (jtval!="NA" && jtval!="" && jtval!="undefined") || 
                                (newvalue[jtkey]=="" || newvalue[jtkey]=="NA" || newvlaue[jtkey]=="undefined") ) {
                                newvalue[jtkey] = jtval
                            }
                        } else {
                            newvalue.put(jtkey,jtval)
                        }
                    }
                }

                // if the map includes the key of objects then save the json string in that key
                if ( musicmap.containsKey(tkey) && musicmap[tkey]!="" ) {
                    newvalue.put(tkey, JsonOutput.toJson(tval))
                }

            // if the value is not an object then we save it as-is
            // but change the key using the mapping
            } else {
                if ( musicmap.containsKey(tkey) ) {
                    tkey = musicmap[tkey]
                }

                // skip if the mapping is a blank string
                // overwrite existing fields unless the value is blank or NA or similar
                if ( tkey!="" ) {

                    // fix up image art field
                    if ( tkey == "trackImage" ) {
                        if  (  (tval && tval instanceof String) && tval.indexOf("http")>0 ) {
                            def j1 = tval.indexOf(">http") + 1
                            def j2 = tval.indexOf("<", j1+1)
                            if ( j1==-1 || j2==-1) {
                                tval = ""
                            } else {
                                tval = tval.substring(j1, j2)
                                // must escape backslash twice because it is special in groovy
                                tval = tval.replaceAll("\\\\","")
                            }
                        }
                    }

                    if ( newvalue.containsKey(tkey) ) {
                        if ( (tval!="NA" && tval!="" && tval!="undefined") || 
                             (newvalue[tkey]=="" || newvalue[tkey]=="NA" || newvlaue[tkey]=="undefined") ) {
                            newvalue[tkey] = tval
                        }
                    } else {
                        newvalue.put(tkey,tval)
                    }
                    // newvalue.containsKey(tkey) ? newvalue[tkey] = tval : newvalue.put(tkey, tval)
                }
            }
        }
    }

    // recurse if there are more objects
    if ( moreobjects ) {
        return translateObjects(newvalue, musicmap)
    } else {
        return newvalue
    }
}

// this was updated to use the real key names so that push updates work
// note -changes were also made in housepanel.php and elsewhere to support this
def getMusic(swid, item=null) {

    // now we translate music tiles here instead of inside hpserver
    // this way ISY node server and hpserver both get same info
    // without duplicating the translation code in both places
    def musicmap = ["name": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                    "trackData": "", "metaData":"", "trackMetaData":"trackMetaData",
                    "trackNumber":"trackNumber", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
                    "audioSource": "mediaSource", "station":"",
                    "status": "status", "level":"level", "mute":"mute"]

    def resp = getThing(mymusics, swid, item)
    def pvalue = translateObjects(resp, musicmap)
    logger("original music tile: ${resp}","debug")
    logger("translated music tile: ${pvalue}","debug")

    // get image from metadata of sonos
    String jtval = ""
    String ktval = ""
    if ( pvalue.containsKey("trackMetaData") ) {
        jtval = pvalue["trackMetaData"]
        if ( jtval && jtval instanceof String ) {
            def j1 = jtval.indexOf("https")
            if  ( j1 > 0 ) {
                def j2 = jtval.indexOf("<", j1+1)
                if ( j2 != -1) {
                    jtval = jtval.substring(j1, j2)
                    ktval = jtval.replaceAll("\\\\/","/")
                } else {
                    ktval = ""
                }
                pvalue.containsKey("trackImage") ? pvalue["trackImage"] = ktval : pvalue.put("trackImage",ktval)
            }
            pvalue.remove("trackMetaData")
        }
    }        
    logger("image added to tile: ${pvalue}, jtval: ${jtval}, j1: ${j1}, j2: ${j2}","debug")
    return pvalue
}

// this mapping works for Alexa Speaks echo devices
def getAudio(swid, item=null) {
    def audiomap = ["name":"name", "title":"trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                   "albumArtUrl": "", "mediaSource": "", "deviceIcon":"deviceIcon", "alexaPlaylists":"",
                   "phraseSpoken":"", "supportedMusic":"", "trackData":"", "trackImageHtml":"", "wakeWords":"", "alexaWakeWord":"",
                   "My Likes":"", "deviceFamily":"", "lastUpdated":"", "deviceStatus":"", "onlineStatus":"", "btDeviceConnected":"",
                   "wasLastSpokenToDevice":"", "doNotDisturb":"", "firmwareVer":"", "phraseSpoken":"", "lastAnnouncement":"",
                   "lastVoiceActivity":"", "lastSpeakCmd":"", "wasLastSpokenToDevice":"", "followUpMode":"", "currentStation":"",
                   "deviceSerial":"", "permissions":"", "doNotDisturb":"", "btDevicesPaired":"", "alarmVolume":"", "_togglePlayback":"",
                   "_getDeviceActivity":"", "_noOp":"", "_replayText":"", "_speechTest":"", "_refresh":"refresh", "deviceType":"",
                   "_doNotDisturbOff":"", "_doNotDisturbOn":"", "_getBluetoothDevices":"", "_restoreLastVolume":"", "_stopAllDevices":"",
                   "_disconnectBluetooth":"", "_sendTestAnnouncement":"", "_sendTestAnnouncementAll":"", "_storeCurrentVolume":""]

    def resp = getThing(myaudios, swid, item)
    def pvalue = translateObjects(resp, audiomap)
    logger("original audio tile: ${resp}","debug")
    logger("adjusted audio tile: ${pvalue}","debug")
    return pvalue
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
    def resp = [:]
    if ( item ) {
        resp = [name: item.displayName]
        resp = addBattery(resp, item)
        resp.put("illuminance", item.currentValue("illuminance") )
        resp = addStatus(resp, item)
    }
    return resp
}
def getSmoke(swid, item=null) {
    getThing(mysmokes, swid, item)
}
def getCO(swid, item=null) {
    getThing(mycosensors, swid, item)
}
def getCO2(swid, item=null) {
    getThing(myco2sensors, swid, item)
}

// return temperature for this capability and humidity if it has one
def getTemperature(swid, item=null) {
    item = item ? item : mytemperatures.find{it.id == swid }
    def resp = [:]
    if ( item ) {
        resp = [name: item.displayName]
        resp = addBattery(resp, item)
        resp.put("temperature", item.currentValue("temperature") )
        if ( item.hasAttribute("humidity") ) {
            resp.put("humidity", item.currentValue("humidity") )
        }
        resp = addStatus(resp, item)
    }
    return resp
}

// the weather tile was changed to use tomorrow.io instead of the builtin Hubitat device
// mainly because the builtin device does not seem to work reliably and cannot be customized
// for now I just return the realtime info but later I could do much more including maps
// var obj = [data:
//     [ time:2023-07-15T23:27:00Z, 
//       values:[cloudBase:0.64, cloudCeiling:0.64, cloudCover:69, dewPoint:76.44, freezingRainIntensity:0, humidity:63, precipitationProbability:0, pressureSurfaceLevel:29.24, rainIntensity:0, sleetIntensity:0, snowIntensity:0, temperature:90.5, temperatureApparent:102.72, uvHealthConcern:0, uvIndex:1, visibility:9.94, weatherCode:1102, windDirection:60.19, windGust:9.23, windSpeed:1.4]
//     ], 
//     location:[lat:33.21465301513672, lon:-97.13809204101562, name:Denton, Denton County, Texas, 76201, United States, type:postcode]
// ];
def getWeather(swid, item=null) {
    def host = "https://api.tomorrow.io/v4/weather/realtime"
    def resp = [:]
    if ( state.weatherapi && state.weatherzip ) {
        def nvpstr = "location=${state.weatherzip}&units=imperial&apikey=${state.weatherapi}"
        host = "${host}?${nvpstr}"
        httpGet(host) {getresp ->
            def respcode = getresp.getStatus()
            if ( respcode == 200 ) {
                def respraw = getresp.getData()
                def respdata = respraw["data"]
                resp = respdata["values"]
                resp["temperature"] = Math.round(resp["temperature"])
                resp["temperatureApparent"] = Math.round(resp["temperatureApparent"])
                resp["time"] = respdata["time"]
                def loc = respraw["location"]
                resp["location"] = loc["name"]
            } else {
                resp["error"] = respcode
            }
            resp["subname"] = "Powered by Tomorrow.io"
            logger("weather response code: ${respcode} value: ${resp}", "debug")
        }
    } else {
        resp["subname"] = "API code or Zipcode not set"
    }
    resp["name"] = "Weather"
    // def resp = getDevice(myweathers, swid, item)
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
    def resp = [ name: "Mode", subname: location.getName(), themode: curmode?.getName() ];
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
            resp.put("name", item.displayName)
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
            resp = addStatus(resp, item)
        }
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
    def ignore = ["setLevel","setHue","setSaturation","setColorTemperature","setColor","setAdjustedColor",
                  "enrollResponse","ping","configure","setAssociationGroup","setConfigParameter","release", "poll",
                  "reloadAllCodes","unlockWithTimeout","markDeviceOnline","markDeviceOffline","updateFirmware",
                  "childOff","childOn","childRefresh","childSetLevel","componentOff","componentOn","componentRefresh","componentSetColor",
                  "componentSetColorTemperatures","componentSetLevel","startLevelChange","stopLevelChange"
                  ]
    return ignore
}

// make a generic thing getter to streamline the code
def getThing(things, swid, item=null) {
    def resp = [:]
    item = item ? item : things?.find{it.id == swid }
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
        // we now return commands that have 4 or fewer parameters
        // commands with more than 4 parameters are ignored
        item.getSupportedCommands().each { comm ->
            try {
                def comname = comm.toString()
                def nparms = comm.parameters?.size
                if ( nparms == null ) { nparms = 0 }
                if ( !nparms && !reserved.contains(comname)) {
                    resp.put("_"+comname, comname)
                } else if ( nparms <= 4 && !reserved.contains(comname)) {
                    resp.put("_"+comname, nparms)
                } else {
                    logger("skipped command: ${comname} with ${nparms} parameters","debug")
                }
            } catch (ex) {
                logger("Attempt to read command for ${swid} failed ${ex}", "error")
            }
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
        resp = addStatus(resp, item)
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

// This retrieves and returns all things
// used up front or whenever we need to re-read all things
def getAllThings() {
    def resp = []
    resp = getSwitches(resp)
    resp = getDimmers(resp)
    resp = getShades(resp)
    resp = getButtons(resp)
    resp = getBulbs(resp)
    resp = getContacts(resp)
    resp = getDoors(resp)
    resp = getGarages(resp)
    resp = getLocks(resp)
    resp = getMotions(resp)
    resp = getPresences(resp)
    resp = getThermostats(resp)
    resp = getTemperatures(resp)
    resp = getIlluminances(resp)
    resp = getValves(resp)
    resp = getWaters(resp)
    resp = getMusics(resp)
    resp = getAudios(resp)
    resp = getSmokes(resp)
    resp = getCOs(resp)
    resp = getCO2s(resp)
    resp = getModes(resp)
    resp = getHSMStates(resp)
    resp = getOthers(resp)
    resp = getActuators(resp)
    resp = getPowers(resp)
    resp = getVariables(resp)
    resp = getWeathers(resp)

    // optionally include pistons based on user option
    if (state.usepistons) {
        resp = getPistons(resp)
    }
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
    } catch (e) { logger(e, "error") }
    return resp
}
def getBulbs(resp) {
    try {
        mybulbs?.each {
            def multivalue = getBulb(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "bulb" ]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getDimmers(resp) {
    try {
        mydimmers?.each {
            def multivalue = getDimmer(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "switchlevel" ]
        }
    } catch (e) { logger(e, "error") }
    return resp
}

def getPowers(resp) {
    try {
        mypowers?.each {
            def val = getPower(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "power"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}

def getMotions(resp) {
    try {
        mymotions?.each {
            def multivalue = getMotion(it.id, it)
            def motiontype = it.hasAttribute("presence_type") || it.hasAttribute("roomActivity") ? "aqaramotion" : "motion"
            resp << [name: it.displayName, id: it.id, value: multivalue, type: motiontype]
        }
    } catch (e) {}
    return resp
}
def getContacts(resp) {
    try {
        mycontacts?.each {
            def multivalue = getContact(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "contact" ]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getButtons(resp) {
    try {
        mybuttons?.each {
            def multivalue = getButton(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "button" ]
        }
    } catch (e) { logger(e, "error") }
    return resp
}

def getShades(resp) {
    try {
        myshades?.each {
            def multivalue = getShade(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "shade" ]
        }
    } catch (e) { logger(e, "error") }
    return resp
}

def getLocks(resp) {
    try {
        mylocks?.each {
            def multivalue = getLock(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "lock"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getMusics(resp) {
    try {
        mymusics?.each {
            def multivalue = getMusic(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "music"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getAudios(resp) {
    try {
        myaudios?.each {
            def multivalue = getAudio(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "audio"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}

def getThermostats(resp) {
    try {
        mythermostats?.each {
            def multivalue = getThermostat(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "thermostat" ]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getPresences(resp) {
    try {
        mypresences?.each {
            def multivalue = getPresence(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "presence"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getWaters(resp) {
    try {
        mywaters?.each {
            def multivalue = getWater(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "water"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getValves(resp) {
    try {
        myvalves?.each {
            def multivalue = getValve(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "valve"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getDoors(resp) {
    try {
        mdoors?.each {
            def multivalue = getDoor(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "door"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getGarages(resp) {
    try {
        mygarages?.each {
            def multivalue = getGarage(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "garage"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getIlluminances(resp) {
    try {
        myilluminances?.each {
            def multivalue = getIlluminance(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "illuminance"]
        }
    } catch (e) { logger(e, "error") }
    return resp

}
def getSmokes(resp) {
    try {
        mysmokes?.each {
            def multivalue = getSmoke(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "smoke"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getCOs(resp) {
    try {
        mycosensors?.each {
            def multivalue = getCO(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "cosensor"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getCO2s(resp) {
    try {
        myco2sensors?.each {
            def multivalue = getCO2(it.id, it)
            resp << [name: it.displayName, id: it.id, value: multivalue, type: "co2sensor"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getTemperatures(resp) {
    try {
        mytemperatures?.each {
            def val = getTemperature(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "temperature"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getOthers(resp) {
    try {
        myothers?.each {
            def val = getOther(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "other"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getActuators(resp) {
    try {
        myactuators?.each {
            def val = getActuator(it.id, it)
            resp << [name: it.displayName, id: it.id, value: val, type: "actuator"]
        }
    } catch (e) { logger(e, "error") }
    return resp
}
def getWeathers(resp) {
    def vals = ["weather"]
    try {
        vals.each {
            def wid = "${state.prefix}${it}"
            def val = getWeather(wid)
            resp << [name: val.name, id: wid, value: val, type: "weather"]
        }
    } catch (e) {
        log.debug e
    }
    return resp
}

def getHubInfo() {
    def resp =  [ sitename: location.getName(),
                  appId: app.id,
                  hubId: state.hubid,
                  accessToken: state.accessToken,
                  endpt: state.endpt,
                  cloudendpt: state.cloudendpt,
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
    else if ( mymotions?.find{it.id.toInteger() == swid && (it.hasAttribute("presence_type") || it.hasAttribute("roomActivity")) } ) { swtype = "aqaramotion" }
    else if ( mymotions?.find{it.id.toInteger() == swid && !it.hasAttribute("presence_type") && !it.hasAttribute("roomActivity") } ) { swtype = "motion" }
    else if ( mydoors?.find{it.id.toInteger() == swid } ) { swtype= "door" }
    else if ( mygarages?.find{it.id.toInteger() == swid } ) { swtype= "garage" }
    else if ( mycontacts?.find{it.id.toInteger() == swid } ) { swtype= "contact" }
    else if ( mywaters?.find{it.id.toInteger() == swid } ) { swtype= "water" }
    else if ( myvalves?.find{it.id.toInteger() == swid } ) { swtype= "valve" }
    else if ( myilluminances?.find{it.id.toInteger() == swid } ) { swtype= "illuminance" }
    else if ( mysmokes?.find{it.id.toInteger() == swid } ) { swtype= "smoke" }
    else if ( mycosensors?.find{it.id.toInteger() == swid } ) { swtype= "cosensor" }
    else if ( myco2sensors?.find{it.id.toInteger() == swid } ) { swtype= "co2sensor" }
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
    def cmdresult = [:]
    logger("doaction params: cmd= $cmd type= $swtype id= $swid subid= $subid attr= $swattr", "debug")
   
    // get the type if auto is set
    if ( (swtype=="auto" || swtype=="none" || !swtype) && swid ) {
        swtype = autoType(swid)
    } else if ( swid=="" || swid==null || swid==false ) {
        logger("Invalid device id in doAction call","warn")
        return cmdresult
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

      case "audio" :
        cmdresult = setAudio(swid, cmd, swattr, subid)
        break

      // note: this requires a special handler for motion to manually set it
      case "motion" :
      case "aqaramotion":
        cmdresult = setMotion(swid, cmd, swattr, subid)
        break

      case "mode" :
        cmdresult = setMode(swid, cmd, swattr, subid)
        break

      case "hsm" :
        cmdresult = setHSMState(swid, cmd, swattr, subid)
        break;
 
      case "valve" :
        cmdresult = setValve(swid, cmd, swattr, subid)
        break

      case "contact" :
      	 cmdresult = setContact(swid, cmd, swattr, subid)
         break

      case "door" :
      	 cmdresult = setDoor(swid, cmd, swattr, subid)
         break

      case "garage" :
      	 cmdresult = setGarage(swid, cmd, swattr, subid)
         break

      case "piston" :
        cmdresult = setPiston(swid, cmd, swattr, subid)
        break

      case "water" :
        cmdresult = setWater(swid, cmd, swattr, subid)
        break

      case "button":
        cmdresult = setButton(swid, cmd, swattr, subid)
        break

      case "actuator":
        cmdresult = setActuator(swid, cmd, swattr, subid)
        break

      case "other" :
        cmdresult = setOther(swid, cmd, swattr, subid)
        break
        
      case "power" :
        cmdresult = setPower(swid, cmd, swattr, subid)
        break

      case "presence" :
        cmdresult = setPresence(swid, cmd, swattr, subid)
        break
    
      case "variables" :
        cmdresult = setVariable(swid, cmd, swattr, subid)
        break

      case "smoke" :
        cmdresult = setSmoke(swid, cmd, swattr, subid)
        break

      case "cosensor":
        cmdresult = setCO(swid, cmd, swattr, subid)
        break

      case "co2sensor":
        cmdresult = setCO2(swid, cmd, swattr, subid)
        break

      default:
        logger("unrecognized device type to control: ${swtype} in doAction routine", "warn")
        break

    }
    logger("doAction results for ${swtype} = ${cmdresult}", "debug")
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
    case "aqaramotion":
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
        
    case "cosensor" :
        cmdresult = getCO(swid)
        break
        
    case "co2sensor" :
        cmdresult = getCO2(swid)
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

def sendCommand(item, subid, cmd) {

    if ( subid.startsWith("_" ) ) {
        subid = subid.substring(1)
    }

    // skip if not supported or ignored but also try using the cmd
    def reserved = ignoredCommands()
    try {
        if ( reserved.contains(subid) || !item.hasCommand(subid) ) {
            if ( cmd && !reserved.contains(cmd) && item.hasCommand(cmd) ) {
                item."$cmd"()
                return true
            }
            return false
        }
    } catch(e) {
        // item."$cmd"()
        return false
    }

    // first situation is a command with no parameters
    def status = true
    if ( cmd == subid || cmd=="0" || !cmd ) {
        item."$subid"()
    
    // a single parameter passed in the cmd variable
    } else if ( cmd.toString().indexOf("|") == -1 ) {
        item."$subid"(cmd)
    // multiple variables passed in cmd with separater | string
    } else {
        cmd = cmd.toString()
        def parm = cmd.split(/\|/)
        def n = parm.size()
        if (n == 1) {
            item."$subid"(parm[0])
        } else if (n == 2) {
            item."$subid"(parm[0], parm[1])
        } else if (n == 3) {
            item."$subid"(parm[0], parm[1], parm[2])
        } else if (n == 4) {
            item."$subid"(parm[0], parm[1], parm[2], parm[3])
        } else {
            logger("Command ${subid} skipped with ${n} parameters - this many parameters are not supported", "warn")
            status = false
        }
    }
    return status
}

def setPiston(swid, cmd, swattr, subid) {
    def resp = [:]
    if ( state.usepistons ) {
        webCoRE_execute(swid)
        resp = getPiston(swid)
    }
    return resp
}

def setSwitch(swid, cmd, swattr, subid) {
    logcaller("setSwitch", swid, cmd, swattr, subid)
    def resp = setGenericLight(myswitches, "switch", swid, cmd, swattr, subid)
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

    if ( item ) {
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
            sendCommand(item, subid, cmd)
            resp.put("contact", item.currentValue("contact"))
        }
    }
    return resp
}

def setGarage(swid, cmd, swattr, subid) {
    logcaller("setGarage", swid, cmd, swattr, subid)
    setGenericDoor(mygarages, swid, cmd, swattr, subid)
}

def setGenericDoor(things, swid, cmd, swattr, subid, item=null) {
    def newonoff
    def resp = [:]
    item  = item ? item : things.find{it.id == swid }
    if (item) {
        if ( subid=="door" && (cmd=="open" || cmd=="OPEN" || swattr.endsWith(" closed") || swattr.endsWith(" closing") ) ) {
            item.open()
        } else if ( subid=="door" && (cmd=="close" || cmd=="CLOSE" || swattr.endsWith(" open") || swattr.endsWith(" opening") ) ) {
            item.close()
        } else if ( subid=="switch" && item.hasAttribute("switch") && item.currentValue(subid)=="off" && item.hasCommand("on") ) {
            item.on()
        } else if ( subid=="switch" && item.hasAttribute("switch") && item.currentValue(subid)=="on" && item.hasCommand("off") ) {
            item.off()
        } else {
            sendCommand(item, subid, cmd)
        }

        if ( item.hasAttribute("door") ) {
            resp.put("door", item.currentValue("door") )
        }
        if ( item.hasAttribute("contact") ) {
            resp.put("contact", item.currentValue("contact") )
        }
        if ( item.hasAttribute("switch") ) {
            resp.put("switch", item.currentValue("switch") )
        }
    }
    return resp
}

// shades are really different than doors and lights so had to write a special routine
def setShade(swid, cmd, swattr, subid) {
    logcaller("setShade", swid, cmd, swattr, subid)
    def item  = myshades.find{it.id == swid }
    def resp = [:]

    if (item ) {
        def newposition = false
        def newonoff = item.currentValue("windowShade")
        def curposition = item.currentValue("position").toInteger()
        def newname = item.displayName

        if (subid.startsWith("_")) {
            subid = subid.substring(1)
        }

        // handle cases where shade icon is clicked on - either opens or closes
        if ( subid=="windowShade" ) {
            if ( cmd=="close" || swattr.endsWith(" open" ) || (swattr.endsWith(" partially_open") && curposition >= 50) ) {
                cmd = "close"
                newonoff = "closing"
                item.close()
                newposition = 0
                item.setPosition(newposition)
            } else if ( cmd=="open" || swattr.endsWith(" closed") || (swattr.endsWith(" partially_open") && curposition < 50) ) {
                cmd = "open"
                newonoff = "opening"
                item.open()
                newposition = 100
                item.setPosition(newposition)
            } else if ( item.hasCommand(cmd) ) {
                newposition = curposition
                item."$cmd"()
            }

        } else if ( subid=="level-up" || subid=="position-up" || subid=="raise" ) {
            newposition = curposition
            def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
            if ( del > 10 ) { del = 10 }
            newposition = (newposition >= 100 - del) ? 100 : newposition + del
            logger("new position = ${newposition} del = ${del}", "debug")
            item.setPosition(newposition)
            if ( item.hasAttribute("level") ) {
                item.setLevel(newposition)
            }

        } else if ( subid=="level-dn" || subid=="position-dn" || subid=="lower" ) {

            // 
            newposition = curposition
            def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
            if ( del > 10 ) { del = 10 }
            // del = (newposition % del) == 0 ? del : newposition % del
            newposition = (newposition <= del) ? 0 : newposition - del
            logger("new position = ${newposition} del = ${del}", "debug")
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
            sendCommand(item, subid, cmd)
            newposition = item.currentValue("position")
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
    def resp = [:]
    def newsw
    def item  = mymotions.find{it.id == swid }
    logcaller("setMotion", swid, cmd, swattr, subid)

    if (item ) {
        sendCommand(item, subid, cmd)
        resp = getMotion(swid, item)
    }
    return resp
}

// replaced this code to treat bulbs as Hue lights with color controls
def setBulb(swid, cmd, swattr, subid) {
    logcaller("setBulb", swid, cmd, swattr, subid)
    def resp = setGenericLight(mybulbs, "bulb", swid, cmd, swattr, subid)
    return resp
}

def setPresence(swid, cmd, swattr, subid) {
    logcaller("setPresence", swid, cmd, swattr, subid)
    def resp = [:]
    item  = item ? item : mypresences.find{it.id == swid }
    if ( item ) {
        sendCommand(item, subid, cmd)
        resp = getPresence(swid, item)
    }
    return resp
}

// new way of processing buttons using user provided button numbers
// a non-zero button number must be passed into cmd
// and the command signalled from the subid value
def setButton(swid, cmd, swattr, subid, item=null ) {
    logcaller("setButton", swid, cmd, swattr, subid, "debug")
    def resp = [:]
    def butmap = ["pushed": "push", "held":"hold", "doubleTapped": "doubleTap", "released": "release"]
    def revmap = ["push": "pushed", "hold":"held", "doubleTap": "doubleTapped", "release": "released"]
    subid = subid.toString()

    item  = item ? item : mybuttons.find{it.id == swid }
    if ( item ) {
        def buttonnum = cmd.isNumber() ? cmd.toInteger() : 1

        def isgood = sendCommand(item, subid, buttonnum)
        if ( isgood ) {
            if ( subid.startsWith("_" ) ) { subid = subid.substring(1) }
            def btn = revmap[subid] ?: ""
            if ( btn ) {
                resp.put(btn, buttonnum)
            } else {
                resp = getButton(swid, item)
            }
        } else {
            resp = [:]
            if ( subid == "numberOfButtons" ) {
                def numbuttons = item.currentValue("numberOfButtons")
                resp.put(subid, numbuttons)
            } else { 
                cmd = butmap[subid] ?: "";
                if ( cmd ) {
                    sendCommand(item, cmd, buttonnum)
                    resp.put(subid, buttonnum)
                }
            }
        }
        logger("subid = ${subid} cmd = ${cmd} buttonnum = ${buttonnum}","debug")
    } else {
        logger("button item with id = ${swid} not found","warn")
    }
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
    item  = item ? item : myothers.find{it.id == swid }
    def resp = setActuator(swid, cmd, swattr, subid, item)
    return resp
}

def setActuator(swid, cmd, swattr, subid, item=null ) {
    def resp = [:]
    def newsw
    item  = item ? item : myactuators.find{it.id == swid }
    def lightflags = ["switch","level","hue","saturation","colorTemperature","color"]
    def doorflags = ["door","contact"]
    def buttonflags = ["pushed","held","doubleTapped","released","_push","_hold","_doubleTap","_release"]
    
    if ( item ) {
        logcaller(item.getDisplayName(), swid, cmd, swattr, subid, "debug")

        if ( lightflags.contains(subid) ) {
            resp = setGenericLight(myothers, "actuator", swid, cmd, swattr, subid, item)
        } else if ( doorflags.contains(subid) ) {
            resp = setGenericDoor(myothers, swid, cmd, swattr, subid, item)
        } else if ( subid=="windowShade" ) {
            resp = setShade(swid, cmd, swattr, subid)
        // handle sliders
        } else if ( subid=="level" && item.hasCommand("setLevel") ) {
            newvol = cmd.toInteger()
            item.setLevel(newvol)
            resp["level"] = newvol
        } else if ( subid=="volume" && item.hasCommand("setVolume") ) {
            newvol = cmd.toInteger()
            item.setVolume(newvol)
            resp["volume"] = newvol
        // handle broadcom IR devices before buttons since that uses _push function
        } else if ( item.hasCommand("learnIR") && item.hasCommand("learnRF") ) {
            def succ = sendCommand(item, subid, cmd)
            if ( !succ ) {
                logger("invalid command in setActuator for Broadlink IR device. swid= ${swid}, subid= ${subid}, cmd= ${cmd}", "warn")
            }
            resp["acitivity"] = item.currentValue("activity")
        } else if ( buttonflags.contains(subid) && !item.hasCommand("learnIR") ) {
            resp = setButton(swid, cmd, swattr, subid, item)
        } else {
            def isgood = sendCommand(item, subid, cmd)
            if ( !isgood ) {
                logger("invalid command. swid= ${swid}, subid= ${subid}, cmd= ${cmd}", "warn")
            }
            resp = getActuator(swid, item)
        }
    }
    return resp
}

def setThing(swid, cmd, swattr, subid, item ) {
    def resp = [:]
    try {
        def isgood = sendCommand(item, subid, cmd)
        if ( !isgood ) {
            logger("no command was processed in setThing for swid= ${swid}, cmd= ${cmd}", "warn")
        }
        resp = getThing(swid, item)
    } catch(e) {
        logger(e, "warn")
    }
    return resp
}

// control audio devices
// much like music but the buttons are real commands
def setAudio(swid, cmd, swattr, subid) {
    def resp = [:]
    def item  = myaudios.find{it.id == swid }
    
    if ( item ) {
        logcaller(item.getDisplayName(), swid, cmd, swattr, subid)
        // resp = getAudio(swid, item)

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
            def newvol
            try {
                newvol = cmd.toInteger()
            } catch (e) {
                newvol = item.currentValue("volume")
            }
            item.setVolume(newvol)
            resp["volume"] = newvol
        } else {
            sendCommand(item, subid, cmd)
            resp = getAudio(swid, item)
        }
    }
    return resp
}

// handle water devices
def setWater(swid, cmd, swattr, subid) {
    logcaller("setWater", swid, cmd, swattr, subid)
    def resp = [:]
    def item  = mywaters.find{it.id == swid }
    if (item) {
        def newsw = item.currentValue
        if ( subid=="water" && swattr.endsWith(" dry") && item.hasCommand("wet") ) {
            item.wet()
        } else if ( subid=="water" && swattr.endsWith(" wet") && item.hasCommand("dry") ) {
            item.dry()
        } else {
            sendCommand(item, subid, cmd)
        }
        resp = getThing(mywaters, swid, item)
    }
    return resp

}

def setMode(swid, cmd, swattr, subid) {
    logcaller("setMode", swid, cmd, swattr, subid)
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
    def resp =  [ themode: newsw ];
    
    return resp
}

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
    def resp = setGenericLight(mydimmers, "switchLevel", swid, cmd, swattr, subid)
    return resp
}

// handle functions for bulbs, dimmers, and lights
// hardened this to also handle regular switches
// this is way more complex than I like but it has to handle a bunch
// of potential GUI options for processing dimmers and colors
// up and down arrows, sliders, etc. 
// and it has to handle API calls that could have all sorts of options
def setGenericLight(mythings, devtype, swid, cmd, swattr, subid, item= null) {
    def resp = [:]
    item  = item ? item : mythings.find{it.id == swid }
    def hue = false
    def saturation = false
    def temperature = false
    def newcolor = false
    def newlevel = false
    def newname = item.displayName
    def swtrigger = "switch"
    def origcmd = cmd
    
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
        // the GUI now sends the proper cmd value to toggle light when clicked
        // the API or other app such as the ISY nodeserver should send the proper cmd too
        case "switch":
            if ( cmd=="off" || swattr.endsWith(" on" ) || swattr.endsWith(" flash") ) {
                item.off()
                newonoff = "off"
            } else if ( cmd=="flash" ) {
                item.flash()
                newonoff = "flash"
            } else if ( cmd=="on" || swattr.endsWith(" off" ) ) {
                item.on()
                newonoff = "on"
            } else if ( cmd=="toggle" ) {
                newonoff=="off" ? item.on() : item.off()
                newonoff = newonoff=="off" ? "on" : "off"
            }
            break

        case "contact":
            if ( item.hasCommand("close") && (cmd=="close" || swattr.endsWith(" open" )) ) {
                item.close()
            } else if ( item.hasCommand("open") && (cmd=="open" || swattr.endsWith(" closed" )) ) {
                item.open()
            }
            break

        // handle cases where switches have buttons
        // in such a case the button to be pressed must be in the cmd value
        case "_push":
        case "_hold":
        case "_doubleTap":
        case "_release":
        case "pushed":
        case "held":
        case "doubleTapped":
        case "released":
            return setButton(swid, cmd, swattr, subid, item)
            break

        // enable name change
        case "name":
            newname = cmd
            break
         
        case "level-up":
        case "_brighten":
            if ( item.hasAttribute("level") ) {
                newlevel = item.currentValue("level")
                newlevel = newlevel.toInteger()
                def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
                if ( del > 10 ) { del = 10 }
                newlevel = (newlevel >= 100 - del) ? 100 : newlevel - ( newlevel % del ) + del
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
                newonoff = "on"
            }
            break
              
        case "level-dn":
        case "_dim":
            if ( item.hasAttribute("level") ) {
                newlevel = item.currentValue("level")
                newlevel = newlevel.toInteger()
                def del = (cmd.isNumber() && cmd > 0) ? cmd.toInteger() : 5
                if ( del > 10 ) { del = 10 }
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
            if ( cmd.isNumber() && item.hasAttribute("hue") ) {
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
            }
            break
              
        case "hue-dn":
            if ( cmd.isNumber() && item.hasAttribute("hue") ) {
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
            }
            break
              
        case "hue":
            if ( cmd.isNumber() && item.hasAttribute("hue") ) {
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
            }
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
                logger("color click: hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")
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
                logger("color command: , r,g,b = ${r}, ${g}, ${b}, hue= ${hue100}, h= ${h}, s= ${s}, v= ${v}, newcolor= ${newcolor}","debug")                
            }
            break
              
        default:
            sendCommand(item, subid, cmd)
            break               
        }

        // return the fields that were changed
        resp = ["name": newname]
        if ( item.hasAttribute("switch") && (newonoff=="on" || newonoff=="off" || newonoff=="flash") ) {
            resp.put(swtrigger, newonoff)
        }
        if ( item.hasAttribute("color") && newcolor ) { resp.put("color", newcolor) }
        if ( item.hasAttribute("hue") && hue ) { resp.put("hue", hue) }
        if ( item.hasAttribute("saturation") && saturation ) { resp.put("saturation", saturation) }
        if ( item.hasAttribute("colorTemperature") && temperature ) { resp.put("colorTemperature", temperature) }
        if ( item.hasAttribute("level") && newlevel ) { resp.put("level", newlevel) }
        if ( item.hasAttribute("position") && newlevel ) { resp.put("position", newlevel) }

        // do this so that user created TEXT fields using the customizer will return the custom command
        if ( subid.startsWith("_") ) {
            def value = cmd ?: subid.substring(1)
            resp.put(subid, value)
            postHubRange(state.directIP, state.directPort, "update", newname, swid, subid, devtype, value)
            postHubRange(state.directIP2, state.directPort2, "update", newname, swid, subid, devtype, value)
            postHubRange(state.directIP3, state.directPort3, "update", newname, swid, subid, devtype, value)
            logger("thing update: ${newname} id ${swid} type ${devtype} by changing ${subid} to ${value}", "info")
        }
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
    def resp = [:]
    def newsw
    def item  = mylocks?.find{it.id == swid }
    if (item) {
        if ( subid=="lock" ) {
            if (cmd=="toggle") {
                newsw = item.currentLock=="locked" ? "unlocked" : "locked"
                if ( newsw=="locked" ) {
                    item.lock()
                } else {
                    item.unlock()
                }
            } else if ( subid=="lock" && (cmd=="lock" || swattr.endsWith(" unlocked") ) ) {
                item.lock()
                newsw = "locked";
            } else if ( subid=="lock" && (cmd="unlock" || swattr.endsWith(" locked") ) ) {
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
            }
        } else {
            sendCommand(item, subid, cmd)
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
    def resp = [:]
    def item  = myvalves.find{it.id == swid }
    if (item) {
        def newsw = item.currentValue("valve")
        if ( subid=="valve" && swattr.endsWith(" open") ) {
            item.close()
        } else if ( subid=="valve" && swattr.endsWith(" closed") ) {
            item.open()
        } else if ( subid=="switch" && (cmd=="off" || swattr.endsWith(" on")) && item.hasCommand("off") ) {
            item.off()
        } else if ( subid=="switch" && (cmd=="on" || swattr.endsWith(" off")) && item.hasCommand("on") ) {
            item.on()
        } else {
            sendCommand(item, subid, cmd)
        }
        resp = getThing(myvalves, swid, item)
    }
    return resp
}

def setPower(swid, cmd, swattr, subid) {
    def item  = mypowers.find{it.id == swid }
    def resp = [:]
    if ( item ) {
        resp = setThing(swid, cmd, swattr, subid, item )
    } else {
        logger("device not found to control. swid: ${swid}, cmd: ${cmd}, attr: ${swattr}, subid: ${subid}", warn)
    }
    return resp
}

def setSmoke(swid, cmd, swattr, subid) {
    def resp = [:]
    def item  = mysmokes.find{it.id == swid }
    if ( item ) {
        resp = setThing(swid, cmd, swattr, subid, item )
    } else {
        logger("device not found to control. swid: ${swid}, cmd: ${cmd}, attr: ${swattr}, subid: ${subid}", warn)
    }
    return resp
}

def setCO(swid, cmd, swattr, subid) {
    def resp = [:]
    def item  = mycosensors.find{it.id == swid }
    if ( item ) {
        resp = setThing(swid, cmd, swattr, subid, item )
    } else {
        logger("device not found to control. swid: ${swid}, cmd: ${cmd}, attr: ${swattr}, subid: ${subid}", warn)
    }
    return resp
}

def setCO2(swid, cmd, swattr, subid) {
    def resp = [:]
    def item  = myco2sensors.find{it.id == swid }
    if ( item ) {
        resp = setThing(swid, cmd, swattr, subid, item )
    } else {
        logger("device not found to control. swid: ${swid}, cmd: ${cmd}, attr: ${swattr}, subid: ${subid}", warn)
    }
    return resp
}

def setThermostat(swid, cmd, swattr, subid) {
    logcaller("setThermostat", swid, cmd, swattr, subid)
    def resp = [:]
    def newsw
    def item  = mythermostats.find{it.id == swid }


    if (item) {

        try {
            cmd = cmd.toInteger()
            cmd = Math.min(90, cmd)
            cmd = Math.max(50, cmd)
        } catch(e) { 
            if ( subid.endsWith("-up") || subid.endsWith("-dn") || subid=="heatingSetpoint" || subid=="coolingSetpoint" ) {
                cmd = item.currentValue("temperature")
            } else if ( !subid.startsWith("_") ) {
                logger("Temperature is not passed into the cmd value for a thermostat non-command click. This is legacy HP behavior. subid=${subid}, cmd=${cmd}", "warn")
            }
        }

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
           
        // define actions for python end points
        // if no action is taken the full state is returned
        else {
            logger("subid = ${subid} cmd = ${cmd}", "debug")
            sendCommand(item, subid, cmd)
            resp = getThermostat(swid, item)
        }
      
    }
    return resp
}

def setMusic(swid, cmd, swattr, subid) {
    logcaller("setMusic", swid, cmd, swattr, subid)
    def resp = [:]
    def item  = mymusics.find{it.id == swid }
    def newsw
    if (item) {
        resp = getMusic(swid, item)
        
        // fix old bug from addition of extra class stuff
        // had to fix this for all settings
        if ( (subid=="mute" && (cmd=="mute" || swattr.contains(" unmuted" ))) || subid=="_mute" ) {
            newsw = "muted"
            item.mute()
            resp['mute'] = newsw
        } else if ( (subid=="mute" && (cmd=="unmute" || swattr.contains(" muted" ))) || subid=="_unmute" ) {
            newsw = "unmuted"
            item.unmute()
            resp['mute'] = newsw
        } else if ( subid=="level-up" || subid=="_levelUp" || subid=="volume-up" ) {
            newsw = cmd.toInteger()
            newsw = (newsw >= 95) ? 100 : newsw - (newsw % 5) + 5
            item.setLevel(newsw)
            resp['level'] = newsw
            resp["volume"] = newsw
        } else if ( subid=="level-dn" || subid=="_levelDown" || subid=="volume-dn" ) {
            newsw = cmd.toInteger()
            def del = (newsw % 5) == 0 ? 5 : newsw % 5
            newsw = (newsw <= 5) ? 0 : newsw - del
            item.setLevel(newsw)
            resp['level'] = newsw
            resp["volume"] = newsw
        } else if ( subid=="_groupVolumeUp" || subid=="_volumeUp" ) {
            def grpvol = item.currentValue("volume")
            grpvol = (grpvol > 95) ? 100 : grpvol + 5
            item.setVolume(grpvol)
            resp["level"] = grpvol
            resp["volume"] = grpvol
        } else if ( subid=="_groupVolumeDown" || subid=="_volumeDown" ) {
            def grpvol = item.currentValue("volume")
            grpvol = (grpvol < 5) ? 0 : grpvol - 5
            item.setVolume(grpvol)
            resp["level"] = grpvol
            resp["volume"] = grpvol
        } else if ( subid=="level" || subid=="volume" ) {
            newvol = cmd.toInteger()
            item.setLevel(newvol)
            resp["level"] = newvol
            resp["volume"] = newvol
        } else if ( subid=="_setVolume" || subid=="_setLevel" ) {
            def newvol = cmd.toInteger()
            resp["level"] = newvol
            resp["volume"] = newvol
            item.setLevel(newvol)
        } else {
            sendCommand(item, subid, cmd)
            resp = getMusic(swid, item)
        }
    }
    return resp
}

def registerAll() {
    List mydevices = ["myswitches", "mydimmers", "mybulbs", "mypresences", "mybuttons",
                      "mymotions", "mycontacts", "mydoors", "mygarages", "mylocks", "mythermostats", "myshades",
                      "mytemperatures", "myilluminances", "myweathers",
                      "mywaters", "mysmokes", "mycosensors", "myco2sensors", 
                      "mymusics", "myaudios", "mypowers", "myothers", "myactuators"]

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
def register_mycosensors() {
    registerChangeHandler(settings?.mycosensors)
}
def register_myco2sensors() {
    registerChangeHandler(settings?.myco2sensors)
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

    def musicmap = ["name": "trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                    "trackData": "", "metaData":"", "trackMetaData":"trackImage",
                    "trackNumber":"trackNumber", "music":"", "trackUri":"", "uri":"", "transportUri":"", "enqueuedUri":"",
                    "audioSource": "mediaSource", "station":"",
                    "status": "status", "level":"level", "mute":"mute"]

    def audiomap = ["name":"name", "title":"trackDescription", "artist": "currentArtist", "album": "currentAlbum",
                   "albumArtUrl": "", "mediaSource": "", "deviceIcon":"deviceIcon", "alexaPlaylists":"",
                   "phraseSpoken":"", "supportedMusic":"", "trackData":"", "trackImageHtml":"", "wakeWords":"", "alexaWakeWord":"",
                   "My Likes":"", "deviceFamily":"", "lastUpdated":"", "deviceStatus":"", "onlineStatus":"", "btDeviceConnected":"",
                   "wasLastSpokenToDevice":"", "doNotDisturb":"", "firmwareVer":"", "phraseSpoken":"", "lastAnnouncement":"",
                   "lastVoiceActivity":"", "lastSpeakCmd":"", "wasLastSpokenToDevice":"", "followUpMode":"", "currentStation":"",
                   "deviceSerial":"", "permissions":"", "doNotDisturb":"", "btDevicesPaired":"", "alarmVolume":"", "_togglePlayback":"",
                   "_getDeviceActivity":"", "_noOp":"", "_replayText":"", "_speechTest":"", "_refresh":"refresh", "deviceType":"",
                   "_doNotDisturbOff":"", "_doNotDisturbOn":"", "_getBluetoothDevices":"", "_restoreLastVolume":"", "_stopAllDevices":"",
                   "_disconnectBluetooth":"", "_sendTestAnnouncement":"", "_sendTestAnnouncementAll":"", "_storeCurrentVolume":""]

    def src = evt?.source
    def deviceid = evt?.deviceId
    def deviceName = evt?.displayName
    def subid = evt?.name
    def value = evt?.value
    def skip = false
    def jsonslurper = new JsonSlurper()
    
    def devtype = autoType(deviceid)
    logger("handling id = ${deviceid} devtype = ${devtype} name = ${deviceName} subid = ${subid} value = ${value}", "trace")

    // handle power changes to skip if not changed by at least 15%
    // this value was set by trial and error for my particular plug
    if ( subid=="power" ) {
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
    
    // log.info "Sending ${src} Event ( ${deviceName}, ${deviceid}, ${subid}, ${value} ) to HousePanel clients  log = ${state.loggingLevelIDE}"
    // log.info "skip= ${skip} deviceName= ${deviceName} subid= ${subid} value= ${value}"
    if ( !skip && deviceName && deviceid && subid && value) {

        def item = mybulbs?.find{it.id.toInteger() == deviceid.toInteger()}
        if ( (subid=="hue" || subid=="saturation" || subid=="level" || subid=="color") && item && item.hasAttribute("color") ) {

            // fix color bulbs - force subid to color if hue, saturation, or level changes
            def h
            def h100
            def s
            def v 
            def c
            def color
            if ( subid == "color" && value.substring(0,1)=="#") {
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
                h100 = subid=="hue" ? value.toInteger() : item.currentValue("hue").toInteger()
                s = subid=="saturation" ? value.toInteger() : item.currentValue("saturation").toInteger()
                v = subid=="level" ? value.toInteger() : item.currentValue("level").toInteger()
                // c = subid=="colorTemperature" ? value.toInteger() : item.currentValue("colorTemperature").toInteger()
                h = mapMinMax(h100,0,100,0,360)     //  Math.round((h100*360)/100)
                color = hsv2rgb(h, s, v)
            }

            // for colors we have to set all parameters at the same time to avoid race conditions
            // changed this to use an object and send the actual trigger flag so that LIST now works
            // and the object logic using a Map is now generic and not specific to color arrays
            // def colorarray = [h100, s, v, color]
            Map colorarray = [hue: h100, saturation: s, level: v, color: color];
            postHubRange(state.directIP, state.directPort, "update", deviceName, deviceid, subid, devtype, colorarray)
            postHubRange(state.directIP2, state.directPort2, "update", deviceName, deviceid, subid, devtype, colorarray)
            postHubRange(state.directIP3, state.directPort3, "update", deviceName, deviceid, subid, devtype, colorarray)
            logger("color update: ${deviceName} id ${deviceid} type ${devtype} changed to ${color} by changing ${subid} to ${value}, h100: ${h100}, h: ${h}, s: ${s}, v: ${v} ", "info") 
        } else if ( devtype=="music" && subid=="trackData" ) {
            def newvalue = jsonslurper.parseText(value)
            newvalue = translateObjects(newvalue, musicmap)
            postHubRange(state.directIP, state.directPort, "update", deviceName, deviceid, subid, devtype, newvalue)
            postHubRange(state.directIP2, state.directPort2, "update", deviceName, deviceid, subid, devtype, newvalue)
            postHubRange(state.directIP3, state.directPort3, "update", deviceName, deviceid, subid, devtype, newvalue)
            logger("thing update: ${deviceName} id ${deviceid} type ${devtype} by changing ${subid} to ${newvalue}", "info")
        } else if ( devtype=="audio" && subid=="trackData" ) {
            def newvalue = jsonslurper.parseText(value)
            newvalue = translateObjects(newvalue, audiomap)            
            postHubRange(state.directIP, state.directPort, "update", deviceName, deviceid, subid, devtype, newvalue)
            postHubRange(state.directIP2, state.directPort2, "update", deviceName, deviceid, subid, devtype, newvalue)
            postHubRange(state.directIP3, state.directPort3, "update", deviceName, deviceid, subid, devtype, newvalue)
            logger("thing update: ${deviceName} id ${deviceid} type ${devtype} by changing ${subid} to ${newvalue}", "info")
        } else {
            // make the original attribute change
            postHubRange(state.directIP, state.directPort, "update", deviceName, deviceid, subid, devtype, value)
            postHubRange(state.directIP2, state.directPort2, "update", deviceName, deviceid, subid, devtype, value)
            postHubRange(state.directIP3, state.directPort3, "update", deviceName, deviceid, subid, devtype, value)
            logger("thing update: ${deviceName} id ${deviceid} type ${devtype} by changing ${subid} to ${value}", "info")
        }

    }
}

def modeChangeHandler(evt) {
    // modified to simplify modes to only deal with one tile
    // send group of hub actions for mode changes
    def themode = evt?.value
    def deviceName = evt?.displayName
    def subid = evt?.name
    def modeid = "${state.prefix}mode"
    if (themode && deviceName) {
        postHubRange(state.directIP, state.directPort, "update", deviceName, modeid, "themode", "mode", themode)
        postHubRange(state.directIP2, state.directPort2, "update", deviceName, modeid, "themode", "mode", themode)
        postHubRange(state.directIP3, state.directPort3, "update", deviceName, modeid, "themode", "mode", themode)
        logger("New mode= ${themode} with subid= ${subid},  id= ${modeid}, name= ${deviceName} to HousePanel clients", "info")
    }
}

def hsmStatusHandler(evt) {
    // modified to simplify modes to only deal with one tile
    // send group of hub actions for mode changes
    def themode = evt?.value
    def deviceName = evt?.displayName
    def subid = evt?.name
    def modeid = "${state.prefix}hsm"
    if (themode && deviceName) {
        postHubRange(state.directIP, state.directPort, "update", deviceName, modeid, "state", "hsm", themode)
        postHubRange(state.directIP2, state.directPort2, "update", deviceName, modeid, "state", "hsm", themode)
        postHubRange(state.directIP3, state.directPort3, "update", deviceName, modeid, "state", "hsm", themode)
        logger("New hsm= ${themode} with subid= ${subid}, id= ${modeid}, and name= ${deviceName} to HousePanel clients", "info")
    }
}

def variableHandler(evt) {
    // modified to simplify modes to only deal with one tile
    // send group of hub actions for mode changes
    def vid = "${state.prefix}variables"
    def theval = evt?.value
    def varname = evt?.name

    if ( varname && varname.startsWith("variable:") ) {
        // name returned as "variable:name" so we get everything after the :
        varname = varname.substring(9)
        postHubRange(state.directIP, state.directPort, "update", "Variables", vid, varname, "variable", theval)
        postHubRange(state.directIP2, state.directPort2, "update", "Variables", vid, varname, "variable", theval)
        postHubRange(state.directIP3, state.directPort3, "update", "Variables", vid, varname, "variable", theval)
        logger("Variable changed, name= ${varname}, val= ${theval}", "info")
    }
}

def postHub(ip, port, msgtype, name, id, subid, type, value) {
    if ( msgtype && ip && ip!="0" && port && port!="0"  ) {
        Map abody = [
                msgtype: msgtype,
                hubid: state.hubid,
                change_name: name,
                change_device: id,
                change_attribute: subid,
                change_type: type,
                change_value: value
            ]

        logger("HousePanel postHub ${msgtype} to IP= ${ip}:${port} name= ${name} id= ${id} subid= ${subid} type= ${type} value= ${value}", "debug")
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

def postHubRange(ip, port, msgtype, name, id, subid, type, value) {
    // use regex to get range - this code should work and is more general, but also slower
    // def rangepatt = /(\d{2,})\s*\-\s*(\d{2,})?/
    // def (range, port1, port2) = ( port =~ rangepatt )[0]
    // if ( port1 && !port2 ) {
    //     postHub(ip, port1, msgtype, name, id, subid, type, value)
    // } else if ( port1 && port2 ) {
    //     int i1 = Integer.parseInt(port1)
    //     int i2 = IntegerparseInt(port2)
    //     if ( i2 < i1 ) {
    //         i2 = i1
    //     }
    //     for (int i = i1; i <= i2; i++ ) {
    //         port = i.toString()
    //         postHub(ip, port, msgtype, name, id, subid, type, value)
    //     }
    // }
    if ( !ip || !port ) return

    def dashloc = port.indexOf("-")
    if ( dashloc == -1 ) {
        postHub(ip, port, msgtype, name, id, subid, type, value)
    } else {
        String port1 = port.substring(0, dashloc)
        String port2 = port.substring(dashloc+1)
        int i1 = Integer.parseInt(port1)
        int i2 = Integer.parseInt(port2)
        if ( i2 < i1 ) { i2 = i1 }
        for (int i = i1; i <= i2; i++ ) {
            port = i.toString()
            postHub(ip, port, msgtype, name, id, subid, type, value)
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
    def isfirst = ip == state.directIP ? "debug" : false
    asynchttpPost("asyncHttpCmdResp", params, [execDt: now(), prdebug: isfirst])
}

void asyncHttpCmdResp(response, data) {
    def dt = now() - data.execDt
    if ( data.prdebug ) {
        logger("Resp: ${response} | Process time: ${dt}", data.prdebug)
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
    if (!state.hubname) {
        state.hubname = location.getName()
    }

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
