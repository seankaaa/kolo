"""Builds data/areas.json: US states + metros + the original Bay Area hierarchy. Approximate centroids."""
import json, re

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
areas = []
def add(id, name, level, parent, lat, lng, r, aliases=()):
    areas.append({"id": id, "name": name, "aliases": list(aliases), "level": level, "parentId": parent, "center": [lat, lng], "radius_km": r})

STATES = [  # code, name, lat, lng, radius_km
 ("al","Alabama",32.8,-86.8,170),("ak","Alaska",64.0,-152.0,600),("az","Arizona",34.2,-111.7,240),("ar","Arkansas",34.9,-92.4,170),
 ("ca","California",37.2,-119.5,350),("co","Colorado",39.0,-105.5,230),("ct","Connecticut",41.6,-72.7,60),("de","Delaware",39.0,-75.5,45),
 ("dc","District of Columbia",38.905,-77.03,9),("fl","Florida",28.6,-82.4,260),("ga","Georgia",32.7,-83.4,200),("hi","Hawaii",20.8,-156.3,200),
 ("id","Idaho",44.4,-114.6,230),("il","Illinois",40.0,-89.2,200),("in","Indiana",39.9,-86.3,150),("ia","Iowa",42.1,-93.5,170),
 ("ks","Kansas",38.5,-98.4,220),("ky","Kentucky",37.5,-85.3,170),("la","Louisiana",31.0,-92.0,180),("me","Maine",45.4,-69.2,150),
 ("md","Maryland",39.0,-76.8,90),("ma","Massachusetts",42.3,-71.8,90),("mi","Michigan",44.3,-85.4,230),("mn","Minnesota",46.3,-94.3,250),
 ("ms","Mississippi",32.7,-89.7,170),("mo","Missouri",38.4,-92.5,210),("mt","Montana",47.0,-109.6,330),("ne","Nebraska",41.5,-99.8,230),
 ("nv","Nevada",39.3,-116.6,270),("nh","New Hampshire",43.7,-71.6,80),("nj","New Jersey",40.1,-74.7,80),("nm","New Mexico",34.4,-106.1,260),
 ("ny","New York State",42.9,-75.5,200),("nc","North Carolina",35.5,-79.4,200),("nd","North Dakota",47.5,-100.5,210),("oh","Ohio",40.3,-82.8,170),
 ("ok","Oklahoma",35.6,-97.5,210),("or","Oregon",43.9,-120.6,250),("pa","Pennsylvania",40.9,-77.8,180),("ri","Rhode Island",41.7,-71.5,30),
 ("sc","South Carolina",33.9,-80.9,140),("sd","South Dakota",44.4,-100.2,210),("tn","Tennessee",35.9,-86.4,170),("tx","Texas",31.5,-99.3,420),
 ("ut","Utah",39.3,-111.7,220),("vt","Vermont",44.1,-72.7,70),("va","Virginia",37.5,-78.8,190),("wa","Washington",47.4,-120.5,230),
 ("wv","West Virginia",38.6,-80.6,130),("wi","Wisconsin",44.6,-89.9,200),("wy","Wyoming",43.0,-107.5,250),
]
STATE_ALIASES = {"la": [], "sd": [], "ny": ["NY", "New York State"], "dc": ["Washington DC", "D.C."], "ca": ["CA", "Cali"], "tx": ["TX"], "fl": ["FL"],
                 "il": ["IL"], "wa": ["Washington State", "WA"], "pa": ["PA"], "oh": ["OH"], "ga": ["GA"], "ma": ["MA"]}
for code, name, lat, lng, r in STATES:
    add(code, name, "state", None, lat, lng, r, STATE_ALIASES.get(code, [code.upper()]))

# --- Bay Area: unchanged hierarchy, now under California ---
add("bay-area","Bay Area","region","ca",37.75,-122.25,60,["SF Bay Area","San Francisco Bay Area","Bay"])
for id,name,lat,lng,r,al in [("sf","San Francisco",37.76,-122.44,8,["SF","San Fran","Frisco"]),("east-bay","East Bay",37.80,-122.22,20,[]),
    ("south-bay","South Bay",37.34,-121.93,20,["Silicon Valley"]),("peninsula","Peninsula",37.52,-122.30,15,[]),("north-bay","North Bay",38.10,-122.60,25,["Marin"])]:
    add(id,name,"subregion","bay-area",lat,lng,r,al)
