// The knockables: gameplay data for game-assets/models/knockables_v2.glb (generated from the pack's knockables_v2.json), then the newer packs.
// mass kg; swipes = hits to get it moving; noise 1-5; landing shatter | break | bounce | roll | thud; size W H D (m); nodes = meshes.
export const PROPS = {
  "dentures_glass": {"mass":0.3,"swipes":1,"noise":3,"landing":"shatter","tint":"#bcd6dc","size":[0.08,0.1,0.08],"nodes":{"intact":"dentures_glass","parts":["dentures_glass__teeth"],"fx":["fx_shards"],"glass":["dentures_glass"]}},
  "toilet_roll": {"mass":0.1,"swipes":1,"noise":1,"landing":"bounce","tint":"#f6f4ee","size":[0.111,0.1,0.114],"nodes":{"intact":"toilet_roll","variants":{"unrolled":"toilet_roll__thin"},"fx":["fx_ribbon"]}},
  "talc_tin": {"mass":0.2,"swipes":1,"noise":2,"landing":"bounce","tint":"#ffffff","size":[0.068,0.148,0.044],"nodes":{"intact":"talc_tin","fx":["fx_puff"]}},
  "rubber_duck": {"mass":0.05,"swipes":1,"noise":1,"landing":"bounce","tint":"#f4c430","size":[0.088,0.102,0.156],"nodes":{"intact":"rubber_duck"}},
  "soap_dish": {"mass":0.4,"swipes":2,"noise":3,"landing":"shatter","tint":"#e7b8c4","size":[0.17,0.022,0.122],"nodes":{"intact":"soap_dish","parts":["soap_dish__soap"],"fx":["fx_shards"]}},
  "perfume": {"mass":0.2,"swipes":1,"noise":3,"landing":"shatter","tint":"#e9a8c4","size":[0.086,0.116,0.035],"nodes":{"intact":"perfume","fx":["fx_shards"]}},
  "cookie_jar": {"mass":1.2,"swipes":3,"noise":4,"landing":"break","tint":"#f2e6cf","size":[0.172,0.165,0.176],"nodes":{"intact":"cookie_jar","parts":["cookie_jar__lid"],"fx":["fx_chunks"]}},
  "teapot": {"mass":0.8,"swipes":2,"noise":4,"landing":"shatter","tint":"#f4f1ea","size":[0.253,0.137,0.16],"nodes":{"intact":"teapot","fx":["fx_shards"]}},
  "mug": {"mass":0.35,"swipes":2,"noise":3,"landing":"shatter","tint":"#b8402f","size":[0.115,0.095,0.084],"nodes":{"intact":"mug","fx":["fx_shards"]}},
  "dinner_plate": {"mass":0.5,"swipes":2,"noise":4,"landing":"shatter","tint":"#f4f1ea","size":[0.256,0.025,0.26],"nodes":{"intact":"dinner_plate","fx":["fx_shards"]}},
  "salt_pepper": {"mass":0.1,"swipes":1,"noise":2,"landing":"bounce","tint":"#f4f1ea","size":[0.082,0.075,0.04],"nodes":{"intact":"salt_pepper"}},
  "yarn_ball": {"mass":0.1,"swipes":1,"noise":1,"landing":"roll","tint":"#c84a64","size":[0.098,0.098,0.098],"nodes":{"intact":"yarn_ball","fx":["fx_ribbon"]}},
  "cat_figurine": {"mass":0.4,"swipes":2,"noise":3,"landing":"break","tint":"#f4f1ea","size":[0.09,0.102,0.085],"nodes":{"intact":"cat_figurine","parts":["cat_figurine__head"]}},
  "snow_globe": {"mass":0.6,"swipes":2,"noise":4,"landing":"shatter","tint":"#a9cfe8","size":[0.1,0.081,0.1],"nodes":{"intact":"snow_globe","fx":["fx_shards"],"glass":["snow_globe__dome"]}},
  "table_lamp": {"mass":1.5,"swipes":3,"noise":4,"landing":"break","tint":"#4a78a8","size":[0.146,0.352,0.15],"nodes":{"intact":"table_lamp","parts":["table_lamp__shade"],"fx":["fx_chunks"]}},
  "picture_frame": {"mass":0.3,"swipes":1,"noise":2,"landing":"shatter","tint":"#c9a44a","size":[0.12,0.16,0.051],"nodes":{"intact":"picture_frame","fx":["fx_shards"]}},
  "mantel_clock": {"mass":1,"swipes":3,"noise":4,"landing":"break","tint":"#6a4628","size":[0.25,0.24,0.1],"nodes":{"intact":"mantel_clock","parts":["mantel_clock__face"],"fx":["fx_chunks"]}},
  "vase": {"mass":0.9,"swipes":3,"noise":5,"landing":"shatter","tint":"#2f5f9e","size":[0.136,0.285,0.14],"nodes":{"intact":"vase","fx":["fx_shards"]}},
  "rotary_phone": {"mass":1.4,"swipes":3,"noise":4,"landing":"thud","tint":"#4a2a24","size":[0.16,0.108,0.2],"nodes":{"intact":"rotary_phone","parts":["rotary_phone__handset"],"fx":["fx_cord"]}},
  "umbrella": {"mass":0.4,"swipes":2,"noise":2,"landing":"bounce","tint":"#2e3a5a","size":[0.087,0.782,0.06],"nodes":{"intact":"umbrella","variants":{"open":"umbrella__open"}}},
  "glasses": {"mass":0.05,"swipes":1,"noise":1,"landing":"bounce","tint":"#c9dde6","size":[0.106,0.049,0.113],"nodes":{"intact":"glasses","variants":{"cracked":"glasses__cracked"}}},
  "candlestick": {"mass":0.6,"swipes":2,"noise":3,"landing":"thud","tint":"#c9a44a","size":[0.1,0.317,0.1],"nodes":{"intact":"candlestick"}},
  "teacup": {"mass":0.25,"swipes":1,"noise":3,"landing":"shatter","tint":"#f4f1ea","size":[0.144,0.062,0.144],"nodes":{"intact":"teacup","fx":["fx_shards"]}},
  "button_jar": {"mass":0.7,"swipes":2,"noise":4,"landing":"shatter","tint":"#bcd6dc","size":[0.082,0.123,0.086],"nodes":{"intact":"button_jar","fx":["fx_shards","fx_button"],"glass":["button_jar__glass"]}},
  "feather_duster": {"mass":0.15,"swipes":1,"noise":1,"landing":"bounce","tint":"#c8463c","size":[0.241,0.443,0.239],"nodes":{"intact":"feather_duster","fx":["fx_feather"]}},
};
export const PALETTES = {"buttons":["#c8463c","#3c6fae","#e6c84a","#4b8a52","#efe6d6"],"feathers":["#c8463c","#3c6fae","#e6c84a","#4b8a52","#efe6d6","#8a4a9a"]};

