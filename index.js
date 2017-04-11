var inherits = require('util').inherits;
var fs = require('fs');
var path = require('path');
var osascript = require('node-osascript');
var debug = require('debug')('iTunes');
var wrap = require('wordwrap');
var Accessory, Service, Characteristic, UUIDGen;
var HomeKitMediaTypes;
var HKMTGen = require('./HomeKitMediaTypes.js');
var spawn = require('child_process').spawn;
var debug = require('debug')('iTunes');

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  HomeKitMediaTypes = HKMTGen(homebridge);

  homebridge.registerPlatform("homebridge-itunes", "iTunes", ITunesPlatform, true);

  Characteristic.prototype.updateValue = function(newValue, context){
    if (newValue === undefined || newValue === null)
      newValue = this.getDefaultValue();

    // update our cached value
    var oldValue = this.value;
    this.value = newValue;

    // emit a change event if necessary
    if (oldValue !== newValue)
      this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
  }
}

function ITunesPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || { "platform": "iTunes" };
  self.accessories = {};
  self.syncTimer = null;
  self.pollInterval = 2000;

  if (api) {
    self.api = api;

    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}

ITunesPlatform.scriptQueue = [];
ITunesPlatform.scriptQueueIsRunning = false;
ITunesPlatform.runScriptQueue = function(){
  ITunesPlatform.scriptQueueIsRunning = true;

  var dequeued = ITunesPlatform.scriptQueue.shift();
  osascript.execute(dequeued.script, function(err, rtn){
    while(dequeued.callbacks.length > 0){
      dequeued.callbacks.shift()(err, rtn);
    }
debug("Queue depth " + ITunesPlatform.scriptQueue.length);
    // All callbacks on the last item done...Do next?
    if(ITunesPlatform.scriptQueue.length == 0){
      ITunesPlatform.scriptQueueIsRunning = false;
      return;
    } else {
      ITunesPlatform.runScriptQueue();
    }
  });
}
ITunesPlatform.queueScript = function(script, callback){
  var last = ITunesPlatform.scriptQueue[ITunesPlatform.scriptQueue.length - 1];
  if(last && last.script == script){
    last.callbacks.push(callback);
    return;
  }

  ITunesPlatform.scriptQueue.push({ script: script, callbacks: [callback] });

debug("Queue depth " + ITunesPlatform.scriptQueue.length);
debug(script)
  if(!ITunesPlatform.scriptQueueIsRunning){
    ITunesPlatform.runScriptQueue();
  }
}

ITunesPlatform.prototype.removeAccessory = function(accessory) {
  if (accessory) {
    var mac = accessory.context.mac;
    this.api.unregisterPlatformAccessories("homebridge-amazondash", "AmazonDash", [accessory]);
    delete this.accessories[mac];
  }
}

ITunesPlatform.prototype.configureAccessory = function(accessory) {
  if(accessory.context.iTunesMac){
    this.configurePrimaryAccessory(accessory);
  } else {
    this.configureAirPlayAccessory(accessory);
  }
}

