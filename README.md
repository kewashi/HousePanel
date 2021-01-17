HousePanel (HP) is a user-hosted (typically local) highly customizable open source web application dashboard for accessing and controlling a SmartThings or Hubitat equipped smart home from a Tablet, Computer, or even Smart Phone.

HP is designed to give the user full control over the look and feel of their panel controller. It does require some effort to install and configure, but once set up, making fine tunings and adjustments are relatively simple. Most customizations can be done from within the built-in web-based user interface, which includes a full featured tile editor and a tile customizer for modifying content shown on any tile. Power users can also make major modifications by editing a CSS file using industry standard protocols.

HP runs on a customer-provided server and does not expose your personal data nor any details about your environment to the developer or any other party. You are in total control. The default settings were designed by a professional web designer to create a highly acceptable user interface for non-technical people. It is designed to not look and feel "geeky". By default the tiles are large and colorful, placed on beautiful full color backgrounds.

Requirements - What You Need to Use HousePanel is a Linux server with Node and NPM installed
Javascript that is paired with a SmartThings and/or Hubitat SmartApp written in the Groovy language. To use Housepanel you will need a modern browser with Javascript support. Obviously you will also need a SmartThings and/or Hubitat account with owner access.

Quick install directions: log into your rPI with SSH and enter:

```
> cd ~
> mkdir hpserver
> cd hpserver
> npm install hpserver
  
```

Full documentation is at https://housepanel.net