// The second and third packs (game-assets/models/knockables_plants.glb: the plants and the new kitchen, dining and bath things;
// game-assets/models/knockables_2.glb: three more plants). lib: which pack the meshes are in. Plants: the pot shatters and the
// plant flops out whole. (Heights are of the pot or the whole thing, whichever the cat bats at.)
export const PROPS_2 = {
  "toothbrush_cup": {"mass":0.25,"swipes":1,"noise":3,"landing":"shatter","tint":"#a9d6c2","size":[0.072,0.09,0.072],"nodes":{"intact":"toothbrush_cup","parts":["toothbrush_cup__brushes"],"fx":["fx_shards"]},"lib":"plants"},
  "sugar_bowl": {"mass":0.35,"swipes":2,"noise":3,"landing":"shatter","tint":"#f4f1ea","size":[0.1,0.104,0.1],"nodes":{"intact":"sugar_bowl","fx":["fx_shards"]},"lib":"plants"},
  "measuring_jug": {"mass":0.45,"swipes":2,"noise":4,"landing":"shatter","tint":"#bcd6dc","size":[0.15,0.13,0.1],"nodes":{"intact":"measuring_jug","fx":["fx_shards"],"glass":["measuring_jug__glass"]},"lib":"plants"},
  "cake_stand": {"mass":1.2,"swipes":3,"noise":5,"landing":"shatter","tint":"#bcd6dc","size":[0.22,0.24,0.22],"nodes":{"intact":"cake_stand","fx":["fx_shards"],"glass":["cake_stand__dome"]},"lib":"plants"},
  "crystal_decanter": {"mass":1,"swipes":3,"noise":5,"landing":"shatter","tint":"#d8e6ea","size":[0.11,0.24,0.11],"nodes":{"intact":"crystal_decanter","parts":["crystal_decanter__stopper"],"fx":["fx_shards"],"glass":["crystal_decanter__glass"]},"lib":"plants"},
  "cactus_pot": {"mass":0.5,"swipes":2,"noise":3,"landing":"shatter","tint":"#c06a42","size":[0.088,0.07,0.088],"nodes":{"intact":"cactus_pot","parts":["cactus_pot__cactus"],"fx":["fx_shards"]},"lib":"plants"},
  "pincushion": {"mass":0.08,"swipes":1,"noise":1,"landing":"bounce","tint":"#c8463c","size":[0.097,0.074,0.09],"nodes":{"intact":"pincushion"},"lib":"plants"},
  "wine_glass": {"mass":0.15,"swipes":1,"noise":4,"landing":"shatter","tint":"#d8e6ea","size":[0.076,0.15,0.076],"nodes":{"intact":"wine_glass","fx":["fx_shards"],"glass":["wine_glass"]},"lib":"plants"},
  "cake": {"mass":0.8,"swipes":2,"noise":2,"landing":"thud","tint":"#f4e6d8","size":[0.174,0.098,0.174],"nodes":{"intact":"cake"},"lib":"plants"},
  "snake_plant": {"mass":1.4,"swipes":3,"noise":4,"landing":"shatter","tint":"#c8b89a","size":[0.12,0.11,0.12],"nodes":{"intact":"snake_plant","parts":["snake_plant__plant"],"fx":["fx_shards"]},"lib":"plants"},
  "pothos": {"mass":0.9,"swipes":2,"noise":4,"landing":"shatter","tint":"#e8e2d4","size":[0.11,0.09,0.11],"nodes":{"intact":"pothos","parts":["pothos__plant"],"fx":["fx_shards"]},"lib":"plants"},
  "peace_lily": {"mass":1.6,"swipes":3,"noise":4,"landing":"shatter","tint":"#b8643e","size":[0.151,0.12,0.151],"nodes":{"intact":"peace_lily","parts":["peace_lily__plant"],"fx":["fx_shards"]},"lib":"plants"},
  "monstera": {"mass":2.5,"swipes":3,"noise":5,"landing":"shatter","tint":"#d8cbb0","size":[0.17,0.14,0.17],"nodes":{"intact":"monstera","parts":["monstera__plant"],"fx":["fx_shards"]},"lib":"plants"},
  "spider_plant": {"mass":0.8,"swipes":2,"noise":3,"landing":"shatter","tint":"#d8d0c0","size":[0.11,0.09,0.11],"nodes":{"intact":"spider_plant","parts":["spider_plant__plant"],"fx":["fx_shards"]},"lib":"plants"},
  "boston_fern": {"mass":1.2,"swipes":2,"noise":4,"landing":"shatter","tint":"#b8643e","size":[0.14,0.1,0.14],"nodes":{"intact":"boston_fern","parts":["boston_fern__plant","boston_fern__plant_cards"],"fx":["fx_shards"]},"lib":"plants"},
  "jade_plant": {"mass":1,"swipes":2,"noise":4,"landing":"shatter","tint":"#4a6a8a","size":[0.1,0.07,0.1],"nodes":{"intact":"jade_plant","parts":["jade_plant__plant"],"fx":["fx_shards"]},"lib":"plants"},
  "geranium_pot": {"mass":0.9,"swipes":2,"noise":3,"landing":"shatter","tint":"#b8643e","size":[0.13,0.09,0.13],"nodes":{"intact":"geranium_pot","parts":["geranium_pot__plant","geranium_pot__plant_cards"],"fx":["fx_shards"]},"lib":"plants"},
  "succulent_pot": {"mass":0.3,"swipes":1,"noise":3,"landing":"shatter","tint":"#e8e2d4","size":[0.09,0.062,0.09],"nodes":{"intact":"succulent_pot","parts":["succulent_pot__plant"],"fx":["fx_shards"]},"lib":"k2"},
  "fern_pot": {"mass":1,"swipes":2,"noise":4,"landing":"shatter","tint":"#b86a42","size":[0.13,0.102,0.13],"nodes":{"intact":"fern_pot","parts":["fern_pot__plant"],"fx":["fx_shards"]},"lib":"k2"},
  "african_violet": {"mass":0.3,"swipes":1,"noise":3,"landing":"shatter","tint":"#e8a8c8","size":[0.08,0.062,0.08],"nodes":{"intact":"african_violet","parts":["african_violet__plant"],"fx":["fx_shards"]},"lib":"k2"},
};
Object.assign(PROPS, PROPS_2);
