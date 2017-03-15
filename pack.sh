mkdir packager/assets
rm -rf p2/scripts
mkdir p2/scripts
cp raspberryjampe.js p2/
cp -r `grep -l Pruss ../mc/mcpipy/*.py` ../mc/mcpipy/mcpi p2/scripts
cp -r ../mc/mcpipy/{models,vehicles} p2/scripts
cp ../mc/mcpipy/nasaearth.jpg p2/scripts
rm p2/scripts/neurosky.py p2/scripts/writebook.py p2/scripts/danielbates_setblockdemo.py
sed --in-place='' 's/^minecraftType.*/minecraftType = MINECRAFT_POCKET_EDITION/' p2/scripts/mcpi/settings.py
echo 'address = "127.0.0.1"' > p2/scripts/server.py
echo 'is_pi = False' >> p2/scripts/server.py
rm -rf p2/scripts3
cp -r p2/scripts p2/scripts3
chmod -R u+rw p2
rm packager/assets/*.zip
(cd p2 && zip -9r ../packager/assets/py *)
