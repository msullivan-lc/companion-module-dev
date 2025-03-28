## Companion Synaccess Netbooter Module

This module was written to allow outlet control for Synaccess Netbooter NP-0801DUG2 PDUs.

In firmware v7.67 the on/off bits are flipped, or I accidentally used the incorrect HW version of the firmware file on my hardware. Will have to double check this in the future.

## Installation
1. Download and extract contents of the zip to a folder on your computer that will contain all custom developer modules. (Ex. ~/Documents/companion-modules-dev/)
2. Launch Companion and use the gear icon at the top right of the GUI enable the ability to define a custom developer modules path.
3. Point the developer modules path to the folder you defined above. Companion should automatically scan this folder for the plugin and it should appear in the connections list as Synaccess Netbooter.
4. In the configuration window, define the IP address of your Netbooter and the username and password.
5. You should now be able to add the outlet on/off action to new or existing buttons.

## Supported Hardware
The module is only tested on the NP-0801DUG2. 

I suspect other Netbooters will work, but if you only have 5 outlets on your Netbooter, the additional outlets in the plugin will probably return an error if you try to send them a command. The API from Synaccess is fairly basic.

## Support
Due to working full time at a church, having my own web development and hosting company, and being a father of two, my time is severely limited. I make no express commitment to supporting or expanding this software. Feel free to download and modify the code as required.

## Change Log
v1.0.0 - March 28, 2025
- Initial release

## Credit
Written by Michael Sullivan, Lifecentre Church, Ottawa, Ontario, Canada, using the Companion Module Development Template with help from Gemini 2.5 Pro.