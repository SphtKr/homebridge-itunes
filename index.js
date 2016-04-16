var inherits = require('util').inherits;
var osascript = require('node-osascript');
var applescript = require('applescript');
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-itunes", "iTunes", ITunesPlatform, true);

  ITunesPlatform.AudioVolume = function() {
    Characteristic.call(this, 'Audio Volume', ITunesPlatform.AudioVolume.UUID);
    this.setProps({
      format: Characteristic.Formats.UINT8,
      unit: Characteristic.Units.PERCENTAGE,
      maxValue: 100,
      minValue: 0,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  ITunesPlatform.AudioVolume.UUID = '00001001-0000-1000-8000-135D67EC4377';
  inherits(ITunesPlatform.AudioVolume, Characteristic);

  /*
  ITunesPlatform.Muting = function() {
    Characteristic.call(this, 'Muting', '00001002-0000-1000-8000-135D67EC4377');
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  */

  ITunesPlatform.AudioDeviceService = function(displayName, subtype) {
    Service.call(this, displayName, ITunesPlatform.AudioDeviceService.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(ITunesPlatform.AudioVolume);

    // Optional Characteristics
    this.addOptionalCharacteristic(ITunesPlatform.Muting);
    this.addOptionalCharacteristic(Characteristic.Name);
  };
  ITunesPlatform.AudioDeviceService.UUID = '00000001-0000-1000-8000-135D67EC4377';
  inherits(ITunesPlatform.AudioDeviceService, Service);
}

function ITunesPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || { "platform": "iTunes" };
  self.accessories = {};
  self.syncTimer = null;

  if (api) {
    self.api = api;

    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}

ITunesPlatform.prototype.configureAccessory = function(accessory) {
  var self = this;
  var rawDevice = accessory.context.rawDevice;

  this.accessories[rawDevice.mac] = accessory;

  accessory.reachable = true

  accessory
  .getService(Service.Switch)
  .getCharacteristic(Characteristic.On)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get selected of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ')';
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, rtn == "true" ? true : false);
      }
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set selected of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ') to ' + (newVal ? 'true' : 'false');
    osascript.execute(tell, function(err, rtn) {
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
      accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).value = value;
    }
  });

  accessory
  .getService(ITunesPlatform.AudioDeviceService)
  .getCharacteristic(ITunesPlatform.AudioVolume)
  .on('get', function(callback){
    var tell = 'tell application "iTunes" to get sound volume of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ')';
    osascript.execute(tell, function(err, rtn) {
      if (err) {
        callback(err);
      } else {
        callback(false, parseInt(rtn));
      }
    });
  })
  .on('set', function(newVal, callback){
    var tell = 'tell application "iTunes" to set sound volume of (AirPlay device id ' + parseInt(accessory.context.rawDevice.id) + ') to ' + parseInt(newVal);
    osascript.execute(tell, function(err, rtn) {
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
      accessory.getService(ITunesPlatform.AudioDeviceService).getCharacteristic(ITunesPlatform.AudioVolume).value = value;
    }
  });
}

ITunesPlatform.prototype.didFinishLaunching = function() {
  this.syncAccessories();
}

ITunesPlatform.prototype.syncAccessories = function() {
  clearTimeout(this.syncTimer);
  this.syncTimer = setTimeout(this.syncAccessories.bind(this), 60000);

  // Get the id and name of all the AirPlay devices...
  var tell = 'tell application "iTunes"\n'
      + 'set apDevMap to {}\n'
      + 'repeat with aDevice in (AirPlay devices)\n'
        //+ "copy {id:aDevice's id, name:aDevice's name, mac:aDevice's network address} to the end of the apDevMap\n"
        + "copy {aDevice's id, aDevice's name, aDevice's network address, aDevice's selected, aDevice's sound volume} to the end of the apDevMap\n"
      + 'end repeat\n'
      + 'get apDevMap\n'
  + 'end tell\n';

  osascript.execute(tell, function(err, rtn) {
    if (err) {
      this.log(err);
    }
    rtn = applescript.Parsers.parse(rtn);
    if (Array.isArray(rtn)) {
      for(var i = 0; i < rtn.length; i++)
        rtn[i] = {
          id: rtn[i][0],
          name: rtn[i][1],
          mac: (rtn[i][2] == "missing value" ? null : rtn[i][2]),
          selected: rtn[i][3] == "true" ? true : false,
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

          var volCx = accessory.getService(ITunesPlatform.AudioDeviceService).getCharacteristic(ITunesPlatform.AudioVolume);
          if(volCx.value != rawDevice.volume)
            volCx.setValue(rawDevice.volume);

          var onCx = accessory.getService(Service.Switch).getCharacteristic(Characteristic.On);
          if(onCx.value != rawDevice.selected)
            onCx.setValue(rawDevice.selected);

          if(!accessory.reachable) accessory.updateReachability(true);
        } else {
          this.addAccessory(rawDevice);
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

ITunesPlatform.prototype.addAccessory = function(rawDevice) {
  var self = this;
  var uuid = UUIDGen.generate(rawDevice.mac);

  var newAccessory = new Accessory(rawDevice.name, uuid, 1); // 1 = Accessory.Category.OTHER
  newAccessory.context.rawDevice = rawDevice;

  newAccessory.addService(Service.Switch, rawDevice.name);
  newAccessory.addService(ITunesPlatform.AudioDeviceService, rawDevice.name);

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
