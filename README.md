# Monde Ouvert — île 3D multi-véhicules

Une île de 8 km où l'on peut changer de véhicule à tout moment avec une roue de sélection façon GTA V. Tous les véhicules de mes simulateurs sont réunis dans le même monde.

## La roue des véhicules

Maintiens **Tab** : la roue s'ouvre et le temps ralentit. Survole une catégorie et ses véhicules apparaissent autour, avec leur miniature. Survole celui que tu veux puis relâche **Tab** (ou clique) : il apparaît à ta position.
- **Continuité :** le nouveau véhicule reprend la position, l'orientation et la vitesse du précédent. Une voiture qui apparaît en l'air reste en l'air et tombe. Un avion trop lent pour voler passe en vol stationnaire.
- **Sans place :** si la place manque (rotor, ailes, intérieur d'un immeuble), le véhicule monte jusqu'à être dégagé.

## Les véhicules

| Catégorie | Véhicules |
|---|---|
| Voitures | Tesla Roadster (roule sur les murs et les plafonds, propulseurs, boost, figures), supercar V12 (nouveau), voiture de drift (Drift King), **voiture volante** (style mod Cyberpunk « Let There Be Flight ») |
| Deux-roues | Ducati Panigale V4 R (Moto Rider), Kukirin G6 (dérapage, wheelie), trottinette freestyle (flips, tailwhips, barspins) |
| Hélicoptères | Colibri (léger, 2 places), Atlas (transport, 2 pilotes + 12 places à l'arrière, vue cabine) |
| Avions | F-35B (décollage vertical, post-combustion), PV-40 (aile basculante) |
| Drones | Drone FPV 5" (modes Angle et Acro) |

Les modèles 3D et la physique viennent des projets d'origine. Seuls la supercar, les deux hélicoptères et la voiture volante sont nouveaux.

## Voiture volante

Inspirée du mod « Let There Be Flight » (Nexus 5208). Au sol c'est une voiture ; **O** active le vol (L3 à la manette), propulseurs animés.

| Touche | Action |
|---|---|
| O | Voler / couper le vol ; en vol : atterrissage assisté (re-appuyer annule) |
| G / B | Mode de vol suivant / précédent (RB / LB) |
| Z S Q D | Avancer, reculer, tourner |
| Espace / Ctrl | Monter / descendre (Hover & Fly) ; poussée (Drone) |
| A / E | Glisser à gauche / droite (Hover) ; roulis (Drone) |
| Maj | Boost (Hover) ; plus de poussée (mode Vol, Ctrl = moins) |
| F maintenu 0,3 s | Sortir en vol (la voiture se pose) |
| K / L / R / C | Couleur, phares, redresser, caméra (dont vue sur le toit) |

- **Hover & Fly** (facile) : stabilisation automatique, la voiture reste en l'air quand on lâche tout.
- **Drone** (avancé) : corps libre, poussée selon le haut de la voiture, rotations directes sans stabilisation.
- **Vol** : poussée vers l'avant, portance selon la vitesse, commandes d'avion, décrochage sous ~60 km/h.
- L'eau ramène la voiture sur la route. Pas de système de vie : les chocs ne font que du bruit et une secousse.
- Posé doucement et à plat (moins de 9 m/s de descente), la voiture reprend ses roues toute seule.
- Les modes autres que Hover & Fly et Drone ne sont pas décrits sur la page du mod : « Vol » est de ma conception.

## La carte

- **Ville :** immeubles, lampadaires, voitures garées, parc et tremplin sur l'avenue centrale.
- **Aéroport :** piste de 1,4 km, tour de contrôle et hangars.
- **Parc de cascades :** au sud de l'aéroport, repris de la Tesla : tube 360°, tunnels, looping, half-pipe, mur vertical et tremplins.
- **Campagne :** champs, fermes, éoliennes et lac.
- **Forêt :** collines boisées à l'ouest.
- **Désert :** mesas, cactus et station-service au nord-est.
- **Montagnes :** sommets enneigés au nord, avec le col des Aigles.
- **Île aux Palmiers :** au sud-est, reliée par un pont, avec un village, une hélisurface et un ponton.
- **Îlot du Phare :** à l'ouest.

Il y a un cycle jour/nuit (fenêtres et lampadaires allumés la nuit). La carte (**M**) permet de se téléporter d'un clic.

## Commandes générales

- **Tab** (maintenir) : roue des véhicules
- **C** : caméra (poursuite, éloignée, cockpit). Clic gauche + glisser pour tourner autour du véhicule.
- **R** : remettre le véhicule d'aplomb
- **M** : carte et téléportation
- **H** : commandes du véhicule en cours
- **N** / **T** : avancer de 6 h / accélérer le temps
- **X** : qualité graphique
- **P** : son
- **Échap** : pause

## Performances

- **Relief :** découpé en 100 tuiles, chacune en 4 niveaux de détail selon la distance. Les tuiles au-delà de la distance de vue (brouillard) ne sont pas dessinées.
- **Ville, arbres et rochers :** groupés par tuiles, pour que ce qui est derrière la caméra ou trop loin ne soit pas dessiné. Les arbres lointains utilisent un modèle simplifié et seuls les plus proches projettent une ombre. Les lampadaires et les voitures garées n'apparaissent que de près.
- **Véhicules :** les pièces fixes qui partagent un matériau sont fusionnées.
- **Résolution et interface :** la résolution baisse automatiquement si le jeu ralentit. Si ça reste lent, il passe en qualité performance (touche **X**). L'interface est rafraîchie 15 fois par seconde.

## Organisation du code

- **Le monde :**
  - `js/world/terrain.js` : relief, routes, ponts, surfaces, carte
  - `js/world/city.js` : la ville
  - `js/world/props.js` : végétation, fermes, aéroport, île, tremplins
  - `js/world/stunts.js` : parc de cascades
  - `js/world/index.js` : requêtes physiques (sol, eau, obstacles) et maillage de collision (BVH) pour la Tesla
- **Les véhicules :**
  - `js/vehicles/` : un fichier par famille (`cars`, `tesla`, `bikes`, `helis`, `planes`, `drone`, `flycar`) ; `flycar-logic.js` = règles pures testées par `test/flycar-check.mjs`
  - `js/vehicles/index.js` : la liste des véhicules pour la roue
- **Les modèles 3D :** `js/models/`, repris des autres projets puis adaptés à Three.js r186
- **Le jeu :**
  - `js/main.js` : rendu, ciel, caméras, entrées, changement de véhicule
  - `js/wheel.js` : la roue
  - `js/hud.js` : l'interface
  - `js/audio.js` : les sons synthétisés

HTML, CSS et JavaScript, sans build. Three.js est chargé depuis un CDN.

## Crédits des modèles 3D

Véhicules réels sous licence CC-BY (Sketchfab) : auteurs et licences dans `assets/models/CREDITS.md`.