ITunesPlatform.prototype.configurePrimaryAccessory = function(accessory) {
  var self = this;

  accessory.reachable = true;

  this.primaryAccessory = accessory;

  var cxPlayStateOn = accessory
  .getService('Playing State')
  .getCharacteristic(Characteristic.On);
  var cxPlayState = accessory
  .getService(HomeKitMediaTypes.PlaybackDeviceService)
  .getCharacteristic(HomeKitMediaTypes.PlaybackState);

  accessory.getPlaybackStateFromString = function(str){
    switch (str.trim()) {
      case "paused":
        return HomeKitMediaTypes.PlaybackState.PAUSED;
        break;
      case "stopped":
        return HomeKitMediaTypes.PlaybackState.STOPPED;
        break;
      default:
        return HomeKitMediaTypes.PlaybackState.PLAYING;
        break;
    }
  }

  cxPlayState
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get player state';
    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if(err){
        callback(err)
      } else {
        callback(false, accessory.getPlaybackStateFromString(rtn));
      }
    }.bind(this));
  }.bind(this))
  .on('set', function(newVal, callback){
    switch (newVal) {
      case HomeKitMediaTypes.PlaybackState.PLAYING:
        var tell =
          'tell application "iTunes"\n'
          + 'if player state is paused or (exists current track) then play\n'
          + 'if player state is stopped then\n'
            + 'if exists user playlist "AutoPlay" then\n'
		          + 'play user playlist "AutoPlay"\n'
            + 'else\n'
	            + 'play (some playlist whose special kind is Music)\n'
            + 'end if\n'
          + 'end if\n'
        + 'end tell'
        ITunesPlatform.queueScript(tell, function(err, rtn) {
          if(err){
            callback(err)
          } else {
            callback();
          }
        }.bind(this));
        break;
      case HomeKitMediaTypes.PlaybackState.PAUSED:
        ITunesPlatform.queueScript('tell application "iTunes" to pause', function(err, rtn){
          if(err){
            callback(err)
          } else {
            callback();
          }
        }.bind(this));
        break;
      case HomeKitMediaTypes.PlaybackState.STOPPED:
        ITunesPlatform.queueScript('tell application "iTunes" to stop', function(err, rtn){
          if(err){
            callback(err)
          } else {
            callback();
          }
        }.bind(this));
        break;
      default:
        callback("Invalid value for PlaybackState!");
        break;
    }
    cxPlayStateOn.getValue(); // Sync up slave cx with this master cx
  }.bind(this))
  .on('change', function(newVal){
    cxPlayStateOn.getValue(); // Sync up slave cx with this master cx
  }.bind(this))

  accessory
  .getService(HomeKitMediaTypes.PlaybackDeviceService)
  .getCharacteristic(HomeKitMediaTypes.SkipForward)
  .on('set', function(newVal, callback){
    ITunesPlatform.queueScript('tell application "iTunes" to next track', function(err, rtn) {
      if(err){
        callback(err)
      } else {
        callback();
      }
    }.bind(this));
  }.bind(this));

  accessory
  .getService(HomeKitMediaTypes.PlaybackDeviceService)
  .getCharacteristic(HomeKitMediaTypes.SkipBackward)
  .on('set', function(newVal, callback){
    ITunesPlatform.queueScript('tell application "iTunes" to back track', function(err, rtn) {
      if(err){
        callback(err)
      } else {
        callback();
      }
    }.bind(this));
  }.bind(this));

  accessory
  .getService(HomeKitMediaTypes.AudioDeviceService)
  .getCharacteristic(HomeKitMediaTypes.AudioVolume)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get sound volume';
    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, parseInt(rtn));
      }
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set sound volume to ' + parseInt(newVal);
    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false);
      }
    });
  });

  // Hack switch characteristics to emulate media controls...

  cxPlayStateOn
  .on('get', function(callback){
    cxPlayState
    .getValue(function(err, val){
      if(err)
        callback(err);
      else
        callback(false, val == HomeKitMediaTypes.PlaybackState.PLAYING);
    }.bind(this));
  }.bind(this))
  .on('set', function(newVal, callback){
    if(newVal == true && cxPlayState.value !== HomeKitMediaTypes.PlaybackState.PLAYING)
      cxPlayState.setValue(HomeKitMediaTypes.PlaybackState.PLAYING, callback);
    if(newVal == false && cxPlayState.value == HomeKitMediaTypes.PlaybackState.PLAYING)
      cxPlayState.setValue(HomeKitMediaTypes.PlaybackState.PAUSED, callback);
  }.bind(this))
  .getValue(function(err, value){
    if(err)
      self.log(err);
  });

  accessory
  .getService('Track Skipper')
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){ callback('false'); })
  .on('set', function(newVal, callback){
    if(!newVal){ callback(); return; }
    accessory
    .getService(HomeKitMediaTypes.PlaybackDeviceService)
    .getCharacteristic(HomeKitMediaTypes.SkipForward)
    .setValue(true, function(err){
      if(err)
        callback(err);
      else
        callback();
      setTimeout(function(){
        accessory
        .getService('Track Skipper')
        .getCharacteristic(Characteristic.On)
        .setValue(false);
      }, 100);
    });
  }.bind(this));

  accessory
  .getService('Album Skipper')
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){ callback('false'); })
  .on('set', function(newVal, callback){
    if(!newVal){ callback(); return; }

    var tell = 'tell application "iTunes"\n'
      + 'set |current album| to the album of the current track\n'
  	    + 'repeat while the album of the current track is equal to |current album|\n'
		    + 'next track\n'
      + 'end repeat\n'
    + 'end tell';

    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if(err)
        callback(err);
      else
        callback();
      setTimeout(function(){
        accessory
        .getService('Album Skipper')
        .getCharacteristic(Characteristic.On)
        .setValue(false);
      }, 100);
    }.bind(this));
  }.bind(this));

}