for id,name,p,lat,lng in [("oakland","Oakland","east-bay",37.8044,-122.2712),("berkeley","Berkeley","east-bay",37.8715,-122.2730),
    ("fremont","Fremont","east-bay",37.5485,-121.9886),("hayward","Hayward","east-bay",37.6688,-122.0808),("san-jose","San Jose","south-bay",37.3382,-121.8863),
    ("sunnyvale","Sunnyvale","south-bay",37.3688,-122.0363),("santa-clara","Santa Clara","south-bay",37.3541,-121.9552),("daly-city","Daly City","peninsula",37.6879,-122.4702),
    ("san-mateo","San Mateo","peninsula",37.5630,-122.3255),("redwood-city","Redwood City","peninsula",37.4852,-122.2364),
    ("san-rafael","San Rafael","north-bay",37.9735,-122.5311),("santa-rosa","Santa Rosa","north-bay",38.4404,-122.7141)]:
    add(id,name,"city",p,lat,lng,5)
for id,name,lat,lng in [("mission","Mission",37.7599,-122.4148),("excelsior","Excelsior",37.7244,-122.4272),("sunset","Sunset",37.7530,-122.4940),
    ("richmond","Richmond",37.7800,-122.4830),("bayview","Bayview",37.7290,-122.3920),("outer-mission","Outer Mission",37.7190,-122.4420)]:
    add(id,name,"neighborhood","sf",lat,lng,1.2)

