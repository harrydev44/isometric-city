# Rise of Nations - Complete Sprite Audit Report

**Date:** December 30, 2025  
**Scope:** All 5 Ages × All Building Types  
**Total Sprites Audited:** 155 (31 buildings × 5 ages)

## Executive Summary

| Age | Total Issues | Critical | Minor (Cropping) | Perfect |
|-----|-------------|----------|------------------|---------|
| Classical | 14 | 8 | 6 | 17 |
| Medieval | 18 | 6 | 6 | 14 |
| Enlightenment | 16 | 10 | 6 | 10 |
| Industrial | 14 | 2 | 12 | 16 |
| Modern | 10 | 5 | 5 | 17 |

**Key Findings:**
- Many defensive buildings (fort, fortress, stockade) use wrong sprites across ages
- Several buildings have bleeding issues from adjacent sprites
- Industrial/Modern ages have good factory/refinery sprites but need some tweaks
- Farm and Airbase correctly use IsoCity alternatives

---

## Classical Age Issues

### Critical (Wrong Sprite Type)
| Building | Current Position | Issue | Fix |
|----------|-----------------|-------|-----|
| stable | row 3, col 4 | Shows market/shop | Use row 3, col 1 |
| market | row 3, col 2 | Shows Roman villa | Use row 3, col 3 (actual market stalls) |
| lumber_mill | row 4, col 1 | Industrial factory - anachronistic | Use row 4, col 0 (workshop) |
| fort | row 2, col 4 | Lighthouse! | Use row 1, col 3 |
| fortress | row 3, col 0 | Pantheon dome | Use row 1, col 3 |
| stockade | row 0, col 1 | Parthenon temple | Use row 4, col 0 |
| woodcutters_camp | row 3, col 0 | Pantheon dome | Use row 4, col 0 |
| siege_factory | row 4, col 1 | Industrial factory | Use row 4, col 0 |

### Cropping Issues
| Building | Issue | Fix |
|----------|-------|-----|
| university | Bleeding at top | cropTop: 0.05 |
| barracks | Bleeding at top | cropTop: 0.05 |
| tower | Bleeding at top | cropTop: 0.05 |
| market | Bleeding at top | cropTop: 0.10 |

---

## Medieval Age Issues

### Critical (Wrong Sprite Type)
| Building | Current Position | Issue | Fix |
|----------|-----------------|-------|-----|
| lumber_mill | row 0, col 3 | Shows watchtower | Use row 3, col 3 (barn/workshop) |
| fortress | row 1, col 3 | Same as barracks | Use row 5, col 1 (stone fortress) |
| mine | row 4, col 2 | Shows forge (better for smelter) | Swap with row 4, col 3 |
| siege_factory | row 3, col 4 | Shows barn | Use row 4, col 2 (forge) |
| stockade | No override | Falls back to default | Add row 3, col 1 |
| senate | row 5, col 2 | Classical dome - anachronistic | Consider row 1, col 4 |

### Cropping Issues
| Building | Issue | Fix |
|----------|-------|-----|
| market | Bleeding at top | cropTop: 0.12 |
| university | Bleeding at top | cropTop: 0.10 |
| barracks | Bleeding at top | cropTop: 0.05 |
| granary | Bleeding at top | cropTop: 0.05 |

---

## Enlightenment Age Issues

### Critical (Wrong Sprite Type)
| Building | Current Position | Issue | Fix |
|----------|-----------------|-------|-----|
| smelter | row 3, col 3 | COTTAGE with garden! | Use row 4, col 2 (factory) |
| fort | row 5, col 1 | Decorative BRIDGE | Use row 1, col 3 (compound) |
| tower | row 2, col 1 | Water tower | Use row 1, col 3 or medieval fallback |
| bunker | row 4, col 0 | Shop with awning | Use row 4, col 2 (industrial) |
| barracks | row 1, col 4 | Civic/museum building | Use row 1, col 3 (compound) |
| market | row 0, col 3 | Fire station | Use row 4, col 0 (shop) |
| stockade | row 0, col 1 | Georgian townhouse | Use row 1, col 3 |
| castle | row 0, col 0 | Same as city_center | Use row 5, col 2 or medieval |
| fortress | row 1, col 3 | Industrial/modern look | Use medieval fallback |
| oil_well/refinery | Various | Anachronistic for 1700s | Hide or use mine sprite |

