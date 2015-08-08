mkdir packager/assets
rm -rf p2/scripts
mkdir p2/scripts
rm -rf p3/scripts
mkdir p3/scripts
cp raspberryjampe.js p2/
cp raspberryjampe.js p3/
cp -r p2/snippets p3
cp -r `grep -l Pruss ../mc/python2-scripts/mcpipy/*.py` ../mc/python2-scripts/mcpipy/mcpi p2/scripts
cp -r ../mc/python2-scripts/mcpipy/{models,vehicles} p2/scripts
rm p2/scripts/neurosky.py
cp -r `grep -l Pruss ../mc/python3-scripts/mcpipy/*.py` ../mc/python3-scripts/mcpipy/mcpi p3/scripts
rm -r p3/scripts/mcpi/__pycache__
cp -r ../mc/python2-scripts/mcpipy/{models,vehicles} p3/scripts
rm p3/scripts/neurosky.py
rm p[23]/scripts/*.pyc p[23]/scripts/*/*.pyc
sed --in-place='' 's/^minecraftType.*/minecraftType = MINECRAFT_POCKET_EDITION/' p[23]/scripts/mcpi/settings.py
echo 'address = "127.0.0.1"' > p2/scripts/server.py
echo 'is_pi = False' >> p2/scripts/server.py
echo 'address = "127.0.0.1"' > p3/scripts/server.py
echo 'is_pi = False' >> p3/scripts/server.py
chmod -R u+rw p2 p3
rm packager/assets/*.zip
(cd p2 && zip -9r ../packager/assets/p2 *)
(cd p3 && zip -9r ../packager/assets/p3 *)