ITunesPlatform.prototype.configureAirPlayAccessory = function(accessory) {
  var self = this;

  accessory.reachable = true;

  var rawDevice = accessory.context.rawDevice;

  this.accessories[rawDevice.mac] = accessory;

  accessory
  .getService(Service.Switch)
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get selected of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ')';
    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, !!rtn ? true : false);
      }
    });
  })
  .on('set', function(newVal, callback){
    // Now what we gonna do is...
    var tell = 'tell application "iTunes" to set selected of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ') to ' + (newVal ? 'true' : 'false');
    // First, we need to handle auto play/pause actions before changing state...
    var cxPlaybackState = this.primaryAccessory
    .getService(HomeKitMediaTypes.PlaybackDeviceService)
    .getCharacteristic(HomeKitMediaTypes.PlaybackState);
    if(newVal == true) {
      // Go ahead and turn this one on now...
      ITunesPlatform.queueScript(tell, function(err, rtn) { if (err) callback(err); else callback(false); });
      // If one AirPlay device turned on and not currently playing...
      if(cxPlaybackState.value !== HomeKitMediaTypes.PlaybackState.PLAYING){
        // Turn other AirPlay destinations off...
        //TODO: Make this behavior configurable!
        for(var k in this.accessories){
          var apac = this.accessories[k];
          if(!apac || apac === accessory || !apac.getService) continue;
          apac
          .getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .setValue(false);
        }
        cxPlaybackState.setValue(HomeKitMediaTypes.PlaybackState.PLAYING)
      }
    } else {
      // If are turning off the last AirPlay device, pause playback...
      var anyOn = false;
      for(var k in this.accessories){
        var apac = this.accessories[k];
        if(!apac || apac === accessory || !apac.getService) continue;
        var isOn = apac
        .getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .value;
        if(isOn){ anyOn = true; break; }
      }
      if(!anyOn) cxPlaybackState.setValue(HomeKitMediaTypes.PlaybackState.PAUSED);
      // Now turn this one off...
      ITunesPlatform.queueScript(tell, function(err, rtn) { if (err) callback(err); else callback(false); });
    }
  }.bind(this))
  .getValue(function(err, value){
    if(err)
      self.log(err);
    else {
      accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).value = value;
    }
  });

  accessory
  .getService(HomeKitMediaTypes.AudioDeviceService)
  .getCharacteristic(HomeKitMediaTypes.AudioVolume)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get sound volume of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ')';
    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, parseInt(rtn));
      }
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set sound volume of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ') to ' + parseInt(newVal);
    ITunesPlatform.queueScript(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false);
      }
    });
  })
  .getValue(function(err, value){
    if(err)
      self.log(err);
    else {
      accessory.getService(HomeKitMediaTypes.AudioDeviceService).getCharacteristic(HomeKitMediaTypes.AudioVolume).value = value;
    }
  });
}



ITunesPlatform.prototype.didFinishLaunching = function() {
  this.syncAccessories();
}

ITunesPlatform.prototype.syncAccessoriesScheduler = function(msec){
  clearTimeout(this.syncTimer);
  this.syncTimer = setTimeout(this.syncAccessories.bind(this), msec);
};

