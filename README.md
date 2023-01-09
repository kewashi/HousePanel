HousePanel (HP) is a user-hosted (typically local) highly customizable open source web application dashboard for accessing and controlling a Hubitat or SmartThings equipped smart home from a Tablet, Computer, or even Smart Phone.

HP is designed to give the user full control over the look and feel of their panel controller. It does require some effort to install and configure, but once set up, making fine tunings and adjustments are relatively simple. Most customizations can be done from within the built-in web-based user interface, which includes a full featured tile editor and a tile customizer for modifying content shown on any tile. Power users can also make major modifications by editing a CSS file using industry standard protocols.

HP runs on a customer-provided server and does not expose your personal data nor any details about your environment to the developer or any other party. You are in total control. The default settings were designed by a professional web designer to create a highly acceptable user interface for non-technical people. It is designed to not look and feel "geeky". By default the tiles are large and colorful, placed on beautiful full color backgrounds.

Requirements - What You Need to Use HousePanel is a Linux server with Node.js, NPM, and mySQL installed
To use Housepanel you will need a modern browser with Javascript support. Obviously you will also need a Hubitat or SmartThings account with owner access. As of December 2023, SmartThings legacy hubs are no longer supported. 

Quick install directions: log into your rPI or Linux server with SSH and enter:

```
> cd ~
> git clone https://github.com/kewashi/hpserver.git
> cd hpserver
> npm install
  
```

Full documentation is at https://housepanel.net
