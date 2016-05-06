tell application "iTunes"
	if not (exists current track) then return missing value
	if not (artworks of current track exists) then return missing value
	set outputTempFN to "/tmp/homebridge-itunes-artwork.tmp" as POSIX file
	set outputJpegFN to "/tmp/homebridge-itunes-artwork.jpg" as POSIX file
	set theArt to the first artwork of the current track
	tell theArt to set artFormat to (get format) as text
	--set artRawData to a reference to the raw data of theArt
	set artRawData to the raw data of theArt
	set tempFileHandle to (open for access outputTempFN with write permission)
	try
		tell application "System Events"
			write artRawData to tempFileHandle starting at 0
			--set file type of (outputTempFN as alias) to ".tiff"
		end tell
		close access tempFileHandle
	on error err_msg
		log err_msg
		close access tempFileHandle
		return missing value
	end try
	tell application "Image Events"
		launch
		set tempImageRef to open outputTempFN
		copy dimensions of tempImageRef to {W, H}
		set scaleFactor to 300 / H
		scale tempImageRef by factor scaleFactor
		save tempImageRef as JPEG with compression level high in (outputJpegFN as text) with icon
		close tempImageRef
	end tell
	tell application "System Events"
		return (read outputJpegFN as JPEG picture)
	end tell
end tell

