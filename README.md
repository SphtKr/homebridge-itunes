# homebridge-itunes

...is a Homebridge plugin for controlling iTunes and associated AirPlay speakers with HomeKit and Siri.

Mainly, it makes it possible for you control your music system with Siri or via HomeKit scenes. Besides just play and pause, there are some handy features that make this particularly easy to do. It is geared toward audio uses, but will work in most cases to control video as well.

## Requirements

This plugin requires a Mac running iTunes, and presently requires Homebridge to be running on that Mac. Already running Homebridge on a Raspberry Pi? No problem: remember that you can run more than one instance of Homebridge on a network, just install Node on your iTunes Mac and run Homebridge there, being sure to change the `"username"` field in `config.json` to be unique.

## Quick Start

1. `sudo npm install -g homebridge`, See the [Homebridge](https://github.com/nfarina/homebridge) project site for more information, and to configure Homebridge
2. `sudo npm install -g homebridge-itunes`
3. Edit `~/.homebridge/config.json` and add the following:

```
"platforms": [
    {
        "platform": "iTunes"
    }
]
```

That's it! Homebridge should show your iTunes application and all your AirPlay destinations as HomeKit accessories

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

## Use service groups

A good way to configure your home is to put all the AirPlay devices into a service group, for example "Speakers" or "Music", and place each speaker in its appropriate room. Then the names of your AirPlay devices matter very little, and you can just say "Turn on the speakers in the Living Room" and Siri will know what you're talking about.
