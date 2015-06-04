mkdir res/drawable-xxhdpi
mkdir res/drawable-xhdpi
mkdir res/drawable-hdpi
mkdir res/drawable-mdpi

convert icon.png -resize 144x144 res/drawable-xxhdpi/icon.png
convert icon.png -resize 96x96 res/drawable-xhdpi/icon.png
convert icon.png -resize 72x72 res/drawable-hdpi/icon.png
convert icon.png -resize 48x48 res/drawable-mdpi/icon.png