ITunesPlatform.prototype.syncAccessories = function() {
  var syncAgainIn = this.syncAccessoriesScheduler.bind(this);
  syncAgainIn(this.pollInterval);

  // Update the primary accessory
  var pa = this.primaryAccessory;
  if(!pa){
    ITunesPlatform.queueScript('get the primary Ethernet address of (get system info)', function(err, rtn){
      if(err) {
        // erm...well this is awkward...Try again in a bit?
        this.log(err);
        this.log("ERROR: Failed creating iTunes main device, trying again in two seconds.");
        syncAgainIn(2000);
      } else {
        this.addPrimaryAccessory(rtn);
      }
    }.bind(this));
    return; // BRB...
  } else {
    ITunesPlatform.queueScript('tell application "iTunes" to get {player state, sound volume, exists current track}', function(err, rtn){
      if (err) {
        this.log(err);
        this.log("ERROR: Failed syncing iTunes main device, trying again in two seconds.");
        syncAgainIn(2000);
        return;
      }
      if (Array.isArray(rtn)) {
        pa
        .getService(HomeKitMediaTypes.PlaybackDeviceService)
        .getCharacteristic(HomeKitMediaTypes.PlaybackState)
        .updateValue(pa.getPlaybackStateFromString(rtn[0]));
        pa
        .getService(HomeKitMediaTypes.AudioDeviceService)
        .getCharacteristic(HomeKitMediaTypes.AudioVolume)
        .updateValue(parseInt(rtn[1]));

        if(rtn[2]){
          this.syncMediaInformation();
        }
      }
    }.bind(this));
  }

  // Get the id and name of all the AirPlay devices...
  var tell = 'tell application "iTunes"\n'
      + 'set apDevMap to {}\n'
      + 'repeat with aDevice in (AirPlay devices)\n'
        //+ "copy {id:aDevice's id, name:aDevice's name, mac:aDevice's network address} to the end of the apDevMap\n"
        + "copy {aDevice's id, aDevice's name, aDevice's network address, aDevice's selected, aDevice's sound volume} to the end of the apDevMap\n"
      + 'end repeat\n'
      + 'get apDevMap\n'
  + 'end tell\n';

  ITunesPlatform.queueScript(tell, function(err, rtn) {
    if (err) {
      this.log(err);
      this.log("ERROR: Failed getting AirPlay devices--iTunes may still be launching. Trying again in two seconds.");
      syncAgainIn(2000);
      return;
    }
    if (Array.isArray(rtn)) {
      for(var i = 0; i < rtn.length; i++)
        rtn[i] = {
          id: rtn[i][0],
          name: rtn[i][1],
          mac: (rtn[i][2] == "missing value" ? null : rtn[i][2]),
          selected: rtn[i][3],
          volume: parseInt(rtn[i][4])
        };
      this.rawDevices = rtn;

      // Update id's and values and add any devices we didn't have before...
      var foundMacs = {};
      for (var i = 0; i < this.rawDevices.length; i++) {
        var rawDevice = this.rawDevices[i];
        if(!rawDevice.mac) rawDevice.mac = '00-host-audio';
        foundMacs[rawDevice.mac] = true;

        if (this.accessories[rawDevice.mac]) {
          var accessory = this.accessories[rawDevice.mac];

          accessory.context.rawDevice = rawDevice;

          var volCx = accessory.getService(HomeKitMediaTypes.AudioDeviceService).getCharacteristic(HomeKitMediaTypes.AudioVolume);
          if(volCx.value != rawDevice.volume)
            volCx.updateValue(rawDevice.volume);

          var onCx = accessory.getService(Service.Switch).getCharacteristic(Characteristic.On);
          if(onCx.value != rawDevice.selected)
            onCx.updateValue(rawDevice.selected);

          if(!accessory.reachable) accessory.updateReachability(true);
        //} else {
        //  this.addAirPlayAccessory(rawDevice);
        }
      }
      // Set any devices now missing to unreachable...
      for(var m in this.accessories){
        if(this.accessories[m] instanceof Accessory && !foundMacs[m])
          this.accessories[m].updateReachability(false);
      }

    }
  }.bind(this));

}

