# IMPORTANT UPGRADE NOTICE

If you are unable to start Homebridge after installing 0.2.0, remove the file `~/.homebridge/accessories/cachedAccessories` and start Homebridge again. Sorry for the difficulty, this will be improved in a future version!

# homebridge-itunes

[![npm version](https://badge.fury.io/js/homebridge-itunes.svg)](https://badge.fury.io/js/homebridge-itunes)


...is a Homebridge plugin for controlling iTunes and associated AirPlay speakers with HomeKit and Siri.

Mainly, it makes it possible for you control your music system with Siri or via HomeKit scenes. Besides just play and pause, there are some handy features that make this particularly easy to do. It is geared toward audio uses, but will work in most cases to control video as well.

## Requirements

This plugin requires a Mac running iTunes, and presently requires Homebridge to be running on that Mac. Already running Homebridge on a Raspberry Pi? No problem: remember that you can run more than one instance of Homebridge on a network, just install Node on your iTunes Mac and run Homebridge there, being sure to change the `"username"` field in `config.json` to be unique.

Node v4 or greater is required, and Homebridge v0.3 or higher.

## Quick Start

1. `sudo npm install -g homebridge`, See the [Homebridge](https://github.com/nfarina/homebridge) project site for more information, and to configure Homebridge
2. `sudo npm install -g homebridge-itunes`
3. Configure the platform...

This can be done using one of two methods:

### Hesperus menu-driven configuration

Using the [Hesperus](https://itunes.apple.com/us/app/hesperus/id969348892?mt=8) app, configure Homebridge by tapping the gear icon in the upper-right, selecting "Accessories", and swiping to the left on the Homebridge device and tapping "Config". From there, you can set various configuration options and either add all iTunes/AirPlay devices or add and remove devices selectively.

### Manually add to `config.json`

Add the following platform definition to `~/.homebridge/config.json`:

```
"platforms": [
    {
        "platform": "iTunes"
    }
]
```

...and then restart Homebridge. Your iTunes application and all your AirPlay destinations will be added as HomeKit accessories

## Basic Usage

To play music, switch the iTunes accessory "On". To change the AirPlay speaker destination(s), turn on the individual AirPlay speakers (the Mac itself will show up as "Computer"). If you are using Eve, you can control the volume of each AirPlay speaker or the iTunes overall volume (not your Mac's volume) via the "Audio Volume" characteristic.

## AutoPlay

If you turn on the iTunes accessory or any AirPlay accessory and there is no music playing, the plugin will start playing from the "Music" library. You can customize what plays by default by creating a playlist in iTunes named "AutoPlay"--this can be a regular playlist or a Smart Playlist. If an AutoPlay playlist is found, it will be played by default instead of "Music".

Also of note:

* If there is no music playing and you turn on an individual audio destination (not the main iTunes accessory), the plugin will first turn off all the other audio destinations and so music will play only from the one you turned on. If you turn on a single audio destination and music is already playing, the other destinations will be left on. This sounds convoluted, but should be very natural in normal use.
* If you turn off the last speaker destination (AirPlay or built-in), it will pause the playback automatically.

## Track Skipper and Album Skipper

HomeKit has no built-in controls for media playback, and therefore neither does Siri. This plugin includes some custom characteristics to skip tracks and control playback, but these won't work with Siri.

So, there are two "On/Off" switches called "Track Skipper" and "Album Skipper". This lets you tell Siri, "Turn on the Track Skipper" to skip a track and "Turn on the Album Skipper" to skip to the next album. Not quite as natural as saying "Skip this album", but it'll have to do for now.

## Use "speakers" in name for Siri control

To switch on/off airplay destinations with Siri, you may want to rename the AirPlay devices that this plugin creates, and add "Speaker" or "Speakers" to the name. If you name them "Music", for instance, Siri will think you're talking about your device's built-in music player.

(Note that the previous guidance about using service groups was either incorrect or has become a bad idea!)

## "Now Playing" video feed

A new feature is the ability to have a "Now Playing" video feed that looks like a camera in HomeKit. To do this, you will need the  [homebridge-camera-ffmpeg](https://github.com/khaost/homebridge-camera-ffmpeg) plugin, and add a camera definition to it that looks like the following:

```
{
    "platform": "Camera-ffmpeg",
    "cameras": [
        {
            "name": "Now Playing",
            "videoConfig": {
                "source": "-re -loop 1 -framerate 1 -r 1 -i /tmp/homebridge-itunes-nowplaying.jpg",
                "maxStreams": 2,
                "maxWidth": 480,
                "maxHeight": 480,
                "maxFPS": 2
            }
        }
    ]
}
```

(Note that for this to work, you will need ffmpeg installed with libfreetype support--if you are using Homebrew, you can get this by running `brew install ffmpeg --with-freetype`)

Then, add the camera device to HomeKit (all camera devices have to be added individually, they can't be attached to a bridge device). This is an experimental feature so please provide feedback!

## Uninstall

With the latest Homebridge API, devices are added persistently, meaning that uninstalling the `homebridge-itunes` module will not remove the devices from Homebridge. To remove the devices from HomeKit, either use the configuration mechanism in [Hesperus](https://itunes.apple.com/us/app/hesperus/id969348892?mt=8) described above, or manually remove the iTunes platform from your `config.json` file and restart Homebridge. After this, you can uninstall the module if you like (but it won't really do anything at this point).

## Known issues

### CPU Usage High

It is believed that most of the high-CPU issues reported were actually due to bugs in the dependent AppleScript parsing modules in previous versions. As of 0.2.0-alpha1, there is only one AppleScript library being used and it is a new updated version which is not believed to have these problems. Be sure to update to 0.2.0-alpha1 or later if you are experiencing these problems.

That said, there may be high CPU usage in some applications. As near as I can tell so far, this is a result of launching the `osascript` executable each time the plugin polls iTunes for its status. Since this is the only way I have to access iTunes and the `osascript` integration is provided in an upstream module, there is a limit to what I can do. At present, if this is a problem for you, your best course would be to use the [Hesperus](https://itunes.apple.com/us/app/hesperus/id969348892?mt=8) app to configure a longer polling interval in the iTunes platform preferences. (You can also do this without Hesperus by adding a `poll_interval` value in the platform in `config.json`, using a milliseconds value such as `5000` for five seconds.) The default is 2 seconds, so try a higher value.

### Crashes on startup

Previous crash-on-startup issues were due to version mismatches after upgrades. This is believed to be resolved as of version 0.2.0-alpha1. Please upgrade to 0.2.0-alpha1 or higher if you are experiencing this problem, and if you have already done so, please file an issue.
