# Crédits des modèles 3D

Modèles téléchargés sur [Sketchfab](https://sketchfab.com), licence **Creative Commons Attribution 4.0 (CC-BY)** : l'auteur doit être crédité, l'usage commercial est permis. Les fichiers `.glb` sont repris tels quels, sauf `rally-*.glb`, extraits d'un pack.

| Fichier | Modèle | Auteur | Utilisé dans |
|---|---|---|---|
| `tesla-roadster.glb` | Tesla Roadster | Mona x Supercars | tesla-roadster, monde-ouvert |
| `rally-peugeot-205.glb`, `rally-subaru-impreza.glb`, `rally-ford-escort.glb`, `rally-lancia-s4.glb` | 1965-2002 Rally Cars (4 voitures du pack) | DisneyCars | rally-masters, monde-ouvert (Subaru) |
| `ducati-v4r.glb` | DucatiV4R | IrfanMuaz | moto-rider |
| `yamaha-r1.glb` | Yamaha R1 | ejsnowy | moto-rider, monde-ouvert |
| `town-bus.glb` | Generic Town Bus | own.guest | bus-city-simulator |
| `man-tgx.glb` | MAN TGX 2010 V8 – High-Detail Semi-Truck | DevPoly3D | truck-france-simulator |
| `tier-scooter.glb` | Tier scooter | Niilo Poutanen | kukirin, monde-ouvert |
| `kick-scooter.glb` | Scooter | Deza | trottinette-freestyle |
| `enduro-dh.glb` | Enduro bicycle DH | Res1n | downhill-riders |
| `fpv-drone.glb` | FPV-dron_NonStop | Viktor_ | monde-ouvert |
| `f35.glb` | Lockheed Martin F35 Lightning II | andertan | sky-pilot, monde-ouvert |
| `v22-osprey.glb` | Bell Boeing V-22 Osprey Military Helicopter | Muhamad Mirza Arrafi | sky-pilot, monde-ouvert |
| `diesel-locomotive.glb` | 060 DA Diesel Locomotive | aocrisan | rail-express |
| `trailer.glb` | Remorque routière (type non vérifié) | À renseigner | truck-france-simulator (citerne visuelle) |
| `trailer (1).glb` | Variante remorque routière | À renseigner | non utilisée |
| `train_liquid_tanker_wagon_queensland_railway_wse.glb`, `train_liquid_tanker_wagon_queensland_railway_wse (1).glb` | Wagon-citerne ferroviaire | À renseigner | rail-express (fichier principal utilisé) |
| `queensland_railways_1900s_bl_heritage_carriage.glb` | Voiture voyageurs Queensland Railways | À renseigner | rail-express (voitures Corail/couchettes) |
| `queensland_railways_1200_class_diesel_locomotive.glb` | Locomotive diesel Queensland Railways 1200 class | À renseigner | rail-express (locomotives diesel) |
| `gros helico.glb`, `petit helico.glb` | Hélicoptères (modèles à confirmer) | À renseigner | non utilisés : pivots rotor/cockpit à adapter |
| `sydney_l1_inner_west_light_rail_tram.glb`, `sydney_metro_driverless_train__alstom_metropolis.glb` | Tramway et métro de Sydney | À renseigner | non utilisés : aucun véhicule correspondant dans le jeu |

## Licence à vérifier

`ferrari.glb` : Ferrari 458 Italia par vicent091036, repris des exemples de three.js (drift-king, drift-zone, fpv-racer, monde-ouvert). La page Sketchfab d'origine est désactivée : la licence n'a pas pu être confirmée. À contrôler avant toute publication.

## Chargement

`assets/glb.js` charge et cadre les modèles (taille, centrage, sol). Les anciens modèles procéduraux, leurs intérieurs et caméras d'habitacle ont été supprimés ; les caméras sont posées sur des points du vrai modèle. Les GLB ajoutés (remorques, wagons, locomotives) remplacent les visuels correspondants au chargement, avec le modèle procédural conservé comme secours. Les hélicoptères, PNJ et pilotes restent procéduraux.