ITunesPlatform.prototype.syncMediaInformation = function(){
  var tell = 'tell application "iTunes"\n'
	+'set theResult to {exists current track}\n'
	+'if exists current track then\n'
	+'	set end of theResult to name of current track\n'
	+'	set end of theResult to album of current track\n'
	+'	set end of theResult to artist of current track\n'
	+'	set end of theResult to duration of current track\n'
	+'	set end of theResult to player position\n'
	+'end if\n'
	+'get theResult\n'
  +'end tell';

  ITunesPlatform.queueScript(tell, function(err, rtn){
    if (err) {
      this.log(err);
      this.log("ERROR: Failed syncing media information, trying again in two seconds.");
      this.syncAccessoriesScheduler(2000);
      return;
    }
    var pa = this.primaryAccessory;
    if (Array.isArray(rtn) && rtn[0]) {
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemName)
      .updateValue(rtn[1]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemAlbumName)
      .updateValue(rtn[2]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemArtist)
      .updateValue(rtn[3]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemDuration)
      .updateValue(rtn[4]);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaCurrentPosition)
      .updateValue(rtn[5]);
    } else {
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemName)
      .updateValue("");
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemAlbumName)
      .updateValue("");
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemArtist)
      .updateValue("");
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaItemDuration)
      .updateValue(0);
      pa
      .getService(HomeKitMediaTypes.PlaybackDeviceService)
      .getCharacteristic(HomeKitMediaTypes.MediaCurrentPosition)
      .updateValue(0);
    }
    this.writeMediaInformationFiles();
  }.bind(this));
}

ITunesPlatform.prototype._hhmmss = function(seconds) {
  seconds = Math.round(seconds);
  var minutes = Math.floor(seconds / 60);
  seconds = seconds%60;
  var hours = Math.floor(minutes/60)
  minutes = minutes%60;
  return (hours > 0 ? hours+":" : '')
  + (hours > 0 ? '0'.repeat(2 - (''+minutes).length) : '') + minutes + ":"
  + '0'.repeat(2 - (''+seconds).length) + seconds;
}

ITunesPlatform.prototype.writeMediaInformationFiles = function(){
  var papds = this.primaryAccessory.getService(HomeKitMediaTypes.PlaybackDeviceService);
  var name = papds.getCharacteristic(HomeKitMediaTypes.MediaItemName).value;
  var album = papds.getCharacteristic(HomeKitMediaTypes.MediaItemAlbumName).value;
  var artist = papds.getCharacteristic(HomeKitMediaTypes.MediaItemArtist).value;
  var duration = papds.getCharacteristic(HomeKitMediaTypes.MediaItemDuration).value;
  var position = papds.getCharacteristic(HomeKitMediaTypes.MediaCurrentPosition).value;
  var pbsize = 50;
  var progressBar = '-'.repeat(Math.floor(pbsize*position/duration)) + '|' + '-'.repeat(Math.ceil(pbsize*(duration-position)/duration)-1);

  try {
    fs.writeFileSync(
      "/tmp/homebridge-itunes-nowplaying.txt",
      wrap(50)(name + '\n\n' + album + '\n\n' + artist) + '\n\n' + this._hhmmss(position) + ' ' + progressBar + ' ' + this._hhmmss(duration - position)
    );
  } catch(e){
    debug(e);
  }

  if(name != ITunesPlatform._lastSeenTrackName){
    osascript.executeFile(path.join(__dirname, 'scripts', 'GetAlbumArtwork.applescript'));
  }
  ITunesPlatform._lastSeenTrackName = name;

  var child = spawn(
    'ffmpeg',
    ('-y -i /tmp/homebridge-itunes-artwork.jpg '
    + '-vf scale=(iw*sar)*min(480/(iw*sar)\\,480/ih):ih*min(480/(iw*sar)\\,480/ih),'
    + 'pad=854:480:(480-iw*min(480/iw\\,480/ih))/2:(480-ih*min(480/iw\\,480/ih))/2,'
    + 'drawbox=y=ih-60:color=black@0.7:width=iw:height=60:t=max,'
    + 'drawtext=fontfile=/Library/Fonts/Skia.ttf:fontsize=16:fontcolor=white:x=485:y=(h-th)/2:fix_bounds=true:textfile=/tmp/homebridge-itunes-nowplaying.txt:reload=1 '
    + '/tmp/homebridge-itunes-nowplaying.jpg').split(' '),
    {env: process.env}
  );
  //child.stdout.on('data', function(data){ debug("stdout: " + data); });
  //child.stderr.on('data', function(data){ debug("stderr: " + data); });
  child.on('error', function(err) {
    debug('WARN: Error on ffmpeg image compositing...meh, okay, so we won\'t do that.');
  });
}