### Cropping Issues
| Building | Issue | Fix |
|----------|-------|-----|
| university | Bleeding at top | cropTop: 0.05 |
| dock | Bleeding at top | cropTop: 0.05 |
| mine | Bleeding at top | cropTop: 0.05 |
| granary | Bleeding at top | cropTop: 0.05 |
| lumber_mill | Bleeding at top | cropTop: 0.08 |
| woodcutters_camp | Bleeding at top | cropTop: 0.10 |

---

## Industrial Age Issues

### Critical
| Building | Current Position | Issue | Fix |
|----------|-----------------|-------|-----|
| castle | row 0, col 0 | Brownstone apartments | Use row 0, col 3 |
| bunker | row 4, col 0 | Victorian warehouse | Use row 0, col 3 |

### Severe Bleeding
| Building | Issue | Fix |
|----------|-------|-----|
| stable | row 3, col 1 - 25% bleed | cropTop: 0.25 or use row 5, col 1 |
| market | Still bleeding despite crop | Increase cropTop: 0.30 |
| oil_well | Bleeding | cropTop: 0.25 |
| woodcutters_camp | Severe bleeding | cropTop: 0.25 |

### Minor Bleeding
| Building | Fix |
|----------|-----|
| library | Verify cropTop: 0.15 |
| university | cropTop: 0.15 |
| mine | cropTop: 0.15, cropBottom: 0.10 |
| siege_factory | cropTop: 0.15 |
| tower | cropTop: 0.10 |
| temple | cropTop: 0.08 |
| fortress | cropTop: 0.15 |
| granary | cropTop: 0.08 |

---

## Modern Age Issues

### Critical (Wrong Sprite Type)
| Building | Current Position | Issue | Fix |
|----------|-----------------|-------|-----|
| auto_plant | row 4, col 2 | Shows SCHOOL! | Verify position or use IsoCity industrial |
| barracks | row 0, col 3 | Fire station | Use row 1, col 3 (police compound) |
| tower | row 2, col 1 | Water tower | Use row 1, col 3 |
| temple | row 0, col 4 | HOSPITAL! | Use row 5, col 3 (classical) |
| oil_well | row 2, col 4 | Space launch pad! | Use row 4, col 4 (refinery) |

### Missing Overrides
| Building | Issue | Fix |
|----------|-------|-----|
| dock | No override, uses refinery | Add row 4, col 1 |
| woodcutters_camp | Shows only tree | Add row 4, col 1 (warehouse) |
| stockade | Shows skyscraper | Add row 1, col 3 |
| castle | Shows office tower | Add row 1, col 3 |

---

## IsoCity Alternative Recommendations

### Currently Using IsoCity (Correct)
- **farm**: All ages use IsoCity farm sheet - CORRECT
- **airbase**: Modern uses IsoCity airport - CORRECT

### Could Benefit from IsoCity
| Building | Age | IsoCity Asset | Reason |
|----------|-----|---------------|--------|
| stable (modern) | Modern | warehouse.webp | Better logistics building |
| factory (industrial/modern) | Ind/Mod | industrial.webp | Cleaner factory design |
| auto_plant (modern) | Modern | industrial.webp | Fix broken school sprite |

---

## Priority Actions

### P0 - Critical Fixes
1. Fix modern auto_plant showing school
2. Fix enlightenment smelter showing cottage
3. Fix enlightenment fort showing bridge
4. Fix modern temple showing hospital
5. Fix modern oil_well showing rocket

### P1 - Wrong Building Types
6. Fix classical/medieval defensive buildings (fort, fortress, stockade)
7. Fix classical lumber_mill/siege_factory showing industrial sprites
8. Fix enlightenment/modern barracks showing wrong buildings
9. Fix medieval lumber_mill showing watchtower

### P2 - Cropping/Bleeding
10. Add AGE_BUILDING_CROP entries for all bleeding issues
11. Update industrial stable/market cropTop values
12. Add medieval/enlightenment crop adjustments

### P3 - Consistency
13. Differentiate fortress from barracks in medieval
14. Add missing modern overrides (dock, woodcutters_camp, stockade, castle)
15. Consider IsoCity alternatives for polish