# --- Other metros: (id, name, state, lat, lng, r, aliases, [children]) ; child = (name, level, lat, lng, r, aliases, [grandchildren]) ---
METROS = [
 ("nyc","New York City","ny",40.71,-74.0,30,["NYC","New York","NY City","The City","Big Apple"],[
   ("Brooklyn","subregion",40.65,-73.95,9,["BK"],[("Brighton Beach",40.5776,-73.9614),("Sunset Park",40.6455,-74.0124)]),
   ("Queens","subregion",40.73,-73.82,11,[],[("Jackson Heights",40.7557,-73.8831),("Corona",40.7450,-73.8642),("Flushing",40.7675,-73.8331)]),
   ("Bronx","subregion",40.845,-73.865,7,["The Bronx"],[]),
   ("Manhattan","subregion",40.78,-73.97,6,[],[("Washington Heights",40.8417,-73.9394)]),
   ("Staten Island","subregion",40.58,-74.15,8,[],[]),
   ("Northern NJ","subregion",40.78,-74.15,18,["North Jersey","Jersey City","Newark","Paterson"],[])]),
 ("los-angeles","Greater Los Angeles","ca",34.05,-118.25,50,["LA","L.A.","Los Angeles","SoCal"],[
   ("San Fernando Valley","subregion",34.2,-118.45,15,["The Valley","SFV"],[]),
   ("East LA","subregion",34.03,-118.17,6,["East Los Angeles","Boyle Heights"],[]),
   ("South LA","subregion",33.96,-118.28,8,["South Central"],[]),
   ("Westside","subregion",34.03,-118.45,8,["Santa Monica"],[]),
   ("San Gabriel Valley","subregion",34.08,-118.05,14,["SGV","Alhambra","El Monte"],[]),
   ("Orange County","subregion",33.72,-117.83,25,["OC","Anaheim","Santa Ana"],[])]),
 ("chicago","Chicago","il",41.88,-87.65,35,["Chi-town","Chi","Chicagoland"],[
   ("Pilsen","neighborhood",41.8565,-87.6566,1.5,[],[]),("Little Village","neighborhood",41.8445,-87.7110,1.8,["La Villita"],[]),
   ("Ukrainian Village","neighborhood",41.8990,-87.6855,1.2,[],[]),("Rogers Park","neighborhood",42.0106,-87.6696,1.8,[],[]),
   ("Chicago Suburbs","subregion",41.95,-87.95,25,["Suburbs","Cicero","Schaumburg","Palatine"],[])]),
 ("houston","Houston","tx",29.76,-95.37,40,["H-Town","HTX"],[
   ("Gulfton","neighborhood",29.7230,-95.4680,2,[],[]),("Alief","neighborhood",29.7110,-95.5960,4,[],[]),("Pasadena TX","city",29.6911,-95.2091,6,["Pasadena"],[]),
   ("Bellaire / Chinatown","neighborhood",29.7050,-95.5450,3,["Houston Chinatown"],[])]),
 ("dfw","Dallas–Fort Worth","tx",32.80,-97.0,50,["DFW","Dallas","Fort Worth"],[
   ("Dallas","city",32.78,-96.80,12,[],[]),("Fort Worth","city",32.75,-97.33,12,[],[]),("Irving","city",32.81,-96.95,7,[],[]),("Garland","city",32.91,-96.64,7,[],[])]),
 ("san-antonio","San Antonio","tx",29.42,-98.49,30,["SA","SATX"],[
   ("West Side San Antonio","subregion",29.42,-98.55,6,["West Side"],[]),("South Side San Antonio","subregion",29.35,-98.48,7,["South Side"],[]),("Northeast San Antonio","subregion",29.53,-98.41,8,[],[])]),
 ("miami","Miami","fl",25.76,-80.30,35,["Miami-Dade","South Florida","MIA"],[
   ("Hialeah","city",25.8576,-80.2781,5,[],[]),("Little Havana","neighborhood",25.7731,-80.2194,1.6,["Pequeña Habana"],[]),
   ("Doral","city",25.8195,-80.3553,5,[],[]),("Kendall","city",25.6793,-80.3173,6,[],[])]),
 ("phoenix","Phoenix","az",33.45,-112.07,40,["PHX","Valley of the Sun"],[
   ("Maryvale","neighborhood",33.4950,-112.1850,4,[],[]),("Mesa","city",33.4152,-111.8315,10,[],[]),("Glendale AZ","city",33.5387,-112.1860,8,["Glendale"],[]),("Tempe","city",33.4255,-111.94,6,[],[])]),
 ("san-diego","San Diego","ca",32.75,-117.10,30,["SD","SoCal"],[
   ("Chula Vista","city",32.6401,-117.0842,7,[],[]),("City Heights","neighborhood",32.7480,-117.1000,2,[],[]),("Escondido","city",33.1192,-117.0864,7,[],[])]),
 ("denver","Denver","co",39.74,-104.99,30,["Mile High"],[
   ("Aurora","city",39.7294,-104.8319,9,[],[]),("Westwood Denver","neighborhood",39.6990,-105.0390,1.5,["Westwood"],[]),("Lakewood","city",39.7047,-105.0814,7,[],[])]),
 ("seattle","Seattle","wa",47.55,-122.25,35,["SEA","Puget Sound"],[
   ("Kent","city",47.3809,-122.2348,6,[],[]),("Federal Way","city",47.3223,-122.3126,6,[],[]),("Bellevue","city",47.6101,-122.2015,6,[],[]),("Seattle City","city",47.6062,-122.3321,7,["Downtown Seattle"],[])]),
 ("sacramento","Sacramento","ca",38.58,-121.40,30,["Sac","Sactown"],[
   ("Rancho Cordova","city",38.5891,-121.3027,6,[],[]),("Citrus Heights","city",38.7071,-121.2811,5,[],[]),
   ("West Sacramento","city",38.5805,-121.5302,5,["West Sac"],[]),("North Highlands","city",38.6857,-121.3722,4,[],[])]),
 ("philadelphia","Philadelphia","pa",39.98,-75.15,25,["Philly","PHL"],[
   ("Northeast Philly","subregion",40.06,-75.05,8,["Northeast Philadelphia","NE Philly"],[]),("South Philly","subregion",39.925,-75.17,4,["South Philadelphia"],[]),("North Philly","subregion",40.0,-75.15,5,[],[])]),
 ("dc-metro","Washington DC area","dc",38.92,-77.05,30,["DC","DMV","D.C. area","Washington DC"],[
   ("Silver Spring","city",38.9907,-77.0261,5,[],[]),("Arlington","city",38.8816,-77.0910,5,[],[]),("Columbia Heights","neighborhood",38.9283,-77.0326,1.3,[],[]),("Langley Park","city",38.9887,-76.9811,2,[],[])]),
 ("boston","Boston","ma",42.36,-71.06,25,["Beantown","BOS"],[
   ("East Boston","neighborhood",42.375,-71.039,2,["Eastie"],[]),("Chelsea","city",42.3918,-71.0328,2.5,[],[]),("Dorchester","neighborhood",42.30,-71.06,3,[],[]),("Somerville","city",42.3876,-71.0995,3,[],[])]),
 ("atlanta","Atlanta","ga",33.75,-84.39,35,["ATL","Hotlanta"],[
   ("Buford Highway","subregion",33.87,-84.30,6,["Doraville","Chamblee"],[]),("Decatur","city",33.7748,-84.2963,4,[],[]),("Marietta","city",33.9526,-84.5499,6,[],[])]),
 ("minneapolis","Minneapolis–St. Paul","mn",44.97,-93.20,30,["Twin Cities","Minneapolis","St. Paul","MSP"],[
   ("Lake Street","neighborhood",44.9480,-93.2600,2.5,[],[]),("St. Paul","city",44.9537,-93.09,8,["Saint Paul"],[]),("Brooklyn Park","city",45.0941,-93.3563,6,[],[])]),
]
for mid, name, state, lat, lng, r, al, kids in METROS:
    add(mid, name, "region", state, lat, lng, r, al)
    for cname, lvl, clat, clng, cr, cal, gk in kids:
        cid = slug(cname)
        add(cid, cname, lvl, mid, clat, clng, cr, cal)
        for gname, glat, glng in gk:
            add(slug(gname), gname, "neighborhood", cid, glat, glng, 1.4)

# Standalone cities outside the metros, for "Somewhere in Ohio"-style scopes the state level is enough.
ids = [a["id"] for a in areas]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
json.dump(areas, open("data/areas.json", "w"), indent=1, ensure_ascii=False)
print(len(areas), "areas")