ITunesPlatform.prototype.addPrimaryAccessory = function(mac){
  var self = this;
  var uuid = UUIDGen.generate("iTunes:" + mac);
  var name = "iTunes";

  var newAccessory = new Accessory(name, uuid, 1); // 1 = Accessory.Category.OTHER
  newAccessory.context.iTunesMac = mac;

  newAccessory.addService(Service.Switch, "Playing State", "playstate").name = "playstate";
  newAccessory.addService(HomeKitMediaTypes.AudioDeviceService, name);
  newAccessory.addService(HomeKitMediaTypes.PlaybackDeviceService, name);
  newAccessory.addService(Service.Switch, "Track Skipper", "skiptrackforward").name = "skiptrackforward";
  newAccessory.addService(Service.Switch, "Album Skipper", "skipalbumforward").name = "skipalbumforward";

  newAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Apple")
  .setCharacteristic(Characteristic.Model, "iTunes")
  .setCharacteristic(Characteristic.SerialNumber, mac);

  newAccessory.getService("playstate").getCharacteristic(Characteristic.On).displayName = "Playing";
  newAccessory.getService("skiptrackforward").getCharacteristic(Characteristic.On).displayName = "Track Skipper";
  newAccessory.getService("skipalbumforward").getCharacteristic(Characteristic.On).displayName = "Album Skipper";

  this.configureAccessory(newAccessory);

  this.api.registerPlatformAccessories("homebridge-itunes", "iTunes", [newAccessory]);

  // we came here from an aborted sync, start it again...
  this.syncAccessories();
}

ITunesPlatform.prototype.addAirPlayAccessory = function(rawDevice) {
  var self = this;
  var uuid = UUIDGen.generate(rawDevice.mac);

  var newAccessory = new Accessory(rawDevice.name, uuid, 1); // 1 = Accessory.Category.OTHER
  newAccessory.context.rawDevice = rawDevice;

  newAccessory.addService(Service.Switch, rawDevice.name);
  newAccessory.addService(HomeKitMediaTypes.AudioDeviceService, rawDevice.name);

  newAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Apple")
  .setCharacteristic(Characteristic.Model, "AirPlay Speaker")
  .setCharacteristic(Characteristic.SerialNumber, rawDevice.mac);

  this.configureAccessory(newAccessory);

  this.api.registerPlatformAccessories("homebridge-itunes", "iTunes", [newAccessory]);
}

ITunesPlatform.prototype.removeAccessory = function(accessory) {
  if (accessory) {
    var mac = accessory.context.rawDevice.mac;
    this.api.unregisterPlatformAccessories("homebridge-itunes", "iTunes", [accessory]);
    delete this.accessories[mac];
  }
}

