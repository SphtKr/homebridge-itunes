var inherits = require('util').inherits;
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  var HomeKitMediaTypes = {};

  // Characteristics

  HomeKitMediaTypes.AudioVolume = function() {
    Characteristic.call(this, 'Audio Volume', HomeKitMediaTypes.AudioVolume.UUID);
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
  HomeKitMediaTypes.AudioVolume.UUID = '00001001-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.AudioVolume, Characteristic);

  HomeKitMediaTypes.Muting = function() {
    Characteristic.call(this, 'Muting', HomeKitMediaTypes.Muting.UUID);
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.Muting.UUID = '00001002-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.Muting, Characteristic);

  HomeKitMediaTypes.PlaybackState = function() {
    Characteristic.call(this, 'Playback State', HomeKitMediaTypes.PlaybackState.UUID);
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.PlaybackState.UUID = '00002001-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.PlaybackState, Characteristic);
  HomeKitMediaTypes.PlaybackState.PLAYING = 0;
  HomeKitMediaTypes.PlaybackState.PAUSED = 1;
  HomeKitMediaTypes.PlaybackState.STOPPED = 2;

  HomeKitMediaTypes.SkipForward = function() {
    Characteristic.call(this, 'Skip Forward', HomeKitMediaTypes.SkipForward.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.SkipForward.UUID = '00002002-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.SkipForward, Characteristic);

  HomeKitMediaTypes.SkipBackward = function() {
    Characteristic.call(this, 'Skip Backward', HomeKitMediaTypes.SkipBackward.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.SkipBackward.UUID = '00002003-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.SkipBackward, Characteristic);

  HomeKitMediaTypes.ShuffleMode = function() {
    Characteristic.call(this, 'Shuffle Mode', HomeKitMediaTypes.ShuffleMode.UUID);
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.ShuffleMode.UUID = '00002004-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.ShuffleMode, Characteristic);
  //NOTE: If GROUP or SET is not supported, accessories should coerce to ALBUM.
  // If ALBUM is not supported, coerce to ITEM.
  // In general, it is recommended for apps to only assume OFF, ITEM, and ALBUM
  // are supported unless it is known that the accessory supports other settings.
  HomeKitMediaTypes.ShuffleMode.OFF = 0;
  //NOTE: INDIVIDUAL is deprecated.
  HomeKitMediaTypes.ShuffleMode.ITEM = HomeKitMediaTypes.ShuffleMode.INDIVIDUAL = 1;
  HomeKitMediaTypes.ShuffleMode.GROUP = 2; // e.g. iTunes "Groupings"
  HomeKitMediaTypes.ShuffleMode.ALBUM = 3; // e.g. album or season
  HomeKitMediaTypes.ShuffleMode.SET = 4; // e.g. T.V. Series or album box set

  HomeKitMediaTypes.RepeatMode = function() {
    Characteristic.call(this, 'Repeat Mode', HomeKitMediaTypes.RepeatMode.UUID);
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.RepeatMode.UUID = '00002005-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.RepeatMode, Characteristic);
  HomeKitMediaTypes.RepeatMode.OFF = 0;
  HomeKitMediaTypes.RepeatMode.ONE = 1;
  HomeKitMediaTypes.RepeatMode.ALL = 2;

  HomeKitMediaTypes.PlaybackSpeed = function() {
    Characteristic.call(this, 'Playback Speed', HomeKitMediaTypes.PlaybackSpeed.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.PlaybackSpeed.UUID = '00002006-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.PlaybackSpeed, Characteristic);

  HomeKitMediaTypes.MediaCurrentPosition = function() {
    Characteristic.call(this, 'Media Current Position', HomeKitMediaTypes.MediaCurrentPosition.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT, // In seconds
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.MediaCurrentPosition.UUID = '00002007-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaCurrentPosition, Characteristic);

  HomeKitMediaTypes.MediaItemName = function() {
    Characteristic.call(this, 'Media Name', HomeKitMediaTypes.MediaItemName.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.MediaItemName.UUID = '00003001-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaItemName, Characteristic);

  HomeKitMediaTypes.MediaItemAlbumName = function() {
    Characteristic.call(this, 'Media Album Name', HomeKitMediaTypes.MediaItemAlbumName.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.MediaItemAlbumName.UUID = '00003002-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaItemAlbumName, Characteristic);

  HomeKitMediaTypes.MediaItemArtist = function() {
    Characteristic.call(this, 'Media Artist', HomeKitMediaTypes.MediaItemArtist.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.MediaItemArtist.UUID = '00003003-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaItemArtist, Characteristic);

  HomeKitMediaTypes.MediaItemArtwork = function() {
    Characteristic.call(this, 'Media Artwork', HomeKitMediaTypes.MediaItemArtwork.UUID);
    this.setProps({
      format: Characteristic.Formats.DATA,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.MediaItemArtwork.UUID = '00003004-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaItemArtwork, Characteristic);

  HomeKitMediaTypes.MediaItemDuration = function() {
    Characteristic.call(this, 'Media Duration', HomeKitMediaTypes.MediaItemDuration.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT, // In seconds
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  HomeKitMediaTypes.MediaItemDuration.UUID = '00003005-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaItemDuration, Characteristic);

  // Services

  HomeKitMediaTypes.AudioDeviceService = function(displayName, subtype) {
    Service.call(this, displayName, HomeKitMediaTypes.AudioDeviceService.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(HomeKitMediaTypes.AudioVolume);

    // Optional Characteristics
    this.addOptionalCharacteristic(HomeKitMediaTypes.Muting);
    this.addOptionalCharacteristic(Characteristic.Name);
  };
  HomeKitMediaTypes.AudioDeviceService.UUID = '00000001-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.AudioDeviceService, Service);

  HomeKitMediaTypes.PlaybackDeviceService = function(displayName, subtype) {
    Service.call(this, displayName, HomeKitMediaTypes.PlaybackDeviceService.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(HomeKitMediaTypes.PlaybackState);

    // Optional Characteristics
    this.addOptionalCharacteristic(HomeKitMediaTypes.SkipForward);
    this.addOptionalCharacteristic(HomeKitMediaTypes.SkipBackward);
    this.addOptionalCharacteristic(HomeKitMediaTypes.ShuffleMode);
    this.addOptionalCharacteristic(HomeKitMediaTypes.RepeatMode);
    this.addOptionalCharacteristic(HomeKitMediaTypes.PlaybackSpeed);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaCurrentPosition);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemName);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemAlbumName);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemArtist);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemArtwork);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemDuration);
    this.addOptionalCharacteristic(Characteristic.Name);
  };
  HomeKitMediaTypes.PlaybackDeviceService.UUID = '00000002-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.PlaybackDeviceService, Service);

  // A media information service that has no playback controls, for e.g. DAB radio...
  HomeKitMediaTypes.MediaInformationService = function(displayName, subtype) {
    Service.call(this, displayName, HomeKitMediaTypes.MediaInformationService.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(HomeKitMediaTypes.MediaItemName);

    // Optional Characteristics
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemAlbumName);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemArtist);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemArtwork);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaItemDuration);
    this.addOptionalCharacteristic(HomeKitMediaTypes.MediaCurrentPosition);
  };
  HomeKitMediaTypes.MediaInformationService.UUID = '00000003-0000-1000-8000-135D67EC4377';
  inherits(HomeKitMediaTypes.MediaInformationService, Service);

  return HomeKitMediaTypes;
};