ITunesPlatform.prototype.configurationRequestHandler = function(context, request, callback) {
  if (request && request.type === "Terminate") {
    return;
  }
  debug("called configurationRequestHandler with step " + context.step);

  context.newConfig = this.config;

  if (!context.step) {
    context.step = "topMenu";
  } else if(context.step == "topMenuResponse"){
    var selection = request.response.selections[0];
    switch(selection){
      case 0:
        context.step = "preferencesMenu";
        break;
      case 1:
        context.step = "addDevicesMenu";
        break;
      case 2:
        context.step = "removeDevicesMenu";
        break;
    }
  } else if(context.step == "preferencesMenuResponse"){
    var selection = request.response.selections[0];
    switch(selection){
      case 0:
        context.step = "playlistMenu";
        break;
      case 1:
        context.step = "pollIntervalMenu";
        break;
      case 2:
        context.step = "nowPlayingMenu";
        break;
    }
  } else if(context.step == "playlistMenuResponse"){
    var selection = request.response.selections[0];
    var playlist = context.options[selection];
    context.newConfig.autoplay_playlist = playlist;
    context.navOptions = [{label: "Back to Preferences", step: "preferencesMenu"}];
    context.step = "actionSuccess";
  } else if(context.step == "pollIntervalMenuResponse"){
    var selection = request.response.selections[0];
    context.newConfig.poll_interval = [1, 2, 5, 10, 30][selection];
    context.navOptions = [{label: "Back to Preferences", step: "preferencesMenu"}];
    context.step = "actionSuccess";
  } else if(context.step == "nowPlayingMenuResponse"){
    var selection = request.response.selections[0];
    context.newConfig.enable_now_playing = [true, false][selection];
    context.navOptions = [{label: "Back to Preferences", step: "preferencesMenu"}];
    context.step = "actionSuccess";
  } else if(context.step == "actionSuccessResponse"){
    context.step = [{step: 'topMenu'}].concat(context.navOptions.concat({step: 'finish'}))[request.response.selections[0]].step;
    delete context.navOptions;
  }

  if(context.step == "finish"){
    callback(null, "platform", true, context.newConfig);
    return;
  }

  switch (context.step) {
    case "topMenu":
      var respDict = {
        "type": "Interface",
        "interface": "list",
        "title": "Configure iTunes Plugin",
        "items": [
          "Preferences",
          "Add Devices",
          "Remove Devices"
        ]
      }
      context.step = "topMenuResponse";
      callback(respDict);
      break;
    case "preferencesMenu":
      var respDict = {
        "type": "Interface",
        "interface": "list",
        "title": "Preferences",
        "items": [
          "AutoPlay Playlist",
          "Polling Interval",
          "Now Playing Feature"
        ]
      }
      context.step = "preferencesMenuResponse";
      callback(respDict);
      break;
    case "playlistMenu":
      var respDict = {
        "type": "Interface",
        "interface": "instruction",
        "title": "Retrieving Playlists",
        "detail": "Please wait...",
        "showNextButton": false
      }
      callback(respDict);
      // That'll hold 'em...

      var tell = 'tell application "iTunes" \n'
        + 'set userPlaylists to {} \n'
        + '	repeat with aPlaylist in (get playlists) \n'
          + '	copy {the name of aPlaylist} to the end of userPlaylists \n'
        + 'end repeat \n'
        + 'get userPlaylists \n'
      + 'end tell';
      ITunesPlatform.queueScript(tell, function(err, rtn) {
        if(err || !Array.isArray(rtn)){
          var respDict = {
            "type": "Interface",
            "interface": "instruction",
            "title": "Unexpected Problem",
            "detail": "There was a problem retrieving playlists. Please try again later.",
            "showNextButton": true
          }
          context.step = "topMenu";
        } else {
          var options = []; for(var i = 0; i < rtn.length; i++) options.push(rtn[i][0]);
          var respDict = {
            "type": "Interface",
            "interface": "list",
            "title": "Select AutoPlay Playlist",
            "items": options
          }
          context.options = options;
          context.step = "playlistMenuResponse";
        }
        callback(respDict);
      }.bind(this));
      break;
    case "pollIntervalMenu":
      var respDict = {
        "type": "Interface",
        "interface": "list",
        "title": "Poll Interval",
        "detail": "Choose a shorter time for faster updates or a longer time for reduced processor usage. Recommended value is 2 seconds.",
        "items": [
          "1 second",
          "2 seconds",
          "5 seconds",
          "10 seconds",
          "30 seconds"
        ]
      }
      context.step = "pollIntervalMenuResponse";
      callback(respDict);
      break;
    case "nowPlayingMenu":
      var respDict = {
        "type": "Interface",
        "interface": "list",
        "title": "Now Playing",
        "detail": "Enable or disable creation of \"Now Playing\" images. Enabling requires ffmpeg with Freetype support and consumes some CPU resources.",
        "items": [
          "Enable",
          "Disable"
        ]
      }
      context.step = "nowPlayingMenuResponse";
      callback(respDict);
      break;
    case "actionSuccess":
      var options = ["iTunes Plugin Configuration"];
      for(var i = 0; i < context.navOptions.length; i++) options.push(context.navOptions[i].label);
      options.push("Done");
      var respDict = {
        "type": "Interface",
        "interface": "list",
        "title": "Success!",
        "items": options
      }
      context.step = "actionSuccessResponse";
      callback(respDict);
      break;
    case "finish":
      var self = this;
      delete context.step;
      var newConfig = this.config;
      var newButtons = Object.keys(this.accessories).map(function(k){
        var accessory = self.accessories[k];
        var button = {
          'name': accessory.displayName,
          'mac': accessory.context.mac
        };
        return button;
      });
      newConfig.buttons = newButtons;

      callback(null, "platform", true, newConfig);
      break;

    default:
      var respDict = {
        "type": "Interface",
        "interface": "instruction",
        "title": "Not Implemented",
        "detail": "This feature is not yet implemented.",
        "showNextButton": true
      }
      context.step = "topMenu";
      callback(respDict);
      break;

  }
}
