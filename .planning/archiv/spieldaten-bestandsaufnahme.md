# Bestandsaufnahme Spieldaten — Data.p4k, Patch 4.9 (29.07.2026)

> Erzeugt von [`scripts/probes/census.mjs`](../scripts/probes/census.mjs). Ein erneuter Lauf
> nach einem Spiel-Patch liefert andere Zahlen — die hier sind der Stand vom 29.07.2026.
> Dies ist die Grundlage für die geplante Spieldaten-Datenbank: sie beziffert, was
> überhaupt vorhanden ist, bevor irgendetwas gebaut wird.

Records gesamt: **116512** · EntityClassDefinition: **29108** · davon SCItem: **23729**
Flach-Scan: 3.5s, Lesefehler: 0

## 1) Record-Typen (Top 40 von 604)

| Typ | Anzahl |
|---|---|
| EntityClassDefinition | 29108 |
| DialogueContext | 23775 |
| Tag | 18845 |
| DialogueExternalSource | 5292 |
| BuildingBlocks_Canvas | 3825 |
| DialogueContent | 2775 |
| MissionBrokerEntry | 2584 |
| TintPaletteTree | 2341 |
| MissionLocationTemplate | 2103 |
| StarMapObject | 2067 |
| RaSTaRLibraryElement | 1788 |
| CommunicationName | 1689 |
| CraftingBlueprintRecord | 1598 |
| SCItemManufacturer | 1151 |
| Conversation | 1128 |
| CommsNotification | 792 |
| BuildingBlocks_Style | 690 |
| InventoryContainer | 582 |
| HarvestablePreset | 571 |
| Character | 503 |
| ContractTemplate | 488 |
| Camera | 416 |
| SReputationStandingParams | 380 |
| DialogueContextBank | 363 |
| HintTriggerData | 348 |
| SLoadoutAssortment | 321 |
| HintUIData | 321 |
| WeaponProceduralClip | 285 |
| MineableComposition | 249 |
| UseChannelArchetype | 240 |
| AmmoParams | 239 |
| LootArchetype | 233 |
| MissionItem | 225 |
| InteriorMapSectionDefinition | 221 |
| GPUParticleAudio | 210 |
| ResourceType | 207 |
| TacticalQuery | 206 |
| JournalEntry | 199 |
| AIWaveCollection | 184 |
| MegaMap | 162 |

## 2) Entitäten nach Kategorie

| Kategorie | Records |
|---|---|
| Items / SCItem | 24308 |
| Schiffe & Fahrzeuge | 1058 |
| Actors / NPCs | 2317 |
| Crafting-Blueprints | 1598 |
| Missionen | 2954 |
| Shops / Läden | 1910 |
| Loot | 960 |

## 3) SCItem-Unterkategorien (Top 30)

| Pfad unter scitem/ | Items |
|---|---|
| characters/human | 4824 |
| carryables/tractorbeamonly | 1368 |
| ships/thrusters | 1366 |
| ships/paints | 1092 |
| carryables/1h | 909 |
| ships/weapons | 632 |
| ships/seataccess | 586 |
| human/un | 487 |
| ships/controller | 444 |
| ships/seat | 411 |
| weapons/fps_weapons | 411 |
| ships/fueltanks | 325 |
| human/lt | 294 |
| ships/displays | 292 |
| carryables/2h | 287 |
| ships/module | 284 |
| ships/turret | 274 |
| shopdisplays/vehicle | 225 |
| ships/armor | 209 |
| ships/dashboard | 191 |
| ships/countermeasures | 188 |
| ships/dockingport | 163 |
| ships/utility | 158 |
| ships/cargogrid | 154 |
| ships/missile_racks | 152 |
| ships/fuel_intakes | 151 |
| prop/buildingsets | 146 |
| ships/weapon_mounts | 127 |
| weapons/weapon_modifier | 121 |
| atc/atc_docking | 119 |

## 4) Komponententypen über alle SCItems — die Extraktor-Liste

**2110 verschiedene Komponententypen.** Abdeckung = Anteil der 23729 Items, die sie tragen.

| # | Komponente | Items | Abdeckung | Felder (Auszug) |
|---|---|---|---|---|
| 1 | `AttachDef` | 21989 | 92.7 % | Type, SubType, Size, Grade, Manufacturer, inheritParentManufacturer, Tags, RequiredTags |
| 2 | `attachToTileItemPort` | 21989 | 92.7 % |  |
| 3 | `entityAttachParams` | 21989 | 92.7 % |  |
| 4 | `audioAttachParams` | 21989 | 92.7 % | audioTrigger |
| 5 | `ModelTag` | 21873 | 92.2 % | __ref, name, fileName |
| 6 | `cacheResources` | 21873 | 92.2 % |  |
| 7 | `meshsetup` | 21873 | 92.2 % |  |
| 8 | `Geometry` | 21873 | 92.2 % | Tags, path, SimulationGeometry, RootRecord, ChildPath, SwizzleOverride, Slot, MaterialAttachments |
| 9 | `Material` | 21873 | 92.2 % | Tags, path, RootRecord, ChildPath, SwizzleOverride, __ref, name, fileName |
| 10 | `rootOverridePaint` | 21873 | 92.2 % |  |
| 11 | `inheritModelTagFromHost` | 21873 | 92.2 % |  |
| 12 | `inheritMaterialFromSpawnHost` | 21873 | 92.2 % |  |
| 13 | `PhysType` | 20082 | 84.6 % | Mass, compoundingAllowed, breakableParams, gameCollisionClass, spawnBoxScale, maxLoggedCollisions, Damping, DampingZeroG |
| 14 | `Interactable` | 15947 | 67.2 % | menuTitle, Name, RoomTag, UsableTag, LinkingTag, DisplayName, DisplayType, GenericCursor |
| 15 | `abilityLocks` | 13564 | 57.2 % |  |
| 16 | `masterController` | 12865 | 54.2 % | Name, Klass |
| 17 | `Ports` | 12865 | 54.2 % | Name, DisplayName, PortTags, RequiredPortTags, Flags, PropagateOnAttachTagsToHierarchy, MinSize, MaxSize |
| 18 | `PortFlags` | 12865 | 54.2 % |  |
| 19 | `PortTags` | 12865 | 54.2 % |  |
| 20 | `RequiredItemTags` | 12865 | 54.2 % |  |
| 21 | `InternalResourceLinks` | 12865 | 54.2 % |  |
| 22 | `InternalHardpointLinks` | 12865 | 54.2 % |  |
| 23 | `LinkAllItemsToResourceNetwork` | 12865 | 54.2 % |  |
| 24 | `cheatResourceNetworkUpdate` | 12865 | 54.2 % |  |
| 25 | `doorsIgnorePower` | 12865 | 54.2 % |  |
| 26 | `destroyEntitiesOnItemportList` | 12865 | 54.2 % |  |
| 27 | `resourceNetworkPowerPools` | 12865 | 54.2 % | maxDefaultDistribution, itemType, poolSize |
| 28 | `StateTypes` | 11992 | 50.5 % | StateTypeName, bindingsMethod, __weak, __instance, asopReset, networkAuthority, StateName, EnterStateEffectGroup |
| 29 | `inspectInteraction` | 10915 | 46.0 % | __weak, __instance |
| 30 | `flipInteraction` | 10915 | 46.0 % |  |
| 31 | `vehicleItemPortInteractionLinks` | 9592 | 40.4 % | __weak, __instance, itemPort, targetInteraction, sourceInteraction |
| 32 | `linkPlugs` | 9592 | 40.4 % | __ref, name, fileName |
| 33 | `Display` | 9421 | 39.7 % |  |
| 34 | `displayName` | 9421 | 39.7 % |  |
| 35 | `displayType` | 9421 | 39.7 % |  |
| 36 | `displayThumbnail` | 9421 | 39.7 % |  |
| 37 | `allowTryOn` | 9421 | 39.7 % |  |
| 38 | `allowQuickBuy` | 9421 | 39.7 % |  |
| 39 | `tryOnInteractionText` | 9421 | 39.7 % |  |
| 40 | `defaultAttachToPortName` | 9421 | 39.7 % |  |
| 41 | `interactionPointTemplate` | 9421 | 39.7 % | __ref, name, fileName |
| 42 | `disabledLoadoutInteractions` | 9421 | 39.7 % |  |
| 43 | `tutorialParams` | 9421 | 39.7 % |  |
| 44 | `interactionPoints` | 9421 | 39.7 % | __weak, __instance |
| 45 | `entityEffects` | 9223 | 38.9 % | particleEffects, enabled, allowMultipleTags, name, soundEffects, audioEnvironmentEffects, lightEffects, uiOwnerEffects |
| 46 | `staticValues` | 9223 | 38.9 % | parameterName, value |
| 47 | `staticColors` | 9223 | 38.9 % | __ref, name, fileName, r, g, b, parameterName |
| 48 | `tagsToEnableOnLoad` | 9223 | 38.9 % | __ref, name, fileName |
| 49 | `triggersToEnableOnLoad` | 9223 | 38.9 % |  |
| 50 | `turnedOnByDefault` | 8939 | 37.7 % |  |
| 51 | `forceOn` | 8939 | 37.7 % |  |
| 52 | `asopSpawnState` | 8939 | 37.7 % |  |
| 53 | `throttleParams` | 8939 | 37.7 % | default, defaultFull, min, max, scalingMinimum |
| 54 | `masterModeExclusionsOverride` | 8939 | 37.7 % |  |
| 55 | `views` | 6977 | 29.4 % | __ref, name, fileName |
| 56 | `tagActions` | 6965 | 29.4 % |  |
| 57 | `allowDeadOrUnconscious` | 6954 | 29.3 % |  |
| 58 | `enslavementAnimationDatabase` | 6708 | 28.3 % |  |
| 59 | `placeInteraction` | 6700 | 28.2 % | __weak, __instance |
| 60 | `carryInteraction` | 6696 | 28.2 % | __weak, __instance |
| 61 | `dropInteraction` | 6696 | 28.2 % | __weak, __instance |
| 62 | `equipToItemportInteraction` | 6696 | 28.2 % | __weak, __instance |
| 63 | `offHandEquipToItemportInteraction` | 6696 | 28.2 % | __weak, __instance |
| 64 | `storeInteraction` | 6696 | 28.2 % | __weak, __instance |
| 65 | `offHandStoreInteraction` | 6696 | 28.2 % | __weak, __instance |
| 66 | `holdReadyInteraction` | 6696 | 28.2 % | __weak, __instance |
| 67 | `equipWearableInteraction` | 6696 | 28.2 % | __weak, __instance |
| 68 | `swapAttachmentsInteraction` | 6696 | 28.2 % | __weak, __instance |
| 69 | `attachToHeldItemInteraction` | 6696 | 28.2 % | __weak, __instance |
| 70 | `interactionMetadata` | 6696 | 28.2 % | __ref, name, fileName |
| 71 | `carryableStatesParams` | 6696 | 28.2 % | __weak, __instance, heldReadyState, equippedWornState, hangingOnOutfitHangerState, settledState, carriedState, equippedToSuitState |
| 72 | `interactionPointToMoveOnEquip` | 6696 | 28.2 % | __weak, __instance |
| 73 | `interactionPointOffsets` | 6696 | 28.2 % | x, y, z |
| 74 | `gripData` | 6696 | 28.2 % | gripOverrideUsingLOS, carryStyleID, canBeUsedBy, handMode, gripAction, gripID, optionalHelper, offHandGrip |
| 75 | `carryableTasks` | 6696 | 28.2 % | fragmentId, fragTag, bForceExactPositioning, __weak, __instance |
| 76 | `throwableParams` | 6696 | 28.2 % | reticle, mode, x, y, z, faceUpWhenSettled, allowHologramTiltRotation, audioTrigger |
| 77 | `equipWearableParams` | 6696 | 28.2 % | itemPort |
| 78 | `ikInteractionsRecord` | 6696 | 28.2 % | __ref, name, fileName |
| 79 | `carryableSequences` | 6696 | 28.2 % | sequenceAction, carryableSequence, __ref, name, fileName, __weak, __instance |
| 80 | `canBeCarriedInProne` | 6696 | 28.2 % |  |
| 81 | `disableRotation` | 6696 | 28.2 % |  |
| 82 | `description` | 6597 | 27.8 % |  |
| 83 | `dataType` | 6590 | 27.8 % |  |
| 84 | `rangeMin` | 6590 | 27.8 % |  |
| 85 | `rangeMax` | 6590 | 27.8 % |  |
| 86 | `labelAttachOffset` | 6590 | 27.8 % | x, y, z |
| 87 | `queryOffset` | 6590 | 27.8 % | x, y, z |
| 88 | `labelScale` | 6590 | 27.8 % | x, y, z |
| 89 | `labelMovementType` | 6590 | 27.8 % |  |
| 90 | `visibleThroughWalls` | 6590 | 27.8 % |  |
| 91 | `labelZOrientationOffset` | 6590 | 27.8 % |  |
| 92 | `title1` | 6590 | 27.8 % |  |
| 93 | `title2` | 6590 | 27.8 % |  |
| 94 | `subtitle1` | 6590 | 27.8 % |  |
| 95 | `subtitle2` | 6590 | 27.8 % |  |
| 96 | `scaleCapDistance` | 6590 | 27.8 % |  |
| 97 | `AnimationDatabase` | 6488 | 27.3 % |  |
| 98 | `AnimationController` | 6488 | 27.3 % |  |
| 99 | `Tags` | 6488 | 27.3 % |  |
| 100 | `ScopeContexts` | 6488 | 27.3 % | scopeContext, type |
| 101 | `AnimationJointControls` | 6488 | 27.3 % | name, minimum, maximum, defaultValue, timeRange, type, __weak, __instance |
| 102 | `AnimationControlActorIKs` | 6488 | 27.3 % | limb, bone, blendTime, alignEndEffector |
| 103 | `AnimationTasks` | 6488 | 27.3 % | taskName, animationName, layerId, looping, playbackSpeed, blendIn, transitionType, normalizedStartTime |
| 104 | `defaultAnimation` | 6488 | 27.3 % | taskName, animationName, layerId, looping, playbackSpeed, blendIn, transitionType, normalizedStartTime |
| 105 | `specializedData` | 6402 | 27.0 % | fragmentTag |
| 106 | `archetype` | 6379 | 26.9 % | __ref, name, fileName |
| 107 | `fragmentTag` | 6379 | 26.9 % |  |
| 108 | `useSlots` | 6379 | 26.9 % | name, available, conditionList, triggerInteractionOnSlottedUsables, stance, isEnabled, isAvailableOnlyForRouting, isAvailableWhenHoldingTheUsable |
| 109 | `alignmentSlots` | 6379 | 26.9 % | id, name, available, canPlayerUse, __weak, __instance, fragmentTag, slottedFragmentTag |
| 110 | `exclusivityGroups` | 6379 | 26.9 % | __weak, __instance |
| 111 | `freeItemPortsForDirectInteraction` | 6379 | 26.9 % |  |
| 112 | `slottingSetups` | 6379 | 26.9 % | name, __weak, __instance, fragmentTagsForSlot, itemPort, alignmentSlot, routingElement |
| 113 | `usableSequencerTasks` | 6379 | 26.9 % | loadoutId, matchHierarchy, shouldDestroyAttachedEntitiesBeforeAssigningNewLoadout, itemPortTag, useReservedContents, contentType, duration, amountToAdd |
| 114 | `isExterior` | 6379 | 26.9 % |  |
| 115 | `lowEnergyThreshold` | 6379 | 26.9 % |  |
| 116 | `highEnergyThreshold` | 6379 | 26.9 % |  |
| 117 | `sequencerTasks` | 6329 | 26.7 % | name, useChannelName, __ref, fileName, userOnChannel, damageMapPath, playerUsablePort, selectionType |
| 118 | `Health` | 6306 | 26.6 % |  |
| 119 | `DamageCap` | 6306 | 26.6 % |  |
| 120 | `DamageResistances` | 6306 | 26.6 % | IgnoreMeleeDamage, Multiplier, Threshold, DamageCap, DamageCapLimit |
| 121 | `hitManipulationParams` | 6306 | 26.6 % | damageMultiplier |
| 122 | `InitialDamage` | 6306 | 26.6 % | RandomSeed, damageMacro, HealthFraction, x, y, z, MaxDamageRatio, MinHitCount |
| 123 | `SerializedDamageMapPath` | 6306 | 26.6 % |  |
| 124 | `ClientOnly` | 6306 | 26.6 % |  |
| 125 | `UnlockInteractionsOnDeath` | 6306 | 26.6 % |  |
| 126 | `PushDamageUpPartsHeirarchyWhenDead` | 6306 | 26.6 % |  |
| 127 | `DetachFromItemPortOnDeath` | 6306 | 26.6 % |  |
| 128 | `DetachFromEntityOnDeath` | 6306 | 26.6 % |  |
| 129 | `DestroySelfOnDeath` | 6306 | 26.6 % |  |
| 130 | `DestroyChildrenOnDeath` | 6306 | 26.6 % |  |
| 131 | `PropagateExplosionDamageToChildren` | 6306 | 26.6 % |  |
| 132 | `UseDirtShaderForDamage` | 6306 | 26.6 % |  |
| 133 | `UpdateObservableStatus` | 6306 | 26.6 % |  |
| 134 | `HealthLevelStates` | 6306 | 26.6 % | geometryTag, effectTrigger, effectTag, __ref, name, fileName |
| 135 | `DestroyedGeometryTag` | 6306 | 26.6 % |  |
| 136 | `ExplodedGeometryTag` | 6306 | 26.6 % |  |
| 137 | `DebrisGeometryTag` | 6306 | 26.6 % |  |
| 138 | `ExplosionDelayTime` | 6306 | 26.6 % |  |
| 139 | `ExplosionRandomDelayRange` | 6306 | 26.6 % |  |
| 140 | `ExplosionBone` | 6306 | 26.6 % |  |
| 141 | `DeathExplosionParams` | 6306 | 26.6 % | friendlyFire, minRadius, maxRadius, soundRadius, minPhysRadius, maxPhysRadius, angle, angleVertical |
| 142 | `DeathGasComposition` | 6306 | 26.6 % | Gas, Mass, __ref, name, fileName |
| 143 | `InteractionLocks` | 6306 | 26.6 % | __weak, __instance, MinHealthRatio, MaxHealthRatio, Interaction |
| 144 | `IsSalvagable` | 6306 | 26.6 % |  |
| 145 | `IsRepairable` | 6306 | 26.6 % |  |
| 146 | `SalvageDamageModifier` | 6306 | 26.6 % |  |
| 147 | `MirrorSalvageHit` | 6306 | 26.6 % |  |
| 148 | `DisableMaterialDamage` | 6306 | 26.6 % |  |
| 149 | `maelstromEvents` | 6306 | 26.6 % |  |
| 150 | `alwaysPropagateHitToParent` | 6306 | 26.6 % |  |
| 151 | `duplicateHitToParent` | 6306 | 26.6 % |  |
| 152 | `sendOnDestructionEventToMasterRootContainer` | 6306 | 26.6 % |  |
| 153 | `applyExplosionFalloffFromOrigin` | 6306 | 26.6 % |  |
| 154 | `loadout` | 4798 | 20.2 % | WearRange, DirtRange, SkipInventoryItemsOnMissionEntities, itemPortName, entityClassName, entityClassReference, inventoryContainer, loadout |
| 155 | `Type` | 4362 | 18.4 % | HairTag, maskFacialHair |
| 156 | `OverlayTags` | 4338 | 18.3 % | __ref, name, fileName |
| 157 | `HiddenParts` | 4338 | 18.3 % | PortName |
| 158 | `Chunks` | 4338 | 18.3 % | MeshChunk, Layer, HideInFirstPerson |
| 159 | `FoleyDef` | 4338 | 18.3 % | __ref, name, fileName |
| 160 | `FoleyDefNLPC` | 4338 | 18.3 % | __ref, name, fileName |
| 161 | `FootstepDef` | 4338 | 18.3 % | __ref, name, fileName |
| 162 | `FootstepDefNLPC` | 4338 | 18.3 % | __ref, name, fileName |
| 163 | `DressFragmentTags` | 4338 | 18.3 % |  |
| 164 | `TemperatureResistance` | 4338 | 18.3 % | MinResistance, MaxResistance |
| 165 | `RadiationResistance` | 4338 | 18.3 % | MaximumRadiationCapacity, RadiationDissipationRate |
| 166 | `Flight` | 4338 | 18.3 % | gForceResistance |
| 167 | `AbilityLocks` | 4338 | 18.3 % |  |
| 168 | `stopInspectInteraction` | 4219 | 17.8 % | __weak, __instance |
| 169 | `inspectAnimations` | 4219 | 17.8 % | interaction, fragmentId, tagId |
| 170 | `inspectRotateScaleX` | 4219 | 17.8 % |  |
| 171 | `inspectRotateScaleY` | 4219 | 17.8 % |  |
| 172 | `inspectRotateLimitsX` | 4219 | 17.8 % | x, y |
| 173 | `inspectRotateLimitsY` | 4219 | 17.8 % | x, y |
| 174 | `firstSelect` | 4219 | 17.8 % | firstSelectMode, itemTag, __ref, name, fileName |
| 175 | `filterParams` | 4213 | 17.8 % | filterModifier, showInUI, value |
| 176 | `isResourceNetworked` | 4162 | 17.5 % |  |
| 177 | `isRelay` | 4162 | 17.5 % |  |
| 178 | `isConnectedToRoom` | 4162 | 17.5 % |  |
| 179 | `wirelessConnection` | 4162 | 17.5 % |  |
| 180 | `states` | 4162 | 17.5 % | name, resource, binaryEvaluation, nominalSignature, decayRate, functionalityCurve, start, modifier |
| 181 | `controlParameters` | 4162 | 17.5 % |  |
| 182 | `controlBlocks` | 4162 | 17.5 % |  |
| 183 | `defaultPriority` | 4162 | 17.5 % |  |
| 184 | `functionalityModifiers` | 4162 | 17.5 % |  |
| 185 | `powerPlantOverride` | 4162 | 17.5 % |  |
| 186 | `selfRepair` | 4162 | 17.5 % | maxRepairCount, timeToRepair, healthRatio |
| 187 | `repairRestoreRatio` | 4162 | 17.5 % |  |
| 188 | `sequences` | 4159 | 17.5 % | name, interaction, postDelay, haltOnFailure, __weak, __instance, task |
| 189 | `resetSequence` | 4159 | 17.5 % | __weak, __instance |
| 190 | `audioParams` | 4068 | 17.1 % | visorAudioAvailable, rtpc, audioTrigger, __ref, name, fileName |
| 191 | `audioControllerEntityType` | 3694 | 15.6 % |  |
| 192 | `randomSeedCount` | 3694 | 15.6 % |  |
| 193 | `fullLODDistance` | 3694 | 15.6 % |  |
| 194 | `fullToLowLODDistance` | 3694 | 15.6 % |  |
| 195 | `offToLowLODDistance` | 3694 | 15.6 % |  |
| 196 | `offLODDistance` | 3694 | 15.6 % |  |
| 197 | `occlusionAttenuationScaler` | 3694 | 15.6 % |  |
| 198 | `tags` | 3694 | 15.6 % | __ref, name, fileName |
| 199 | `tagTriggers` | 3694 | 15.6 % | __ref, name, fileName, audioTrigger, boneName |
| 200 | `collisionTriggers` | 3512 | 14.8 % | audioTrigger, oneShotMinPlayTime, attachToObject |
| 201 | `slideStartTrigger` | 3512 | 14.8 % | audioTrigger |
| 202 | `slideStopTrigger` | 3512 | 14.8 % | audioTrigger |
| 203 | `rollStartTrigger` | 3512 | 14.8 % | audioTrigger |
| 204 | `rollStopTrigger` | 3512 | 14.8 % | audioTrigger |
| 205 | `movementStartTrigger` | 3512 | 14.8 % | audioTrigger |
| 206 | `movementStopTrigger` | 3512 | 14.8 % | audioTrigger |
| 207 | `pickupTrigger` | 3512 | 14.8 % | audioTrigger |
| 208 | `pickFromOwnerTrigger` | 3512 | 14.8 % | audioTrigger |
| 209 | `dropTrigger` | 3512 | 14.8 % | audioTrigger |
| 210 | `placeTrigger` | 3512 | 14.8 % | audioTrigger |
| 211 | `tractorBeamPickupTrigger` | 3512 | 14.8 % | audioTrigger |
| 212 | `tractorBeamDropTrigger` | 3512 | 14.8 % | audioTrigger |
| 213 | `detachBreakTrigger` | 3512 | 14.8 % | audioTrigger |
| 214 | `playerCausedDetachBreakTrigger` | 3512 | 14.8 % | audioTrigger |
| 215 | `rtpcSlideVelocity` | 3512 | 14.8 % | rtpc |
| 216 | `rtpcMassSelf` | 3512 | 14.8 % | rtpc |
| 217 | `rtpcMassOther` | 3512 | 14.8 % | rtpc |
| 218 | `rtpcDampening` | 3512 | 14.8 % | rtpc |
| 219 | `rtpcRollVelocity` | 3512 | 14.8 % | rtpc |
| 220 | `rtpcHealth` | 3512 | 14.8 % | rtpc |
| 221 | `rtpcMovement` | 3512 | 14.8 % | rtpc |
| 222 | `rtpcRotation` | 3512 | 14.8 % | rtpc |
| 223 | `rtpcTimeSinceLastOneshot` | 3512 | 14.8 % | rtpc |
| 224 | `rtpcMomentum` | 3512 | 14.8 % | rtpc |
| 225 | `rtpcCarried` | 3512 | 14.8 % | rtpc |
| 226 | `rtpcSize` | 3512 | 14.8 % | rtpc |
| 227 | `minimumImpulseContinuous` | 3512 | 14.8 % |  |
| 228 | `minimumImpulseTransient` | 3512 | 14.8 % |  |
| 229 | `minimumVelocityNoImpulse` | 3512 | 14.8 % |  |
| 230 | `slideThreshold` | 3512 | 14.8 % |  |
| 231 | `rollThreshold` | 3512 | 14.8 % |  |
| 232 | `momentumScale` | 3512 | 14.8 % |  |
| 233 | `rollVelocityScale` | 3512 | 14.8 % |  |
| 234 | `useAABBCentre` | 3512 | 14.8 % |  |
| 235 | `oneShotTag` | 3512 | 14.8 % | __ref, name, fileName |
| 236 | `oneShotCooldown` | 3512 | 14.8 % |  |
| 237 | `dragOnly` | 3512 | 14.8 % |  |
| 238 | `interactionDistance` | 3355 | 14.1 % |  |
| 239 | `bindingURLPrefix` | 3121 | 13.2 % |  |
| 240 | `radarProperties` | 3121 | 13.2 % | __ref, name, fileName, crossSectionParams, emissionModifierParams, deathParams, scanBounds, ignoreInteriorVsExteriorCheck |
| 241 | `scanCustomData` | 3121 | 13.2 % | __ref, name, fileName |
| 242 | `embeddedScanInfo` | 3121 | 13.2 % |  |
| 243 | `scanDisplayLayoutOverride` | 3121 | 13.2 % |  |
| 244 | `detectionTags` | 3121 | 13.2 % |  |
| 245 | `isOverridden` | 3121 | 13.2 % |  |
| 246 | `overriddenSize` | 3121 | 13.2 % | x, y, z |
| 247 | `enableDetectionOnItemPort` | 3121 | 13.2 % |  |
| 248 | `ignoreHighlightWhenDetectorInsideBounds` | 3121 | 13.2 % |  |
| 249 | `linkedObjectives` | 3121 | 13.2 % |  |
| 250 | `ignoreHighlightWhenNoLinkedOrActiveObjectives` | 3121 | 13.2 % |  |
| 251 | `priorityBoxoutTag` | 3121 | 13.2 % |  |
| 252 | `isObjectOfInterest` | 3121 | 13.2 % |  |
| 253 | `restrictedMoveViewPenalty` | 2991 | 12.6 % | __ref, name, fileName |
| 254 | `namespace` | 2919 | 12.3 % |  |
| 255 | `element` | 2913 | 12.3 % | __ref, name, fileName |
| 256 | `loadDistance` | 2913 | 12.3 % |  |
| 257 | `aspectRatio` | 2644 | 11.1 % |  |
| 258 | `targetRttSlot` | 2534 | 10.7 % |  |
| 259 | `startOpen` | 2464 | 10.4 % |  |
| 260 | `openInventoryInteraction` | 2437 | 10.3 % | __weak, __instance |
| 261 | `openLootingInteraction` | 2437 | 10.3 % | __weak, __instance |
| 262 | `containerParams` | 2437 | 10.3 % | __ref, name, fileName |
| 263 | `canAutoStoreRestrictedItems` | 2437 | 10.3 % |  |
| 264 | `linkToPort` | 2423 | 10.2 % |  |
| 265 | `areScreens3D` | 2395 | 10.1 % |  |
| 266 | `areSounds3D` | 2395 | 10.1 % |  |
| 267 | `hasActions` | 2395 | 10.1 % |  |
| 268 | `domainName` | 2395 | 10.1 % |  |
| 269 | `moviePath` | 2395 | 10.1 % |  |
| 270 | `variantName` | 2395 | 10.1 % |  |
| 271 | `invariantName` | 2395 | 10.1 % |  |
| 272 | `movieAutoPlay` | 2395 | 10.1 % |  |
| 273 | `loopMovie` | 2395 | 10.1 % |  |
| 274 | `forceFlashColourCorrection` | 2395 | 10.1 % |  |
| 275 | `ignoreTrackviewUnloadRequests` | 2395 | 10.1 % |  |
| 276 | `reflectLocalStateMachine` | 2395 | 10.1 % |  |
| 277 | `reflectLinkedStateMachines` | 2395 | 10.1 % |  |
| 278 | `visibiltyTags` | 2395 | 10.1 % | __ref, name, fileName |
| 279 | `graph` | 2395 | 10.1 % | __ref, name, fileName |
| 280 | `directRenderStage` | 2394 | 10.1 % |  |
| 281 | `compositeMaterialName` | 2394 | 10.1 % |  |
| 282 | `hideRenderNodeOnUnload` | 2394 | 10.1 % |  |
| 283 | `aspectRatioOverride` | 2394 | 10.1 % |  |
| 284 | `transparentListDepthBias` | 2394 | 10.1 % |  |
| 285 | `renderFlashBeforeCamera` | 2394 | 10.1 % |  |
| 286 | `fieldOfView` | 2394 | 10.1 % |  |
| 287 | `nearClip` | 2394 | 10.1 % |  |
| 288 | `farClip` | 2394 | 10.1 % |  |
| 289 | `renderType` | 2394 | 10.1 % |  |
| 290 | `fallbackTextureOnOnload` | 2394 | 10.1 % |  |
| 291 | `secondaryTarget` | 2394 | 10.1 % | aspectRatio, usePrimaryTargetBounds |
| 292 | `grabCameraControlParams` | 2394 | 10.1 % |  |
| 293 | `pickableCollision` | 2394 | 10.1 % |  |
| 294 | `pickableTag` | 2394 | 10.1 % |  |
| 295 | `runtimeImageSource` | 2394 | 10.1 % |  |
| 296 | `runtimeImageToAggregate` | 2394 | 10.1 % |  |
| 297 | `damageResistance` | 2313 | 9.7 % | __ref, name, fileName |
| 298 | `protectedBodyParts` | 2313 | 9.7 % | __ref, name, fileName |
| 299 | `wearMovementMultipliers` | 2313 | 9.7 % |  |
| 300 | `automaticFootstepDef` | 2313 | 9.7 % | __ref, name, fileName |
| 301 | `automaticFootstepDefNLPC` | 2313 | 9.7 % | __ref, name, fileName |
| 302 | `foleyDef` | 2313 | 9.7 % |  |
| 303 | `foleyDefNLPC` | 2313 | 9.7 % |  |
| 304 | `suitAmbienceDef` | 2313 | 9.7 % |  |
| 305 | `hitEffectLibName` | 2313 | 9.7 % |  |
| 306 | `remoteHitEffectLibName` | 2313 | 9.7 % |  |
| 307 | `actorAimLimits` | 2313 | 9.7 % | __ref, name, fileName |
| 308 | `signatureParams` | 2313 | 9.7 % | signatureType, signatureEmission, signatureReductionWeighted, signatureReductionAbsolute |
| 309 | `integrityMilestoneToBreak` | 2313 | 9.7 % |  |
| 310 | `offset` | 2275 | 9.6 % | x, y, z |
| 311 | `UIAudioDef` | 2268 | 9.6 % | __ref, name, fileName |
| 312 | `UIAudioManufacturers` | 2268 | 9.6 % | __ref, name, fileName |
| 313 | `useEntityClass` | 2268 | 9.6 % | __ref, name, fileName |
| 314 | `videoAudioPlayTrigger` | 2268 | 9.6 % | audioTrigger |
| 315 | `videoAudioStopTrigger` | 2268 | 9.6 % | audioTrigger |
| 316 | `videoAudioPauseTrigger` | 2268 | 9.6 % | audioTrigger |
| 317 | `videoAudioResumeTrigger` | 2268 | 9.6 % | audioTrigger |
| 318 | `dialogueContext` | 2268 | 9.6 % |  |
| 319 | `bypassRealisticMode` | 2268 | 9.6 % |  |
| 320 | `capacity` | 2262 | 9.5 % | centiSCU, standardCargoUnits, microSCU |
| 321 | `immutable` | 2178 | 9.2 % |  |
| 322 | `mutabilityLevel` | 2178 | 9.2 % |  |
| 323 | `generateRandomQuality` | 2178 | 9.2 % |  |
| 324 | `inclusiveResources` | 2178 | 9.2 % | __ref, name, fileName |
| 325 | `exclusiveResources` | 2178 | 9.2 % | __ref, name, fileName |
| 326 | `inclusiveGroups` | 2178 | 9.2 % | __ref, name, fileName |
| 327 | `exclusiveGroups` | 2178 | 9.2 % |  |
| 328 | `defaultComposition` | 2178 | 9.2 % | __ref, name, fileName, weight |
| 329 | `defaultCompositionFillFactor` | 2178 | 9.2 % |  |
| 330 | `hideFromUI` | 2178 | 9.2 % |  |
| 331 | `TraversingNodes` | 2041 | 8.6 % | name, id, RootVehicle, entityTraversingType, entityTag, itemPortName, linkedInteractionName, __ref |
| 332 | `TraversingTargets` | 2041 | 8.6 % | name, node |
| 333 | `EffectParams` | 1672 | 7.0 % | openTrigger, closeTrigger, openedTrigger, closedTrigger, openingTag, closingTag, overrideOpenTrigger, overrideCloseTrigger |
| 334 | `defaultStyle` | 1567 | 6.6 % | __ref, name, fileName |
| 335 | `layers` | 1565 | 6.6 % | layerName, renderTarget, __weak, __instance, name, defaultView |
| 336 | `enableFullScreenMouse` | 1565 | 6.6 % |  |
| 337 | `defaultPreviewScene` | 1565 | 6.6 % | renderLayer, cardsUseStageRadius |
| 338 | `allowTogglePowerObservedItems` | 1541 | 6.5 % |  |
| 339 | `operatorModeDefinitionsOverride` | 1541 | 6.5 % | __ref, name, fileName |
| 340 | `additionalItemControlPriorities` | 1541 | 6.5 % | itemType, priority |
| 341 | `show` | 1418 | 6.0 % |  |
| 342 | `gimbal` | 1365 | 5.8 % | isFlex, jointName, animation, angleMin, angleMax, speed, accel |
| 343 | `gimbalInteractionStateOverrides` | 1365 | 5.8 % | __weak, __instance, isFlex, jointName, animation, angleMin, angleMax, speed |
| 344 | `thrustCapacity` | 1365 | 5.8 % |  |
| 345 | `thrustCapacityNew` | 1365 | 5.8 % |  |
| 346 | `atmosphericEfficiencyCurve` | 1365 | 5.8 % | x, y, useLUT |
| 347 | `atmosphericEfficiencyRatioCurve` | 1365 | 5.8 % | x, y, useLUT |
| 348 | `maxSupportedAtmosphericEfficiency` | 1365 | 5.8 % |  |
| 349 | `shipIntegrityLossModifierCurve` | 1365 | 5.8 % | x, y, useLUT |
| 350 | `minHealthThrustMultiplier` | 1365 | 5.8 % |  |
| 351 | `fuelBurnRatePer10KNewton` | 1365 | 5.8 % |  |
| 352 | `fuelBurnRatePer10KNewtonRN` | 1365 | 5.8 % | standardResourceUnits, microResourceUnits |
| 353 | `thrusterType` | 1365 | 5.8 % |  |
| 354 | `onlyActiveInVTOL` | 1365 | 5.8 % |  |
| 355 | `nozzleAnimation` | 1365 | 5.8 % |  |
| 356 | `thrusterAnimDriver` | 1365 | 5.8 % |  |
| 357 | `thrusterStrengthSmoothing` | 1365 | 5.8 % |  |
| 358 | `toggleThrusterBackwash` | 1365 | 5.8 % |  |
| 359 | `automateBackwashSize` | 1365 | 5.8 % |  |
| 360 | `thrusterBackwashSize` | 1365 | 5.8 % | x, y, z |
| 361 | `thrusterBackwashMaxSpeed` | 1365 | 5.8 % |  |
| 362 | `thrusterBackwashMaxDensity` | 1365 | 5.8 % |  |
| 363 | `thrusterBackwashMaxResistance` | 1365 | 5.8 % |  |
| 364 | `thrusterBackwashAfterburnerMultiplier` | 1365 | 5.8 % |  |
| 365 | `signatureEmitterParams` | 1365 | 5.8 % | activeSignature, fullDecayTime |
| 366 | `noFuelThresholdRatio` | 1365 | 5.8 % |  |
| 367 | `thrusterTrailAngles` | 1365 | 5.8 % | minimum, maximum |
| 368 | `shockDiamonds` | 1365 | 5.8 % | alphaMultiplier, splineOffset, minimum, maximum, afterburnAlphaMultiplier, afterburnSplineOffset |
| 369 | `manufacturerAudioSwitch` | 1354 | 5.7 % | switch |
| 370 | `sizeAudioSwitch` | 1354 | 5.7 % | switch |
| 371 | `classAudioSwitch` | 1354 | 5.7 % | switch |
| 372 | `thrusterPanningAudioSwitch` | 1354 | 5.7 % | switch |
| 373 | `properties` | 1354 | 5.7 % | audioSize, techLevel, civilianLow, civilianMed, civilianHigh, industrial, military, racing |
| 374 | `spoolStart` | 1354 | 5.7 % | audioTrigger |
| 375 | `spoolStop` | 1354 | 5.7 % | audioTrigger |
| 376 | `spoolUpStarted` | 1354 | 5.7 % | audioTrigger |
| 377 | `spoolUpCompleted` | 1354 | 5.7 % | audioTrigger |
| 378 | `spoolDownStarted` | 1354 | 5.7 % | audioTrigger |
| 379 | `spoolDownCompleted` | 1354 | 5.7 % | audioTrigger |
| 380 | `timeSinceLastOneshotAtSpoolBegin` | 1354 | 5.7 % | rtpc |
| 381 | `timeSinceLastOneshotAtSpoolEnd` | 1354 | 5.7 % | rtpc |
| 382 | `spoolTime` | 1354 | 5.7 % |  |
| 383 | `spoolRTPC` | 1354 | 5.7 % | rtpc |
| 384 | `avoidSpoolOneshotsOnLowRankShips` | 1354 | 5.7 % |  |
| 385 | `thrusterLoopStart` | 1354 | 5.7 % | audioTrigger |
| 386 | `thrusterLoopStop` | 1354 | 5.7 % | audioTrigger |
| 387 | `afterburnerEnabledLoopStart` | 1354 | 5.7 % | audioTrigger |
| 388 | `afterburnerEnabledLoopStop` | 1354 | 5.7 % | audioTrigger |
| 389 | `afterburnerEnabledOneShot` | 1354 | 5.7 % | audioTrigger |
| 390 | `timeSinceLastAfterburnerEnabledRtpc` | 1354 | 5.7 % | rtpc |
| 391 | `afterburnerDisabledOneShot` | 1354 | 5.7 % | audioTrigger |
| 392 | `timeSinceLastAfterburnerDisabledRtpc` | 1354 | 5.7 % | rtpc |
| 393 | `avoidAfterburnerOneShotsOnLowRankShips` | 1354 | 5.7 % |  |
| 394 | `thrusterOnOneShot` | 1354 | 5.7 % | audioTrigger |
| 395 | `timeSinceLastThrusterOnRtpc` | 1354 | 5.7 % | rtpc |
| 396 | `thrusterOffOneShot` | 1354 | 5.7 % | audioTrigger |
| 397 | `timeSinceLastThrusterOffRtpc` | 1354 | 5.7 % | rtpc |
| 398 | `thrusterFireStartedThreshold` | 1354 | 5.7 % |  |
| 399 | `avoidThrusterFireOneShotsOnLowRankShips` | 1354 | 5.7 % |  |
| 400 | `misfireLoopStart` | 1354 | 5.7 % | audioTrigger |
| 401 | `misfireLoopStop` | 1354 | 5.7 % | audioTrigger |
| 402 | `misfireOnOneshot` | 1354 | 5.7 % | audioTrigger |
| 403 | `timeSinceLastMisfireOnRtpc` | 1354 | 5.7 % | rtpc |
| 404 | `misfireOffOneshot` | 1354 | 5.7 % | audioTrigger |
| 405 | `timeSinceLastMisfireOffRtpc` | 1354 | 5.7 % | rtpc |
| 406 | `avoidMisfireOneShotsOnLowRankShips` | 1354 | 5.7 % |  |
| 407 | `thrustersOutputsToRtpcs` | 1354 | 5.7 % | thrusterOutput, calculateOnlyOnPlayerVehicle, behavior |
| 408 | `thrusterDegradationRtpc` | 1354 | 5.7 % | rtpc |
| 409 | `isMultiposition` | 1354 | 5.7 % |  |
| 410 | `boneName` | 1354 | 5.7 % |  |
| 411 | `offsetRotation` | 1354 | 5.7 % | x, y, z |
| 412 | `offsetTranslation` | 1354 | 5.7 % | x, y, z |
| 413 | `updateLocalPosition` | 1354 | 5.7 % |  |
| 414 | `vibrationModifier` | 1354 | 5.7 % |  |
| 415 | `motionToThrustCrossover` | 1354 | 5.7 % |  |
| 416 | `hudParamsOverride` | 1293 | 5.4 % |  |
| 417 | `reticleParams` | 1277 | 5.4 % | defaultReticle, adsReticle |
| 418 | `proceduralAnimationRecord` | 1275 | 5.4 % | __ref, name, fileName |
| 419 | `radius` | 1259 | 5.3 % |  |
| 420 | `DecayDelay` | 1232 | 5.2 % |  |
| 421 | `DecayRate` | 1232 | 5.2 % |  |
| 422 | `Maximum` | 1232 | 5.2 % |  |
| 423 | `WarningRatio` | 1232 | 5.2 % |  |
| 424 | `RecoveryRatio` | 1232 | 5.2 % |  |
| 425 | `PowerRatioAtMaxDistortion` | 1232 | 5.2 % |  |
| 426 | `PowerChangeOnlyAtMaxDistortion` | 1232 | 5.2 % |  |
| 427 | `initialLocalPlayerAccess` | 1230 | 5.2 % |  |
| 428 | `needsRootLocalPlayerAccess` | 1230 | 5.2 % |  |
| 429 | `maxOffsetTranslation` | 1230 | 5.2 % | x, y, z |
| 430 | `maxOffsetRotation` | 1230 | 5.2 % | x, y, z |
| 431 | `mainInteractions` | 1230 | 5.2 % | __weak, __instance |
| 432 | `mainInteractionAnimTarget` | 1230 | 5.2 % | helperName, x, y, z |
| 433 | `placeOutfitRules` | 1230 | 5.2 % | Type, SubType, Port, InteractionPoint, __weak, __instance |
| 434 | `takeExclussionRules` | 1230 | 5.2 % | __weak, __instance |
| 435 | `mainInteractionPoint` | 1230 | 5.2 % | __weak, __instance |
| 436 | `validTagsOnSwapOutfit` | 1230 | 5.2 % |  |
| 437 | `blockingTagsOnSwapOutfit` | 1230 | 5.2 % |  |
| 438 | `infiniteLootable` | 1230 | 5.2 % |  |
| 439 | `smartRefillAmmo` | 1230 | 5.2 % |  |
| 440 | `smartRefillGrenadesAndAmmo` | 1230 | 5.2 % |  |
| 441 | `fragmentTags` | 1230 | 5.2 % |  |
| 442 | `forceFirstSelect` | 1230 | 5.2 % |  |
| 443 | `lootInventoryParams` | 1230 | 5.2 % | lootOpenInventoryViewInteraction, lootOpenLootingViewInteraction, allowStorageInteractions, __weak, __instance |
| 444 | `itemPortRules` | 1230 | 5.2 % | __weak, __instance, x, y, z, extraFragTags, stateTypeName, stateName |
| 445 | `tagsOnAllItemPortsEmpty` | 1230 | 5.2 % |  |
| 446 | `placeIntoPortInteraction` | 1230 | 5.2 % | __weak, __instance |
| 447 | `bespokePlace` | 1230 | 5.2 % |  |
| 448 | `bespokePlaceTags` | 1230 | 5.2 % | __ref, name, fileName |
| 449 | `bespokeTake` | 1230 | 5.2 % |  |
| 450 | `bespokeTakeTags` | 1230 | 5.2 % | __ref, name, fileName |
| 451 | `exactPlaceIntoPort` | 1230 | 5.2 % | __weak, __instance |
| 452 | `outfitHangerGroups` | 1230 | 5.2 % | __weak, __instance, swapAllInteraction, equipAllInteraction |
| 453 | `coreInventoryItems` | 1230 | 5.2 % | entityClassName, amount |
| 454 | `StopDegradingIfDestroyed` | 1163 | 4.9 % |  |
| 455 | `accumulators` | 1163 | 4.9 % | InitialAccumulationRatio, AccumulateWhenUnstreamed, AccumulateOnlyAfterTractorBeam, AccumulateOnlyWhenAttached, StopAccumulationWhenAttached, AccumulationEventThreshold, PortTags, RequiredPortTags |
| 456 | `audioEnvironment` | 1163 | 4.9 % |  |
| 457 | `physicalOcclusionValueWhenClosed` | 1162 | 4.9 % |  |
| 458 | `physicalEncapsulationValue` | 1162 | 4.9 % |  |
| 459 | `idleState` | 1130 | 4.8 % | __weak, __instance |
| 460 | `activeState` | 1111 | 4.7 % |  |
| 461 | `UseAutoCloseDelay` | 1091 | 4.6 % |  |
| 462 | `AutoCloseDelay` | 1091 | 4.6 % |  |
| 463 | `DoorAnimationSpeed` | 1091 | 4.6 % |  |
| 464 | `BreachingDoorAnimationSpeed` | 1091 | 4.6 % |  |
| 465 | `BreachedDoorAnimationSpeed` | 1091 | 4.6 % |  |
| 466 | `BreachedDoorOpenAmount` | 1091 | 4.6 % |  |
| 467 | `IsOpened` | 1091 | 4.6 % |  |
| 468 | `IsLocked` | 1091 | 4.6 % |  |
| 469 | `IsIgnoredByDoorController` | 1091 | 4.6 % |  |
| 470 | `CollisionReaction` | 1091 | 4.6 % | CollisionReactionDirection |
| 471 | `FragName` | 1091 | 4.6 % |  |
| 472 | `AnimationParams` | 1091 | 4.6 % | DefaultAnimationDurationScale, SecondaryAnimationDurationScale, userAnimationParams, TransitionTag, OpenTag, CloseTag, useSyncedEnslavement, userAnimationDatabase |
| 473 | `OpenInteraction` | 1091 | 4.6 % | __weak, __instance |
| 474 | `SecondaryOpenInteraction` | 1091 | 4.6 % | __weak, __instance |
| 475 | `OpenFinishedInteraction` | 1091 | 4.6 % | __weak, __instance |
| 476 | `CloseInteraction` | 1091 | 4.6 % | __weak, __instance |
| 477 | `CloseFinishedInteraction` | 1091 | 4.6 % | __weak, __instance |
| 478 | `ToggleInteraction` | 1091 | 4.6 % | __weak, __instance |
| 479 | `LockInteraction` | 1091 | 4.6 % | __weak, __instance |
| 480 | `UnlockInteraction` | 1091 | 4.6 % | __weak, __instance |
| 481 | `OverrideOpenInteraction` | 1091 | 4.6 % | __weak, __instance |
| 482 | `OverrideCloseInteraction` | 1091 | 4.6 % | __weak, __instance |
| 483 | `OpenEffectGroup` | 1091 | 4.6 % |  |
| 484 | `CloseEffectGroup` | 1091 | 4.6 % |  |
| 485 | `OpenedEffectGroup` | 1091 | 4.6 % |  |
| 486 | `ClosedEffectGroup` | 1091 | 4.6 % |  |
| 487 | `OpeningEffectGroup` | 1091 | 4.6 % |  |
| 488 | `ClosingEffectGroup` | 1091 | 4.6 % |  |
| 489 | `OverrideOpenEffectGroup` | 1091 | 4.6 % |  |
| 490 | `OverrideCloseEffectGroup` | 1091 | 4.6 % |  |
| 491 | `OverrideOpenedEffectGroup` | 1091 | 4.6 % |  |
| 492 | `OverrideClosedEffectGroup` | 1091 | 4.6 % |  |
| 493 | `OverrideOpeningEffectGroup` | 1091 | 4.6 % |  |
| 494 | `OverrideClosingEffectGroup` | 1091 | 4.6 % |  |
| 495 | `LockedEffectGroup` | 1091 | 4.6 % |  |
| 496 | `UnlockedEffectGroup` | 1091 | 4.6 % |  |
| 497 | `DestructionBehavior` | 1091 | 4.6 % |  |
| 498 | `PortalMode` | 1091 | 4.6 % | PortalLookupMode, PortalName |
| 499 | `ConnectVisAreas` | 1091 | 4.6 % | x, y, z |
| 500 | `DoorTasks` | 1091 | 4.6 % | fragmentId, fragTag |
| 501 | `materialName` | 929 | 3.9 % |  |
| 502 | `strings` | 887 | 3.7 % | name, defaultValue, recordRefValue |
| 503 | `floats` | 879 | 3.7 % | name, defaultValue, value, minValue, maxValue, loopType, backToDefaultParams, waitTime |
| 504 | `ints` | 879 | 3.7 % | name, defaultValue, value |
| 505 | `AlwaysUseDefaultValues` | 875 | 3.7 % |  |
| 506 | `bools` | 875 | 3.7 % | name, defaultValue, value |
| 507 | `locStrings` | 875 | 3.7 % | name, defaultValue |
| 508 | `supplementaryFireTime` | 854 | 3.6 % |  |
| 509 | `fireSpinAnimationParams` | 854 | 3.6 % | activationMode, name, fragment, spinParam, spinUpTime, spinDownTime, maxActiveTime, activationCondition |
| 510 | `misfireParams` | 854 | 3.6 % |  |
| 511 | `ammoContainerRecord` | 843 | 3.6 % | __ref, name, fileName |
| 512 | `overrideEmValue` | 842 | 3.5 % |  |
| 513 | `distortionAffectsRoot` | 842 | 3.5 % |  |
| 514 | `secondaryAmmoContainers` | 841 | 3.5 % | __ref, name, fileName |
| 515 | `ShouldIgnorePrimaryAmmoContainer` | 841 | 3.5 % |  |
| 516 | `onAmmoEmptyParams` | 841 | 3.5 % |  |
| 517 | `geometryTags` | 841 | 3.5 % |  |
| 518 | `defaultAdsCameraOffset` | 841 | 3.5 % | x, y, z |
| 519 | `onAttachParams` | 841 | 3.5 % | itemPort, tag |
| 520 | `actorProceduralRecoilConfig` | 841 | 3.5 % | __ref, name, fileName |
| 521 | `weaponAIData` | 841 | 3.5 % | minimum, maximum, useLUT, maxShootingTime, idealCombatRange, maxFiringRange, CombatRangeCategory, baseAccuracy |
| 522 | `connectionParams` | 841 | 3.5 % | powerActiveCooldown, heatRateOnline, lockOnOnverheat, simplifiedHeatParams, fireRate, fireRateMultiplier, damageMultiplier, damageOverTimeMultiplier |
| 523 | `weaponRegenConsumerParams` | 841 | 3.5 % | initialRegenPerSec, requestedRegenPerSec, regenerationCooldown, regenerationCostPerBullet, requestedAmmoLoad, maxAmmoLoad, maxRegenPerSec |
| 524 | `fireOnAim` | 841 | 3.5 % |  |
| 525 | `scopeZoomCurve` | 841 | 3.5 % | useLUT |
| 526 | `aimAction` | 841 | 3.5 % | name, localisedName, tag, entityTag, uiBindingsTag, aiShootingMode, audioTrigger, selectableCondition |
| 527 | `fireActions` | 841 | 3.5 % | name, localisedName, tag, entityTag, uiBindingsTag, aiShootingMode, audioTrigger, selectableCondition |
| 528 | `audioReportEnvironmentParams` | 841 | 3.5 % | maxTriggers, wwiseEnvironmentName, audioTrigger, rtpc |
| 529 | `specialEffectsParams` | 841 | 3.5 % | helper, triggerTag, modifierSource, delay, scale, retriggerOnViewModeChange, isMuzzleFlash, allowConditionReEvaluation |
| 530 | `turnedOnEffects` | 841 | 3.5 % | path, helper, triggerTag, modifierSource, delay, scale, retriggerOnViewModeChange, isMuzzleFlash |
| 531 | `fireSpinAnimations` | 841 | 3.5 % | activationMode, name, fragment, spinParam, spinUpTime, spinDownTime, maxActiveTime, activationCondition |
| 532 | `aimableAnglesRecord` | 841 | 3.5 % | __ref, name, fileName |
| 533 | `gimbalModeModifierRecord` | 841 | 3.5 % | __ref, name, fileName |
| 534 | `arModifierRecord` | 841 | 3.5 % | __ref, name, fileName |
| 535 | `weaponDegradationModifier` | 841 | 3.5 % | fireRate, fireRateMultiplier, damageMultiplier, damageOverTimeMultiplier, projectileSpeedMultiplier, pellets, burstShots, ammoCost |
| 536 | `useAdsHelper` | 841 | 3.5 % |  |
| 537 | `isAllowedInGreenZones` | 841 | 3.5 % |  |
| 538 | `uncollapseOnTurnedOn` | 841 | 3.5 % |  |
| 539 | `allowFiringDuringFiremodeSwitch` | 841 | 3.5 % |  |
| 540 | `overrideDisplayStats` | 841 | 3.5 % |  |
| 541 | `ammoRepoolParams` | 841 | 3.5 % | bulletsPerSecond, unstowMagDuration, fullMagMergeDuration |
| 542 | `equipCategory` | 841 | 3.5 % |  |
| 543 | `labelRelativeProximityThreshold` | 821 | 3.5 % |  |
| 544 | `enabledForAI` | 816 | 3.4 % |  |
| 545 | `navLinks` | 816 | 3.4 % | linkValidForAgentType, linkingType, __weak, __instance, helperName, navlinkWidth, maxAllowedLinks, maxAllowedCrossLinks |
| 546 | `controller` | 816 | 3.4 % | zOffsetForRaycastCheck |
| 547 | `densityClassOverwrites` | 747 | 3.1 % |  |
| 548 | `intoxicationModifierRef` | 702 | 3.0 % | __ref, name, fileName |
| 549 | `LegacyThrustParams` | 701 | 3.0 % | MaxLinearVelocity, x, y, z, LinearAccelerationDecay, AngularAccelerationDecay, BoostScale |
| 550 | `DefaultThrustParams` | 701 | 3.0 % | MaxLinearVelocity, MaxLinearVelocityWithBoost, x, y, z, LinearAccelerationDecay, AngularAccelerationDecay, BoostScale |
| 551 | `OptionalThrustParams` | 701 | 3.0 % | __ref, name, fileName, MaxLinearVelocity, MaxLinearVelocityWithBoost, LinearMovementParams, AngularMovementParams, BoostScaleParam |
| 552 | `StartAudioTrigger` | 701 | 3.0 % | audioTrigger |
| 553 | `StopAudioTrigger` | 701 | 3.0 % | audioTrigger |
| 554 | `ThrusterEffect` | 701 | 3.0 % | path |
| 555 | `Thrusters` | 701 | 3.0 % | HelperName |
| 556 | `VFXThrusterThreshold` | 701 | 3.0 % |  |
| 557 | `SFXThrusterAngularThreshold` | 701 | 3.0 % |  |
| 558 | `SFXThrusterLinearThreshold` | 701 | 3.0 % |  |
| 559 | `fuelParams` | 701 | 3.0 % | __ref, name, fileName |
| 560 | `humanPassageADB` | 698 | 2.9 % |  |
| 561 | `gateways` | 698 | 2.9 % | name, idle, landed, docked, zeroG, landingGearDown, landingGearUp, inQuantum |
| 562 | `entrances` | 698 | 2.9 % | name, idle, landed, docked, zeroG, landingGearDown, landingGearUp, inQuantum |
| 563 | `passages` | 698 | 2.9 % | name, idle, landed, docked, zeroG, landingGearDown, landingGearUp, inQuantum |
| 564 | `arParams` | 690 | 2.9 % | showOnCenter, distancePositionUpdate, updateOrientationEveryFrame, silhouetteWithRack, reference, adjustmentMode, x, y |
| 565 | `bundle` | 686 | 2.9 % |  |
| 566 | `itemPortOverrides` | 686 | 2.9 % |  |
| 567 | `minimumBounds` | 680 | 2.9 % |  |
| 568 | `sortDistance` | 680 | 2.9 % |  |
| 569 | `fixedScaleMin` | 680 | 2.9 % |  |
| 570 | `fixedScaleMax` | 680 | 2.9 % |  |
| 571 | `cardStageRadius` | 680 | 2.9 % |  |
| 572 | `flattenBehavior` | 680 | 2.9 % |  |
| 573 | `interference` | 680 | 2.9 % |  |
| 574 | `animationParams` | 680 | 2.9 % | wakeUpDelayTime, sleepDelayTime, activateLensDelayTime, deactivateLensDelayTime, activateVisorDelayTime, deactivateVisorDelayTime, dashboardStartUseDelayTime, dashboardStopUseDelayTime |
| 575 | `localPlayerParams` | 678 | 2.9 % | path, r, g, b, diffuseMult, attenuationBulbSize, distance, fov |
| 576 | `otherParams` | 678 | 2.9 % | path, r, g, b, diffuseMult, attenuationBulbSize, distance, fov |
| 577 | `legacyParams` | 678 | 2.9 % | path, r, g, b, diffuseMult, attenuationBulbSize, distance, fov |
| 578 | `activationTag` | 678 | 2.9 % | __ref, name, fileName |
| 579 | `helperName` | 678 | 2.9 % |  |
| 580 | `useDirectionAsXYZRotation` | 678 | 2.9 % |  |
| 581 | `helperDirection` | 678 | 2.9 % | x, y, z |
| 582 | `helperOffset` | 678 | 2.9 % | x, y, z |
| 583 | `Light_On_SFX` | 678 | 2.9 % | audioTrigger |
| 584 | `Light_Off_SFX` | 678 | 2.9 % | audioTrigger |
| 585 | `EM_Signature_On` | 678 | 2.9 % |  |
| 586 | `IR_Signature_On` | 678 | 2.9 % |  |
| 587 | `dofActive` | 678 | 2.9 % |  |
| 588 | `dofMinZ` | 678 | 2.9 % |  |
| 589 | `dofBlurAmount` | 678 | 2.9 % |  |
| 590 | `dofMinZScale` | 678 | 2.9 % |  |
| 591 | `dofFocusMin` | 678 | 2.9 % |  |
| 592 | `dofFocusMax` | 678 | 2.9 % |  |
| 593 | `minFOV` | 678 | 2.9 % |  |
| 594 | `maxFOV` | 678 | 2.9 % |  |
| 595 | `motionModifier` | 678 | 2.9 % |  |
| 596 | `atmosphereCapacity` | 678 | 2.9 % |  |
| 597 | `punctureMaxArea` | 678 | 2.9 % |  |
| 598 | `punctureMaxNumber` | 678 | 2.9 % |  |
| 599 | `punctureVFX` | 678 | 2.9 % |  |
| 600 | `fStop` | 678 | 2.9 % |  |
| 601 | `focalDistance` | 678 | 2.9 % |  |
| 602 | `transparencyPostEffectsExclusionRegion` | 678 | 2.9 % |  |
| 603 | `enableMFDCasts` | 678 | 2.9 % |  |
| 604 | `actorLookLimits` | 678 | 2.9 % | __ref, name, fileName |
| 605 | `hasFirstPersonGeometry` | 678 | 2.9 % |  |
| 606 | `animateOnEquip` | 678 | 2.9 % |  |
| 607 | `animateOnEquipDelay` | 678 | 2.9 % |  |
| 608 | `disableBootup` | 678 | 2.9 % |  |
| 609 | `disableAutomaticEVAMask` | 678 | 2.9 % |  |
| 610 | `bootupMovie` | 678 | 2.9 % |  |
| 611 | `bootupText` | 678 | 2.9 % |  |
| 612 | `interactableParams` | 678 | 2.9 % |  |
| 613 | `visorOpenAudioRtpc` | 678 | 2.9 % | rtpc |
| 614 | `globalConstraint` | 677 | 2.9 % |  |
| 615 | `topConstraintOffset` | 677 | 2.9 % |  |
| 616 | `rightConstraintOffset` | 677 | 2.9 % |  |
| 617 | `bottomConstraintOffset` | 677 | 2.9 % |  |
| 618 | `leftConstraintOffset` | 677 | 2.9 % |  |
| 619 | `dashboardConfig` | 677 | 2.9 % | __ref, name, fileName |
| 620 | `roomType` | 668 | 2.8 % |  |
| 621 | `minimumVolumeStrength` | 668 | 2.8 % |  |
| 622 | `roomName` | 668 | 2.8 % |  |
| 623 | `interiorMapSection` | 668 | 2.8 % |  |
| 624 | `roomExtensions` | 668 | 2.8 % |  |
| 625 | `isPhysical` | 668 | 2.8 % |  |
| 626 | `defaultAreaBounds` | 667 | 2.8 % | x, y, z |
| 627 | `boundsOffset` | 667 | 2.8 % | x, y, z |
| 628 | `orientationMode` | 667 | 2.8 % |  |
| 629 | `enableConnectorBridging` | 667 | 2.8 % |  |
| 630 | `apertureAnimateTime` | 667 | 2.8 % |  |
| 631 | `audioSoundProofing` | 667 | 2.8 % |  |
| 632 | `enable` | 665 | 2.8 % |  |
| 633 | `surfaceParticleRtt` | 665 | 2.8 % | cameraFov, aspectRatio, path, sdfTexture |
| 634 | `customEmitters` | 665 | 2.8 % | path, linkedToSdf, minimum, maximum, fadeOutDuration |
| 635 | `wipeEffect` | 665 | 2.8 % | path |
| 636 | `enableCloudCondensation` | 665 | 2.8 % |  |
| 637 | `inactiveDuration` | 665 | 2.8 % |  |
| 638 | `maximumSpeed` | 665 | 2.8 % |  |
| 639 | `waterSprayHeightRange` | 665 | 2.8 % | minimum, maximum |
| 640 | `waterSprayBaseDensity` | 665 | 2.8 % |  |
| 641 | `acceleration` | 665 | 2.8 % | speedMultiplier, maximumInfluenceSpeed, minimum, maximum, x, y, z, maximumAcceleration |
| 642 | `occluderSettings` | 665 | 2.8 % | distanceToVisor, numberOfWaveSamples |
| 643 | `overrideControls` | 665 | 2.8 % | enabled, useFlatVisor, density, rainEnabled, snowEnabled |
| 644 | `renderNodeLoadoutEntries` | 665 | 2.8 % |  |
| 645 | `atmosphereType` | 665 | 2.8 % |  |
| 646 | `state` | 665 | 2.8 % | __ref, name, fileName |
| 647 | `atmosphericComposition` | 665 | 2.8 % | __ref, name, fileName, parts |
| 648 | `behavior` | 665 | 2.8 % | __ref, name, fileName |
| 649 | `lifeSupport` | 665 | 2.8 % |  |
| 650 | `targetPresets` | 650 | 2.7 % | name, optionalTarget, nextTarget, recursive |
| 651 | `onInteractionStateChangeTriggers` | 650 | 2.7 % | __weak, __instance, lockInteraction, enableEmitter, bApplyToAllChildren, stateTypeName, stateName, targetState |
| 652 | `onInteractionSuccessTriggers` | 650 | 2.7 % | __weak, __instance, damageAttachedItem, impulseStrength, enableDissolve, onlyAffectRendering, dissolveRange, secondsToChange |
| 653 | `onInteractionFailedTriggers` | 650 | 2.7 % |  |
| 654 | `availableOperatorModes` | 615 | 2.6 % | __ref, name, fileName |
| 655 | `Entries` | 595 | 2.5 % | __weak, __instance, GeometryTag, __ref, name, fileName, Interaction, Journal |
| 656 | `vehicleScopeContext` | 579 | 2.4 % |  |
| 657 | `ejection` | 575 | 2.4 % | maxLinearVelocity, maxLinearAcceleration, maxAngularVelocity, maxAngularAcceleration, ejectionLoopTime, ejectionInteraction, x, y |
| 658 | `seatType` | 575 | 2.4 % |  |
| 659 | `controlTemplate` | 575 | 2.4 % |  |
| 660 | `transitionTemplate` | 575 | 2.4 % |  |
| 661 | `minYaw` | 575 | 2.4 % |  |
| 662 | `maxYaw` | 575 | 2.4 % |  |
| 663 | `minPitch` | 575 | 2.4 % |  |
| 664 | `maxPitch` | 575 | 2.4 % |  |
| 665 | `setYawPitchLimits` | 575 | 2.4 % |  |
| 666 | `userAnimationDatabase` | 575 | 2.4 % |  |
| 667 | `userScopeContext` | 575 | 2.4 % |  |
| 668 | `userSyncedScopeContext` | 575 | 2.4 % |  |
| 669 | `dashboardAnimationDatabase` | 575 | 2.4 % |  |
| 670 | `dashboardScopeContext` | 575 | 2.4 % |  |
| 671 | `vehicleFragmentOverride` | 575 | 2.4 % |  |
| 672 | `useSyncedEnslavement` | 575 | 2.4 % |  |
| 673 | `useAnimationBasedTransition` | 575 | 2.4 % |  |
| 674 | `supportPlayerAnimatedActions` | 575 | 2.4 % |  |
| 675 | `allowRelaxedPose` | 575 | 2.4 % |  |
| 676 | `keepUserControlContextActive` | 575 | 2.4 % |  |
| 677 | `actorAttachment` | 575 | 2.4 % | type, boneName, stance |
| 678 | `QTViews` | 575 | 2.4 % |  |
| 679 | `landingView` | 575 | 2.4 % | __ref, name, fileName |
| 680 | `adsOverwriteRecord` | 575 | 2.4 % | __ref, name, fileName |
| 681 | `adsCameraOverride` | 575 | 2.4 % | __ref, name, fileName, x, y, z |
| 682 | `seatFOV` | 575 | 2.4 % | __ref, name, fileName |
| 683 | `usableInteraction` | 575 | 2.4 % | __weak, __instance |
| 684 | `enterDefaultModeInteraction` | 575 | 2.4 % | __weak, __instance |
| 685 | `enterScanModeInteraction` | 575 | 2.4 % | __weak, __instance |
| 686 | `enterQuantumModeInteraction` | 575 | 2.4 % | __weak, __instance |
| 687 | `fpHeadAdjustmentRecord` | 575 | 2.4 % | __ref, name, fileName |
| 688 | `lookAheadOverwriteRecord` | 575 | 2.4 % | __ref, name, fileName |
| 689 | `gforceHeadBobOverwriteRecord` | 575 | 2.4 % | __ref, name, fileName |
| 690 | `gforceCameraEffectsOverwriteRecord` | 575 | 2.4 % |  |
| 691 | `headTrackingPositionLimitOverwriteRecord` | 575 | 2.4 % | __ref, name, fileName |
| 692 | `armorMoveViewRestrictions` | 575 | 2.4 % | __ref, name, fileName |
| 693 | `userCDIKRecord` | 575 | 2.4 % | __ref, name, fileName |
| 694 | `enterAdsAudioTrigger` | 575 | 2.4 % | audioTrigger |
| 695 | `exitAdsAudioTrigger` | 575 | 2.4 % | audioTrigger |
| 696 | `definition` | 565 | 2.4 % | __ref, name, fileName |
| 697 | `canTogglePowerForObservedItems` | 565 | 2.4 % |  |
| 698 | `ignorePowerResults` | 565 | 2.4 % |  |
| 699 | `PowerOnline` | 565 | 2.4 % |  |
| 700 | `canToggleLightAmplification` | 565 | 2.4 % |  |
| 701 | `dashboardInteractions` | 565 | 2.4 % | flightReady, powerOn, powerOff, saveQuitInteraction, atcOpenDoorsInteraction, atcCloseDoorsInteraction, ejectCargo, hasSimpleStartupSequence |
| 702 | `seatInteractions` | 565 | 2.4 % | closeIP, openIP, __weak, __instance, ejectionIP, cycleHUDIP, exitIP |
| 703 | `powerInteractions` | 565 | 2.4 % | __weak, __instance, powerIP |
| 704 | `engineInteractions` | 565 | 2.4 % | engineIP, __weak, __instance |
| 705 | `systemInteractions` | 565 | 2.4 % | doorsIP, landingIP, cargoIP, __weak, __instance |
| 706 | `weaponInteractions` | 565 | 2.4 % | __weak, __instance, remoteCameraIP, weaponIP, turretIP |
| 707 | `consumableInteractions` | 565 | 2.4 % | consumableIP, __weak, __instance |
| 708 | `quantumInterdictionInteractions` | 565 | 2.4 % | quantumInterdictionIP, toggleJammingIP, __weak, __instance |
| 709 | `effects` | 565 | 2.4 % | usedEffectTag, __ref, name, fileName |
| 710 | `uiDescription` | 565 | 2.4 % | markerConfig, playCommsOnLens, showTargetOnLens, Name, GeomName, MaterialOverride, Template, Type |
| 711 | `MFDParams` | 565 | 2.4 % | setupEnabled, innerThoughtGeometryName, __weak, __instance, __ref, name, fileName, geometryName |
| 712 | `PhysicalScreenParams` | 565 | 2.4 % | geometryName, __ref, name, fileName, canvas |
| 713 | `onFootCameraView` | 564 | 2.4 % | __ref, name, fileName |
| 714 | `vehicleCameraView` | 564 | 2.4 % | __ref, name, fileName |
| 715 | `defaultCamDistance` | 564 | 2.4 % |  |
| 716 | `dashboardCanvasConfig` | 518 | 2.2 % | __ref, name, fileName |
| 717 | `enableInS42` | 518 | 2.2 % |  |
| 718 | `openInteraction` | 494 | 2.1 % | __weak, __instance |
| 719 | `onlyShowCursorWhenLockedByKiosk` | 489 | 2.1 % |  |
| 720 | `initialForceLookAtLerpTime` | 489 | 2.1 % |  |
| 721 | `defaultForceLookAtLerpTime` | 489 | 2.1 % |  |
| 722 | `forceLookAtDecayFactor` | 489 | 2.1 % |  |
| 723 | `forceLookAtIncreaseFactor` | 489 | 2.1 % |  |
| 724 | `forceLookAtThreshold` | 489 | 2.1 % |  |
| 725 | `FOVSpeedFactor` | 489 | 2.1 % |  |
| 726 | `FOVHaltDistanceMax` | 489 | 2.1 % |  |
| 727 | `FOVHaltDistanceMin` | 489 | 2.1 % |  |
| 728 | `FOVMax` | 489 | 2.1 % |  |
| 729 | `FOVMin` | 489 | 2.1 % |  |
| 730 | `lookInputFactor` | 489 | 2.1 % |  |
| 731 | `inActivityTimer` | 489 | 2.1 % |  |
| 732 | `autoCloseRadiusInNonFoucseMode` | 489 | 2.1 % |  |
| 733 | `blockLookInputs` | 489 | 2.1 % |  |
| 734 | `supportWalkToAlign` | 489 | 2.1 % |  |
| 735 | `attractTransitions` | 489 | 2.1 % | layerName, viewName |
| 736 | `openTransitions` | 489 | 2.1 % | layerName, viewName |
| 737 | `powerOffTransitions` | 489 | 2.1 % | layerName, viewName |
| 738 | `isAccessedFromVehicleSeat` | 489 | 2.1 % |  |
| 739 | `lookAtOffset` | 489 | 2.1 % | x, y, z |
| 740 | `preventForceReactions` | 489 | 2.1 % |  |
| 741 | `strength` | 487 | 2.1 % | value |
| 742 | `size` | 481 | 2.0 % | x, y, z |
| 743 | `igniteOnLoad` | 481 | 2.0 % |  |
| 744 | `shape` | 481 | 2.0 % | radius, falloffExponent |
| 745 | `initialAmmoCount` | 478 | 2.0 % |  |
| 746 | `maxAmmoCount` | 478 | 2.0 % |  |
| 747 | `maxRestockCount` | 478 | 2.0 % |  |
| 748 | `lowAmmoWarningPercentage` | 478 | 2.0 % |  |
| 749 | `ammoParamsRecord` | 478 | 2.0 % | __ref, name, fileName |
| 750 | `secondaryAmmoParamsRecord` | 478 | 2.0 % | __ref, name, fileName |
| 751 | `ammoContainerType` | 478 | 2.0 % |  |
| 752 | `despawnEmptyAmmoContainer` | 478 | 2.0 % |  |
| 753 | `allowAmmoRepool` | 478 | 2.0 % |  |
| 754 | `emptyGeometryTag` | 478 | 2.0 % |  |
| 755 | `ammoCountFragment` | 478 | 2.0 % | fragment, forceWeaponController |
| 756 | `ammoCountAnimationBlendTime` | 478 | 2.0 % |  |
| 757 | `hideAttachments` | 478 | 2.0 % | attachmentName, ammoThreshold, visible |
| 758 | `attachableEntities` | 478 | 2.0 % | sourcePort, targetPort, entityClassName |
| 759 | `enableField` | 460 | 1.9 % |  |
| 760 | `texture3D` | 460 | 1.9 % |  |
| 761 | `outerRadius` | 460 | 1.9 % |  |
| 762 | `falloff` | 460 | 1.9 % |  |
| 763 | `strengthMult` | 460 | 1.9 % |  |
| 764 | `posOffset` | 460 | 1.9 % | x, y, z |
| 765 | `rotOffset` | 460 | 1.9 % | x, y, z |
| 766 | `useTransformHelperFile` | 460 | 1.9 % |  |
| 767 | `matchSizeFromTexture` | 460 | 1.9 % |  |
| 768 | `mergeSDFs` | 460 | 1.9 % |  |
| 769 | `mergedVoxelCountScaleFrac` | 460 | 1.9 % |  |
| 770 | `mergedPaddingFrac` | 460 | 1.9 % | x, y, z |
| 771 | `debugDraw` | 460 | 1.9 % | drawBoundingBox, drawAdvanced, densityPerMeter, density, minMagnitude, maxMagnitude, arrowScale, renderThreshold |
| 772 | `globalTargetingParams` | 460 | 1.9 % | __ref, name, fileName |
| 773 | `maxPinnedTargets` | 460 | 1.9 % |  |
| 774 | `outerAngle` | 460 | 1.9 % |  |
| 775 | `innerAngle` | 460 | 1.9 % |  |
| 776 | `autoSelectionTimer` | 460 | 1.9 % |  |
| 777 | `targetableItemTypesRecord` | 460 | 1.9 % | __ref, name, fileName |
| 778 | `cycleFriendlyTargetInteraction` | 460 | 1.9 % | __weak, __instance |
| 779 | `cycleHostileTargetInteraction` | 460 | 1.9 % | __weak, __instance |
| 780 | `cycleAllTargetsInteraction` | 460 | 1.9 % | __weak, __instance |
| 781 | `cyclePinnedTargetInteraction` | 460 | 1.9 % | __weak, __instance |
| 782 | `cycleSubTargetInteraction` | 460 | 1.9 % | __weak, __instance |
| 783 | `beginSubTargetingInteraction` | 460 | 1.9 % | __weak, __instance |
| 784 | `endSubTargetingInteraction` | 460 | 1.9 % | __weak, __instance |
| 785 | `pinTargetInteraction` | 460 | 1.9 % | __weak, __instance |
| 786 | `unpinTargetInteraction` | 460 | 1.9 % | __weak, __instance |
| 787 | `arMarkersParams` | 460 | 1.9 % | lockedRatioClose |
| 788 | `arTrailParams` | 460 | 1.9 % | quatLifetime, quatDistance, maxFadeDistance, minFadeDistance, startDistance |
| 789 | `occlusionParams` | 460 | 1.9 % | supportRayPushInAmount, increasedPrecisionAngularSizeLimit, maximumRayLength |
| 790 | `rotationStyle` | 450 | 1.9 % |  |
| 791 | `recenterTask` | 450 | 1.9 % |  |
| 792 | `resumeControlTask` | 450 | 1.9 % |  |
| 793 | `setMovementTagTasks` | 450 | 1.9 % | __ref, name, fileName |
| 794 | `setLimiterTagTasks` | 450 | 1.9 % | limiterTag, __ref, name, fileName |
| 795 | `toggleTurretPositionInteraction` | 450 | 1.9 % | __weak, __instance |
| 796 | `defaultMovementTag` | 450 | 1.9 % | __ref, name, fileName |
| 797 | `movementTagNames` | 450 | 1.9 % | __ref, name, fileName, movementName |
| 798 | `movementList` | 450 | 1.9 % | movementTag, jointName, slavedOnly, restrictTargetAngles, pitchAxis, rollAxis, enableIKRotationalSpeed, rtpc |
| 799 | `weaponModifierInterpolationFactor` | 450 | 1.9 % |  |
| 800 | `recenterIfUnused` | 450 | 1.9 % |  |
| 801 | `gyroStabilize` | 450 | 1.9 % | defaultGyroStabilize, __weak, __instance, toggleGyroStabilizeModeInteraction |
| 802 | `remoteTurret` | 450 | 1.9 % | __ref, name, fileName, __weak, __instance, turretOnlyUsableInRemoteCamera |
| 803 | `healthModifierRecord` | 450 | 1.9 % |  |
| 804 | `turretSensitivity` | 450 | 1.9 % | increaseSensitivityInteraction, decreaseSensitivityInteraction, resetSensitivityInteraction, sensitivityDelta, __weak, __instance |
| 805 | `switchToCachedOperatorModeOnExit` | 450 | 1.9 % |  |
| 806 | `operatorModeOnEnter` | 450 | 1.9 % |  |
| 807 | `jointConvergence` | 450 | 1.9 % |  |
| 808 | `audioRtpcHealthRatio` | 450 | 1.9 % | rtpc |
| 809 | `autoDeployHelmetTargetingMode` | 450 | 1.9 % |  |
| 810 | `gunFireSafety` | 450 | 1.9 % | selfHitCheckType, fireConsentAngleCheckType, fireConsentAngleDeg |
| 811 | `forceAlignSubgimbalsDuringPipAiming` | 450 | 1.9 % |  |
| 812 | `cachePoolSize` | 449 | 1.9 % |  |
| 813 | `immediateTransforms` | 449 | 1.9 % |  |
| 814 | `helper` | 436 | 1.8 % |  |
| 815 | `modifier` | 436 | 1.8 % | fireRate, fireRateMultiplier, damageMultiplier, damageOverTimeMultiplier, projectileSpeedMultiplier, pellets, burstShots, ammoCost |
| 816 | `tag` | 436 | 1.8 % | __ref, name, fileName |
| 817 | `uiReticleIndex` | 436 | 1.8 % |  |
| 818 | `zeroingParams` | 436 | 1.8 % | defaultRange, maxRange, rangeIncrement, autoZeroingTime |
| 819 | `adsCameraOffset` | 436 | 1.8 % | x, y, z |
| 820 | `aimHelperYOffset` | 436 | 1.8 % |  |
| 821 | `adsNearClipPlaneMultiplier` | 436 | 1.8 % |  |
| 822 | `barrelEffectsStrength` | 436 | 1.8 % |  |
| 823 | `userRTPCs` | 436 | 1.8 % | userRTPCName, userRTPCValue, userRTPCResetValue |
| 824 | `fireEffects` | 436 | 1.8 % | path, helper, triggerTag, modifierSource, delay, scale, retriggerOnViewModeChange, isMuzzleFlash |
| 825 | `beamEffect` | 436 | 1.8 % |  |
| 826 | `scopeAttachmentParams` | 436 | 1.8 % | scopeType, audioTrigger, activateByDefault |
| 827 | `mannequinTag` | 436 | 1.8 % | tag |
| 828 | `activateOnAttach` | 436 | 1.8 % |  |
| 829 | `ignoreWear` | 436 | 1.8 % |  |
| 830 | `forceIronSightSetup` | 436 | 1.8 % |  |
| 831 | `audioTriggerName` | 434 | 1.8 % |  |
| 832 | `matFxTriggerName` | 434 | 1.8 % |  |
| 833 | `canBeUsedForTakeDown` | 434 | 1.8 % |  |
| 834 | `canBlock` | 434 | 1.8 % |  |
| 835 | `canBeUsedInProne` | 434 | 1.8 % |  |
| 836 | `canDodge` | 434 | 1.8 % |  |
| 837 | `preventMeleeMode` | 434 | 1.8 % |  |
| 838 | `stanceTransitionMeleeDelay` | 434 | 1.8 % |  |
| 839 | `meleeCombatConfig` | 434 | 1.8 % | __ref, name, fileName |
| 840 | `itemLocId` | 426 | 1.8 % |  |
| 841 | `maxWindowLength` | 426 | 1.8 % |  |
| 842 | `minWindowLength` | 426 | 1.8 % |  |
| 843 | `triggerConditions` | 426 | 1.8 % | degradation, damage, heat, distortion, __weak, __instance, functionalityMin, minTimeForTrigger |
| 844 | `misfireLevels` | 426 | 1.8 % |  |
| 845 | `misfires` | 426 | 1.8 % | effectTrigger, effectTag, explosionChance, explosionCountdown, degradationAdditionalRollsFactor, healthCancelRatio, __weak, __instance |
| 846 | `fuelFlowLoopStartAudioTrigger` | 360 | 1.5 % | audioTrigger |
| 847 | `fuelFlowLoopStopAudioTrigger` | 360 | 1.5 % | audioTrigger |
| 848 | `hydrogenMaxFlowMultiplier` | 358 | 1.5 % |  |
| 849 | `quantumMaxFlowMultiplier` | 358 | 1.5 % |  |
| 850 | `openState` | 358 | 1.5 % | __weak, __instance |
| 851 | `closedState` | 358 | 1.5 % | __weak, __instance |
| 852 | `pumpingState` | 358 | 1.5 % | __weak, __instance |
| 853 | `fuelFillDrainRateAudioRtpc` | 358 | 1.5 % | rtpc |
| 854 | `fuelFillLevelAudioRtpc` | 358 | 1.5 % | rtpc |
| 855 | `modifiers` | 328 | 1.4 % | modifierLifetime, targetItemType, targetSubType, fireActionIndex, setFireActionOnEnable, showInUI, laserInstability, optimalChargeWindowSizeModifier |
| 856 | `consumableVolume` | 308 | 1.3 % | microSCU |
| 857 | `defaultContents` | 308 | 1.3 % | __ref, name, fileName, ratio, consumableSubtype |
| 858 | `consumeInteraction` | 308 | 1.3 % | __weak, __instance |
| 859 | `consumedInteractionLocks` | 308 | 1.3 % | __weak, __instance |
| 860 | `consumeFragmentId` | 308 | 1.3 % |  |
| 861 | `containerTypeTag` | 308 | 1.3 % |  |
| 862 | `lidTypeTag` | 308 | 1.3 % |  |
| 863 | `utensilTypeTag` | 308 | 1.3 % |  |
| 864 | `oneShotConsume` | 308 | 1.3 % |  |
| 865 | `containerClosed` | 308 | 1.3 % |  |
| 866 | `canBeReclosed` | 308 | 1.3 % |  |
| 867 | `discardWhenConsumed` | 308 | 1.3 % |  |
| 868 | `isPropAnimated` | 308 | 1.3 % |  |
| 869 | `fillTargetHelper` | 308 | 1.3 % |  |
| 870 | `isTwoHandedConsume` | 308 | 1.3 % |  |
| 871 | `canConsumeInProne` | 308 | 1.3 % |  |
| 872 | `canSkipConsumeAnimLoop` | 308 | 1.3 % |  |
| 873 | `chunkNames` | 308 | 1.3 % |  |
| 874 | `helpersMap` | 308 | 1.3 % | gripIndex, lipHelperName, lidHelperName |
| 875 | `lidAttachment` | 308 | 1.3 % | path, attachmentBone |
| 876 | `utensilAttachment` | 308 | 1.3 % | path, attachmentBone |
| 877 | `foodAttachment` | 308 | 1.3 % | path, attachmentBone, attachToUtensil |
| 878 | `consumptionAudioSwitch` | 308 | 1.3 % | switch |
| 879 | `targetableSettings` | 297 | 1.3 % | __ref, name, fileName |
| 880 | `formations` | 297 | 1.3 % |  |
| 881 | `radialFormations` | 297 | 1.3 % |  |
| 882 | `radialFormationMovementUpdateThreshold` | 297 | 1.3 % |  |
| 883 | `radialFormationRotationUpdateThreshold` | 297 | 1.3 % |  |
| 884 | `lookAtType` | 292 | 1.2 % |  |
| 885 | `customLookAtBBs` | 292 | 1.2 % | x, y, z |
| 886 | `name` | 279 | 1.2 % |  |
| 887 | `adapters` | 262 | 1.1 % | minSpeedToBeIgnored, allowNavMeshCutout, optionalCostConfig, shapeConfig, __ref, name, fileName |
| 888 | `engineOnInteraction` | 252 | 1.1 % | __weak, __instance |
| 889 | `engineOffInteraction` | 252 | 1.1 % | __weak, __instance |
| 890 | `fullScreenLerpSpeed` | 251 | 1.1 % |  |
| 891 | `manualEnable` | 249 | 1.0 % |  |
| 892 | `rayGradientToTextureRatio` | 249 | 1.0 % |  |
| 893 | `rayExtensionFactor` | 249 | 1.0 % |  |
| 894 | `rayBaseOpacity` | 249 | 1.0 % |  |
| 895 | `rayFlickerOpacity` | 249 | 1.0 % |  |
| 896 | `rayPulseOpacity` | 249 | 1.0 % |  |
| 897 | `rayPulseTime` | 249 | 1.0 % |  |
| 898 | `rayMinSaturation` | 249 | 1.0 % |  |
| 899 | `rayMaxDistance` | 249 | 1.0 % |  |
| 900 | `rayOriginPoints` | 249 | 1.0 % | x, y, z |
| 901 | `enableCoupledModeInteraction` | 238 | 1.0 % | __weak, __instance |
| 902 | `disableCoupledModeInteraction` | 238 | 1.0 % | __weak, __instance |
| 903 | `enableGSafetyInteraction` | 238 | 1.0 % | __weak, __instance |
| 904 | `disableGSafetyInteraction` | 238 | 1.0 % | __weak, __instance |
| 905 | `enableESPInteraction` | 238 | 1.0 % | __weak, __instance |
| 906 | `disableESPInteraction` | 238 | 1.0 % | __weak, __instance |
| 907 | `enableCruiseControlInteraction` | 238 | 1.0 % | __weak, __instance |
| 908 | `disableCruiseControlInteraction` | 238 | 1.0 % | __weak, __instance |
| 909 | `enableVTOLInteraction` | 238 | 1.0 % | __weak, __instance |
| 910 | `disableVTOLInteraction` | 238 | 1.0 % | __weak, __instance |
| 911 | `enableProximityAssistInteraction` | 238 | 1.0 % | __weak, __instance |
| 912 | `disableProximityAssistInteraction` | 238 | 1.0 % | __weak, __instance |
| 913 | `deployTransformInteraction` | 238 | 1.0 % | __weak, __instance |
| 914 | `retractTransformInteraction` | 238 | 1.0 % | __weak, __instance |
| 915 | `cycleTransformInteraction` | 238 | 1.0 % | __weak, __instance |
| 916 | `fuelWarningDisplayTime` | 238 | 1.0 % |  |
| 917 | `passiveRefuelWarningThresholdPercentage` | 238 | 1.0 % |  |
| 918 | `hoverAnimPlaybackDuration` | 238 | 1.0 % |  |
| 919 | `hoverAnimPlayInLandingMode` | 238 | 1.0 % |  |
| 920 | `PowerOnEffectTag` | 238 | 1.0 % | __ref, name, fileName |
| 921 | `PowerOffEffectTag` | 238 | 1.0 % | __ref, name, fileName |
| 922 | `ShipRecall` | 238 | 1.0 % | HoverHeightAtDestination, ForwardOffset, ObstructionDetectionRange, DefaultPlatformDetectionRange, MinimumRecallDistance, BrakingDistanceOffset, __ref, name |
| 923 | `vehicleHudParamsOverride` | 238 | 1.0 % |  |
| 924 | `collisionDetection` | 238 | 1.0 % | collisionWarnSpeed, collisionWarnTime, collisionDangerCloseWarnTime |
| 925 | `speedProfile` | 238 | 1.0 % | x, y, z, linearVelocityLimiter, angularVelocityLimiter, activationTime, activationSpeedThreshold, activationMappedRayRatioThreshold |
| 926 | `accelerationData` | 238 | 1.0 % | linearAccelerationLimiterDefault, x, y, z, useLUT, angularAccelerationLimiter |
| 927 | `jerkProfile` | 238 | 1.0 % | x, y, z, linAccelerationDecay, angAccelerationDecay |
| 928 | `afterburnerNew` | 238 | 1.0 % | x, y, z, afterburnerAngCapacitorScaling, useLUT, afterburnerPreDelayTime, afterburnerRampUpTime, afterburnerRampDownTime |
| 929 | `ifcsCoreParams` | 238 | 1.0 % | bootWaitTime, spoolUpTime, stunThresholdGs |
| 930 | `atmosphericFlightParams` | 238 | 1.0 % | x, y, z, baseLiftCoefficient, useLUT, maxPitchLiftCoefficient, maxYawLiftCoefficient, baseDragCoefficient |
| 931 | `partDamageParams` | 238 | 1.0 % | useLUT, liftDecreaseCoefficient, dragDecreaseCoefficient, rollTorqueCoefficient, yawTorqueCoefficient |
| 932 | `damageHandling` | 238 | 1.0 % | x, y, z |
| 933 | `noFuelParams` | 238 | 1.0 % | linearAccelerationModifier, angularAccelerationModifier, angularVelocityModifier |
| 934 | `hudMessages` | 238 | 1.0 % | thrusterImbalance, coreOff, coreBooting, coreOnline, coreOnlineTime, thrustersOffline, flightTestActive, gForceResistance |
| 935 | `torqueDistanceThreshold` | 238 | 1.0 % |  |
| 936 | `thrusterTypesForAngularControl` | 238 | 1.0 % |  |
| 937 | `refreshCachesOnLandingMode` | 238 | 1.0 % |  |
| 938 | `authoredMotionLimits` | 238 | 1.0 % | x, y, z, linearMaxAcceleration |
| 939 | `formationModeParams` | 238 | 1.0 % | handoverTimeLinearControl, handoverTimeAngularControl |
| 940 | `modifiersLegacy` | 238 | 1.0 % | __ref, name, fileName |
| 941 | `noFuelParamsLegacy` | 238 | 1.0 % | linearAccelerationModifier, linearMaxSpeed, angularAccelerationModifier, angularVelocityModifier |
| 942 | `scmSpeed` | 238 | 1.0 % |  |
| 943 | `boostSpeedForward` | 238 | 1.0 % |  |
| 944 | `boostSpeedBackward` | 238 | 1.0 % |  |
| 945 | `maxSpeed` | 238 | 1.0 % |  |
| 946 | `maxAngularVelocity` | 238 | 1.0 % | x, y, z |
| 947 | `positiveLinearScale` | 238 | 1.0 % | x, y, z |
| 948 | `negativeLinearScale` | 238 | 1.0 % | x, y, z |
| 949 | `positiveAngularScale` | 238 | 1.0 % | x, y, z |
| 950 | `negativeAngularScale` | 238 | 1.0 % | x, y, z |
| 951 | `pitchYawLimiterType` | 238 | 1.0 % |  |
| 952 | `linearLimiterType` | 238 | 1.0 % |  |
| 953 | `linearAccelDecay` | 238 | 1.0 % |  |
| 954 | `angularAccelDecay` | 238 | 1.0 % |  |
| 955 | `afterburner` | 238 | 1.0 % | x, y, z, afterburnerAngCapacitorScaling, useLUT, afterburnerPreDelayTime, afterburnerRampUpTime, afterburnerRampDownTime |
| 956 | `torqueImbalanceMultiplier` | 238 | 1.0 % |  |
| 957 | `aeroSurfaces` | 238 | 1.0 % | name, x, y, z, flatPlateSurface, liftLevelFlight, peakLift, minLift |
| 958 | `liftMultiplier` | 238 | 1.0 % |  |
| 959 | `dragMultiplier` | 238 | 1.0 % |  |
| 960 | `turbulenceParams` | 238 | 1.0 % | windSpeedTurbulenceEnabled, windSpeedTurbulenceAmplitude, windSpeedMin, windSpeedMax, x, y, useLUT, cloudDensityTurbulenceAmplitude |
| 961 | `precisionMinDistance` | 238 | 1.0 % |  |
| 962 | `precisionMaxDistance` | 238 | 1.0 % |  |
| 963 | `maxSpeedPrecisionModeZeroProximityAssist` | 238 | 1.0 % |  |
| 964 | `maxSpeedPrecisionModeFullProximityAssist` | 238 | 1.0 % |  |
| 965 | `precisionLandingMultiplier` | 238 | 1.0 % |  |
| 966 | `precisionAccelCurve` | 238 | 1.0 % | x, y, useLUT |
| 967 | `scmMaxDragMultiplier` | 238 | 1.0 % |  |
| 968 | `thrusterImbalanceMessage` | 238 | 1.0 % |  |
| 969 | `faction` | 223 | 0.9 % | __ref, name, fileName |
| 970 | `producerConsumerParams` | 216 | 0.9 % | __ref, name, fileName, massExchange, isDependency |
| 971 | `autoAssignToRoom` | 216 | 0.9 % |  |
| 972 | `duration` | 216 | 0.9 % |  |
| 973 | `atmosphericPressureRange` | 216 | 0.9 % | minRange, maxRange |
| 974 | `tankComposition` | 216 | 0.9 % | __ref, name, fileName, Mass |
| 975 | `recipientIdealPressure` | 216 | 0.9 % |  |
| 976 | `recipientTransferRate` | 216 | 0.9 % |  |
| 977 | `selfRefillRate` | 216 | 0.9 % |  |
| 978 | `signalInfrared` | 209 | 0.9 % |  |
| 979 | `signalElectromagnetic` | 209 | 0.9 % |  |
| 980 | `signalCrossSection` | 209 | 0.9 % |  |
| 981 | `damageMultiplier` | 209 | 0.9 % | DamagePhysical, DamageEnergy, DamageDistortion, DamageThermal, DamageBiochemical, DamageStun |
| 982 | `armorPenetrationResistance` | 209 | 0.9 % | basePenetrationReduction, DamagePhysical, DamageEnergy, DamageDistortion, DamageThermal, DamageBiochemical, DamageStun |
| 983 | `armorDeflection` | 209 | 0.9 % | DamagePhysical, DamageEnergy, DamageDistortion, DamageThermal, DamageBiochemical, DamageStun, useLUT |
| 984 | `groupIndex` | 200 | 0.8 % |  |
| 985 | `dissolveDuration` | 188 | 0.8 % |  |
| 986 | `startDissolved` | 188 | 0.8 % |  |
| 987 | `spawnRules` | 183 | 0.8 % | timeBetweenSpawns, maxEntities, maxLifetimeEntities, dontOverlap, startTimerOnDone, timeAfterDestroy, spawnOnDone, timeAfterDrop |
| 988 | `despawnRules` | 183 | 0.8 % | despawnDelaySeconds, ruleDelaySeconds, distance |
| 989 | `spawnOnGameStart` | 183 | 0.8 % |  |
| 990 | `spawnWithinPlayerRange` | 183 | 0.8 % |  |
| 991 | `clampSpawnPlayerCheckTime` | 183 | 0.8 % |  |
| 992 | `portRefillData` | 183 | 0.8 % | __weak, __instance, Delay, useRandomSelection |
| 993 | `prerequisite` | 183 | 0.8 % | __weak, __instance |
| 994 | `entitiesToSpawn` | 183 | 0.8 % | __ref, name, fileName, x, y, z, attachToItemPort, itemPortName |
| 995 | `startActive` | 183 | 0.8 % |  |
| 996 | `onRequestSpawn` | 183 | 0.8 % |  |
| 997 | `spawnInMovement` | 183 | 0.8 % |  |
| 998 | `untrackOnDetach` | 183 | 0.8 % |  |
| 999 | `wildcardPorts` | 183 | 0.8 % |  |
| 1000 | `spawnerTasks` | 183 | 0.8 % | __ref, name, fileName, __weak, __instance, destroyAttachedEntityFirst, triggerAreas |
| 1001 | `launchDelay` | 162 | 0.7 % |  |
| 1002 | `detachVelocityRight` | 162 | 0.7 % |  |
| 1003 | `detachVelocityForward` | 162 | 0.7 % |  |
| 1004 | `detachVelocityUp` | 162 | 0.7 % |  |
| 1005 | `relativeDetachType` | 162 | 0.7 % |  |
| 1006 | `detachTrigger` | 162 | 0.7 % | __ref, name, fileName |
| 1007 | `rackTag` | 162 | 0.7 % |  |
| 1008 | `slotTags` | 162 | 0.7 % |  |
| 1009 | `fragReadyUp` | 162 | 0.7 % |  |
| 1010 | `fragStowAway` | 162 | 0.7 % |  |
| 1011 | `igniteOnPylon` | 162 | 0.7 % |  |
| 1012 | `IgnoreRootEntityGeometry` | 159 | 0.7 % |  |
| 1013 | `AllowRoomConnection` | 159 | 0.7 % |  |
| 1014 | `CaptureRadius` | 159 | 0.7 % |  |
| 1015 | `AutoRegisterWithATC` | 159 | 0.7 % |  |
| 1016 | `PreventsQuantumTravel` | 159 | 0.7 % |  |
| 1017 | `CanBeUsedBy` | 159 | 0.7 % |  |
| 1018 | `HUDDisplayName` | 159 | 0.7 % |  |
| 1019 | `ATCPriority` | 159 | 0.7 % |  |
| 1020 | `MaximumPreDockingAutopilotOffset` | 159 | 0.7 % |  |
| 1021 | `ExtendDockeeLandingGear` | 159 | 0.7 % |  |
| 1022 | `AutodockTiltOffset` | 159 | 0.7 % |  |
| 1023 | `autoDockingEngaged` | 159 | 0.7 % | audioTrigger |
| 1024 | `autoDockingDisengaged` | 159 | 0.7 % | audioTrigger |
| 1025 | `dockedPlayEvent` | 159 | 0.7 % | audioTrigger |
| 1026 | `undockInitiatedPlayEvent` | 159 | 0.7 % | audioTrigger |
| 1027 | `undockedPlayEvent` | 159 | 0.7 % | audioTrigger |
| 1028 | `undockedAndShipFreePlayEvent` | 159 | 0.7 % | audioTrigger |
| 1029 | `stateTagWhenAvailable` | 159 | 0.7 % | __ref, name, fileName |
| 1030 | `fuelPushRate` | 151 | 0.6 % |  |
| 1031 | `minimumRate` | 151 | 0.6 % |  |
| 1032 | `logoutInteractions` | 150 | 0.6 % | __weak, __instance, logoutInteractionPoint |
| 1033 | `predictionAccelerationFactor` | 145 | 0.6 % |  |
| 1034 | `StaggeredMode` | 144 | 0.6 % | DefaultStaggerFire, __weak, __instance |
| 1035 | `allowAllGunsGroup` | 144 | 0.6 % |  |
| 1036 | `allowGunGroupEditing` | 144 | 0.6 % |  |
| 1037 | `numberOfCustomizablePresets` | 144 | 0.6 % |  |
| 1038 | `enableWeaponsInteraction` | 144 | 0.6 % | __weak, __instance |
| 1039 | `disableWeaponsInteraction` | 144 | 0.6 % | __weak, __instance |
| 1040 | `fireWeaponGroupOneInteraction` | 144 | 0.6 % | __weak, __instance |
| 1041 | `fireWeaponGroupTwoInteraction` | 144 | 0.6 % | __weak, __instance |
| 1042 | `setLagPipsInteraction` | 144 | 0.6 % | __weak, __instance |
| 1043 | `setLeadPipsInteraction` | 144 | 0.6 % | __weak, __instance |
| 1044 | `setFixedGimbalInteraction` | 144 | 0.6 % | __weak, __instance |
| 1045 | `setFreeGimbalInteraction` | 144 | 0.6 % | __weak, __instance |
| 1046 | `setAutoGimbalInteraction` | 144 | 0.6 % | __weak, __instance |
| 1047 | `setSynchronousFireInteraction` | 144 | 0.6 % | __weak, __instance |
| 1048 | `FaceType` | 139 | 0.6 % |  |
| 1049 | `MaxReallocation` | 139 | 0.6 % |  |
| 1050 | `ReconfigurationCooldown` | 139 | 0.6 % |  |
| 1051 | `MaxElectricalChargeDamageRate` | 139 | 0.6 % |  |
| 1052 | `ShieldMaterial` | 139 | 0.6 % | path |
| 1053 | `regenerateEffectTag` | 139 | 0.6 % | __ref, name, fileName |
| 1054 | `shieldMeshDeprecated` | 139 | 0.6 % |  |
| 1055 | `shieldEffectType` | 139 | 0.6 % | __ref, name, fileName |
| 1056 | `itemsPerPage` | 138 | 0.6 % |  |
| 1057 | `array` | 138 | 0.6 % | intVar, floatVar, stringVar, locVar |
| 1058 | `alternateArray` | 138 | 0.6 % | name |
| 1059 | `objectContainer` | 129 | 0.5 % | path |
| 1060 | `vibrationRecord` | 125 | 0.5 % | __ref, name, fileName |
| 1061 | `normalizationMassOverride` | 125 | 0.5 % |  |
| 1062 | `hasLocalBounds` | 124 | 0.5 % |  |
| 1063 | `isDynamic` | 124 | 0.5 % |  |
| 1064 | `metadata` | 124 | 0.5 % | __ref, name, fileName, locationActionArea, permanent, showInAllZones, allowHierarchyDuplicates, saveToLocalPlayerObjectDataBank |
| 1065 | `isVehicleATC` | 124 | 0.5 % |  |
| 1066 | `timeToLand` | 124 | 0.5 % |  |
| 1067 | `timeToTakeOff` | 124 | 0.5 % |  |
| 1068 | `timeToUndock` | 124 | 0.5 % |  |
| 1069 | `distanceForManualComms` | 124 | 0.5 % |  |
| 1070 | `timeReservedToCancelDock` | 124 | 0.5 % |  |
| 1071 | `timeToTakeOffMin` | 124 | 0.5 % |  |
| 1072 | `timeToTakeOffMinOverrideByDockingClass` | 124 | 0.5 % | __ref, name, fileName, timeToTakeOffMin |
| 1073 | `stayTime` | 124 | 0.5 % |  |
| 1074 | `stayTimeMin` | 124 | 0.5 % |  |
| 1075 | `stayTimeMinOverrideByDockingClass` | 124 | 0.5 % | __ref, name, fileName, stayTimeMin |
| 1076 | `timeToRemoveIllegal` | 124 | 0.5 % |  |
| 1077 | `timeToNotifyQueue` | 124 | 0.5 % |  |
| 1078 | `timeToRepeatWaitingMessage` | 124 | 0.5 % |  |
| 1079 | `reservationTime` | 124 | 0.5 % |  |
| 1080 | `warningTimeBeforeDespawn` | 124 | 0.5 % |  |
| 1081 | `timeToDespawn` | 124 | 0.5 % |  |
| 1082 | `timeObstructionAllowed` | 124 | 0.5 % |  |
| 1083 | `timeToConsiderVehicleLeft` | 124 | 0.5 % |  |
| 1084 | `occupancyLimit` | 124 | 0.5 % |  |
| 1085 | `controlDoorsAutomatically` | 124 | 0.5 % |  |
| 1086 | `greetingMessage` | 124 | 0.5 % |  |
| 1087 | `greetingTime` | 124 | 0.5 % |  |
| 1088 | `timeToForgiveObstruction` | 124 | 0.5 % |  |
| 1089 | `timeAllowedToChangeShips` | 124 | 0.5 % |  |
| 1090 | `disableObstructionDespawn` | 124 | 0.5 % |  |
| 1091 | `maxCrimeStatAllowed` | 124 | 0.5 % |  |
| 1092 | `canDespawnShips` | 124 | 0.5 % |  |
| 1093 | `noStoreItemTags` | 124 | 0.5 % |  |
| 1094 | `clearTokensOnFarewell` | 124 | 0.5 % |  |
| 1095 | `perceptionTypes` | 123 | 0.5 % |  |
| 1096 | `defaultPerceptionStatus` | 123 | 0.5 % |  |
| 1097 | `excludedSenses` | 123 | 0.5 % |  |
| 1098 | `observablePoints` | 123 | 0.5 % | helperName, accuracyMultiplier, x, y, z |
| 1099 | `visionObservablePointOrdering` | 123 | 0.5 % |  |
| 1100 | `aimingObservablePointOrdering` | 123 | 0.5 % |  |
| 1101 | `observableExtensions` | 123 | 0.5 % |  |
| 1102 | `locations` | 122 | 0.5 % | name, attachMarker, boneName, useBoundingBoxCenter, x, y, z |
| 1103 | `powerParams` | 114 | 0.5 % | ignorePowerRequirements |
| 1104 | `uiSourceParams` | 114 | 0.5 % | UIModel, superGUID, overrideState, x, y, useLUT, __ref, name |
| 1105 | `lightParams` | 114 | 0.5 % | lightType, radius, bulbRadius, fov, maxDistance, maxFade, projectorTexture, x |
| 1106 | `screenStates` | 114 | 0.5 % | statename, state, stateWear, r, g, b, a, intensity |
| 1107 | `declutteringParams` | 110 | 0.5 % | __ref, name, fileName |
| 1108 | `galacticMapParams` | 108 | 0.5 % | displayRegionHeightPixels |
| 1109 | `starMapParams` | 108 | 0.5 % | __ref, name, fileName, state, displayRegionHeightPixels, __weak, __instance |
| 1110 | `interiorMapParams` | 108 | 0.5 % | showExterior, immediateZoneHostOnly, loadUnstreamedZoneHostAssets, x, y, z, sectionLabels, roomLabels |
| 1111 | `radarMapParams` | 108 | 0.5 % |  |
| 1112 | `displayParams` | 108 | 0.5 % | radius, newRadarRadius, x, y, z |
| 1113 | `startEnabled` | 108 | 0.5 % |  |
| 1114 | `frameType` | 108 | 0.5 % |  |
| 1115 | `viewDistance` | 108 | 0.5 % |  |
| 1116 | `viewAngle` | 108 | 0.5 % |  |
| 1117 | `displayMaterialPath` | 108 | 0.5 % |  |
| 1118 | `mapBindingsNamespace` | 108 | 0.5 % |  |
| 1119 | `linkedContractApp` | 108 | 0.5 % | __ref, name, fileName |
| 1120 | `contactGroups` | 107 | 0.5 % | __ref, name, fileName |
| 1121 | `signatureDetection` | 107 | 0.5 % | sensitivity, deltaSignatureSensitivity, piercing, deltaSignaturePierce, permitPassiveDetection, permitActiveDetection |
| 1122 | `scanTags` | 107 | 0.5 % |  |
| 1123 | `pingProperties` | 107 | 0.5 % | cooldownTime |
| 1124 | `sensitivityModifiers` | 107 | 0.5 % | sensitivityAddition |
| 1125 | `aiProperties` | 107 | 0.5 % | forceActiveWhenAIControlled, allowPingWave |
| 1126 | `deltaSignatureSpike` | 107 | 0.5 % | operationType, spikeValue |
| 1127 | `sharedParams` | 107 | 0.5 % | __ref, name, fileName |
| 1128 | `sharedExperimentalParams` | 107 | 0.5 % | __ref |
| 1129 | `forceActiveAIControlled` | 107 | 0.5 % |  |
| 1130 | `aimAssist` | 107 | 0.5 % | distanceMinAssignment, distanceMaxAssignment, outsideRangeBufferDistance |
| 1131 | `angularVelocity` | 105 | 0.4 % | x, y, z |
| 1132 | `stopRotationOnCollision` | 105 | 0.4 % |  |
| 1133 | `rotateAroundCenterOfMass` | 105 | 0.4 % |  |
| 1134 | `rotationSpeedMassFactor` | 105 | 0.4 % |  |
| 1135 | `variationParams` | 105 | 0.4 % | x, y, z, rotationSpeedVariationFactor, randomizeStartAngle |
| 1136 | `oscillationParams` | 105 | 0.4 % |  |
| 1137 | `enableRuntimeParameterUpdates` | 105 | 0.4 % |  |
| 1138 | `ignoreAreas` | 105 | 0.4 % |  |
| 1139 | `activationInteraction` | 99 | 0.4 % | __weak, __instance |
| 1140 | `deactivationInteraction` | 99 | 0.4 % | __weak, __instance |
| 1141 | `activationMethod` | 90 | 0.4 % |  |
| 1142 | `charges` | 90 | 0.4 % |  |
| 1143 | `canInterrupt` | 90 | 0.4 % |  |
| 1144 | `isInterruptible` | 90 | 0.4 % |  |
| 1145 | `icon` | 90 | 0.4 % |  |
| 1146 | `bindingsPrefix` | 86 | 0.4 % |  |
| 1147 | `fullScreenFOVScale` | 85 | 0.4 % |  |
| 1148 | `finalForceLookAtLerpTime` | 85 | 0.4 % |  |
| 1149 | `fullScreenRadarProcBreathingSetup` | 85 | 0.4 % | __ref, name, fileName |
| 1150 | `wantedLevelHostility` | 84 | 0.4 % | wantedLevel, comparison |
| 1151 | `globalParams` | 83 | 0.3 % | __ref, name, fileName |
| 1152 | `exitInteraction` | 83 | 0.3 % | __weak, __instance |
| 1153 | `grips` | 83 | 0.3 % | gripName, canBeUsedBy, handMode, gripID, optionalHelper, gripShape, dimension, wristRotation |
| 1154 | `IntroFragmentId` | 83 | 0.3 % |  |
| 1155 | `IntroFragTag` | 83 | 0.3 % |  |
| 1156 | `OutroFragmentId` | 83 | 0.3 % |  |
| 1157 | `OutroFragTag` | 83 | 0.3 % |  |
| 1158 | `gatewaySize` | 82 | 0.3 % |  |
| 1159 | `instance` | 82 | 0.3 % | __ref, name, fileName |
| 1160 | `isHolographic` | 80 | 0.3 % |  |
| 1161 | `defaultMasterMode` | 78 | 0.3 % |  |
| 1162 | `masterModes` | 78 | 0.3 % | available, spoolTime |
| 1163 | `controllerParams` | 78 | 0.3 % | itemType, defaultPriority |
| 1164 | `requiresLauncher` | 74 | 0.3 % |  |
| 1165 | `enableLifetime` | 74 | 0.3 % |  |
| 1166 | `maxLifetime` | 74 | 0.3 % |  |
| 1167 | `armTime` | 74 | 0.3 % |  |
| 1168 | `maxArmableOverride` | 74 | 0.3 % |  |
| 1169 | `igniteTime` | 74 | 0.3 % |  |
| 1170 | `collisionDelayTime` | 74 | 0.3 % |  |
| 1171 | `explosionSafetyDistance` | 74 | 0.3 % |  |
| 1172 | `projectileProximity` | 74 | 0.3 % |  |
| 1173 | `explosionParams` | 74 | 0.3 % | friendlyFire, minRadius, maxRadius, soundRadius, minPhysRadius, maxPhysRadius, angle, angleVertical |
| 1174 | `clusterParams` | 74 | 0.3 % | launchDetachTime, impactDetachTime, detachAngleRelativeToGravity, detachAngleInitial, detachAngleIncrement, detachAngleResetCount, detachDelay, detachSpeed |
| 1175 | `emissionsParams` | 74 | 0.3 % | active, minValue, maxValue, riseRate, decayRate |
| 1176 | `MaxShieldHealth` | 73 | 0.3 % |  |
| 1177 | `MaxShieldRegen` | 73 | 0.3 % |  |
| 1178 | `DecayRatio` | 73 | 0.3 % |  |
| 1179 | `ReservePoolInitialHealthRatio` | 73 | 0.3 % |  |
| 1180 | `ReservePoolMaxHealthRatio` | 73 | 0.3 % |  |
| 1181 | `ReservePoolRegenRateRatio` | 73 | 0.3 % |  |
| 1182 | `ReservePoolDrainRateRatio` | 73 | 0.3 % |  |
| 1183 | `DownedRegenDelay` | 73 | 0.3 % |  |
| 1184 | `DamagedRegenDelay` | 73 | 0.3 % |  |
| 1185 | `ElectricalChargeDamageResistance` | 73 | 0.3 % |  |
| 1186 | `stunParams` | 73 | 0.3 % | minAlphaDamageRatio, maxAlphaDamageRatio, minStunTime, maxStunTime |
| 1187 | `ShieldResistance` | 73 | 0.3 % | Max, Min |
| 1188 | `ShieldAbsorption` | 73 | 0.3 % | Max, Min |
| 1189 | `islandControl` | 72 | 0.3 % | scale, x, y, z |
| 1190 | `moveInteraction` | 71 | 0.3 % | __weak, __instance |
| 1191 | `limits` | 71 | 0.3 % | __ref, name, fileName |
| 1192 | `defaultInstalledApps` | 69 | 0.3 % | __ref, name, fileName |
| 1193 | `appTransitionTime` | 69 | 0.3 % |  |
| 1194 | `onlyAllowUserInteractions` | 69 | 0.3 % |  |
| 1195 | `closeTime` | 69 | 0.3 % |  |
| 1196 | `GCSParams` | 69 | 0.3 % | isDumbMissile, dumbfireRotationScale, linearSpeed, boostPhaseDuration, terminalPhaseEngagementTime, terminalPhaseEngagementAngle, fuelTankSize, pidIntegralTerm |
| 1197 | `targetingParams` | 69 | 0.3 % | trackingSignalType, trackingSignalMin, lockSignalAmplifier, lockTime, lockingAngle, minRatioForLock, lockIncreaseRate, lockDecreaseRate |
| 1198 | `shakeParams` | 69 | 0.3 % | x, y, z, randomness, range, duration, frequency |
| 1199 | `environmentSettings` | 66 | 0.3 % | __ref, name, fileName |
| 1200 | `medicalTier` | 65 | 0.3 % | locationMedicalTier |
| 1201 | `params` | 63 | 0.3 % | driveSpeed, cooldownTime, stageOneAccelRate, stageTwoAccelRate, engageSpeed, VFXSpoolEndVelocity, VFXPinchEffectTime, VFXPinchMaxVelocity |
| 1202 | `splineJumpParams` | 63 | 0.3 % | driveSpeed, cooldownTime, stageOneAccelRate, stageTwoAccelRate, engageSpeed, VFXSpoolEndVelocity, VFXPinchEffectTime, VFXPinchMaxVelocity |
| 1203 | `heatParams` | 63 | 0.3 % | preRampUpThermalEnergyDraw, rampUpThermalEnergyDraw, inFlightThermalEnergyDraw, rampDownThermalEnergyDraw, postRampDownThermalEnergyDraw |
| 1204 | `tracePoint` | 63 | 0.3 % |  |
| 1205 | `quantumFuelRequirement` | 63 | 0.3 % |  |
| 1206 | `jumpRange` | 63 | 0.3 % |  |
| 1207 | `disconnectRange` | 63 | 0.3 % |  |
| 1208 | `emptyFactionSC` | 61 | 0.3 % | __ref, name, fileName |
| 1209 | `emptyFaction` | 61 | 0.3 % | __ref, name, fileName |
| 1210 | `useOnlyPrimaryChildForHostility` | 61 | 0.3 % |  |
| 1211 | `dragDropUserConfigs` | 59 | 0.2 % | __ref, name, fileName, interactionDragOut, __weak, __instance, propAnimationDatabase |
| 1212 | `DockingAnimatorParams` | 56 | 0.2 % | OverrideTime, IgnoreGeometryOnDocking, dockingAnimationStageTrigger, triggerVal |
| 1213 | `considerActorVelocity` | 55 | 0.2 % |  |
| 1214 | `exitDelay` | 55 | 0.2 % |  |
| 1215 | `activeOnEnterTag` | 55 | 0.2 % | __ref, name, fileName |
| 1216 | `EnteredInteraction` | 55 | 0.2 % | __weak, __instance |
| 1217 | `ExitedInteraction` | 55 | 0.2 % | __weak, __instance |
| 1218 | `SensorShape` | 55 | 0.2 % | x, y, z |
| 1219 | `allowCloseWithStationaryActors` | 55 | 0.2 % |  |
| 1220 | `stationaryActorCloseMinDist` | 55 | 0.2 % |  |
| 1221 | `isHelper` | 55 | 0.2 % |  |
| 1222 | `codeLength` | 55 | 0.2 % |  |
| 1223 | `repeatKey` | 55 | 0.2 % |  |
| 1224 | `repeatKeyInCode` | 55 | 0.2 % |  |
| 1225 | `randomCode` | 55 | 0.2 % |  |
| 1226 | `validCodes` | 55 | 0.2 % |  |
| 1227 | `attemptsUntilCodeReset` | 55 | 0.2 % |  |
| 1228 | `resetCodeOnSuccess` | 55 | 0.2 % |  |
| 1229 | `autoSuccessOnEnterKey` | 55 | 0.2 % |  |
| 1230 | `autoFailOnInputLength` | 55 | 0.2 % |  |
| 1231 | `interactionSetup` | 55 | 0.2 % | __weak, __instance, clearCodeInteraction, enterCodeInteraction |
| 1232 | `hostilityRulesTag` | 55 | 0.2 % | __ref, name, fileName |
| 1233 | `variableEffects` | 55 | 0.2 % | __ref, name, fileName, value |
| 1234 | `throttleLerpSpeed` | 51 | 0.2 % |  |
| 1235 | `throttleMinimum` | 51 | 0.2 % |  |
| 1236 | `miningLaserModifiers` | 51 | 0.2 % | laserInstability, optimalChargeWindowSizeModifier, resistanceModifier, shatterdamageModifier, clusterFactorModifier, optimalChargeWindowRateModifier, isOptimalRateGood, catastrophicChargeWindowRateModifier |
| 1237 | `usesPowerThrottle` | 51 | 0.2 % |  |
| 1238 | `wheels` | 50 | 0.2 % | wheelJoint, castorJoint, radius, x, y, z |
| 1239 | `fragment` | 49 | 0.2 % |  |
| 1240 | `healInteraction` | 49 | 0.2 % | __weak, __instance |
| 1241 | `setRespawnInteraction` | 49 | 0.2 % | __weak, __instance |
| 1242 | `cancelRespawnInteraction` | 49 | 0.2 % | __weak, __instance |
| 1243 | `cancelAllRespawnsInteraction` | 49 | 0.2 % | __weak, __instance |
| 1244 | `respawnInteraction` | 49 | 0.2 % | __weak, __instance |
| 1245 | `respawnInteractionPoint` | 49 | 0.2 % | __weak, __instance |
| 1246 | `useChannelToHealActor` | 49 | 0.2 % | __weak, __instance |
| 1247 | `surgerySequenceState` | 49 | 0.2 % | __weak, __instance |
| 1248 | `respawnRangeOverride` | 49 | 0.2 % | respawnRange |
| 1249 | `timeToHeal` | 49 | 0.2 % |  |
| 1250 | `delayBeforeHeal` | 49 | 0.2 % |  |
| 1251 | `medBedTier` | 49 | 0.2 % |  |
| 1252 | `medicalItemTierConfig` | 49 | 0.2 % | __ref, name, fileName |
| 1253 | `canRespawnHere` | 49 | 0.2 % |  |
| 1254 | `invulnerableUser` | 49 | 0.2 % |  |
| 1255 | `invulnerableDuration` | 49 | 0.2 % |  |
| 1256 | `surgeryNames` | 49 | 0.2 % | injuryName, majorInjuryName, deadlyInjuryName |
| 1257 | `resourceRegenerationPerMinute` | 49 | 0.2 % |  |
| 1258 | `setup` | 45 | 0.2 % | __ref, name, fileName |
| 1259 | `despawningPorts` | 43 | 0.2 % | __weak, __instance |
| 1260 | `delay` | 43 | 0.2 % |  |
| 1261 | `despawnerTasks` | 43 | 0.2 % | name, __weak, __instance |
| 1262 | `attackerScore` | 41 | 0.2 % |  |
| 1263 | `ignoreHostiles` | 40 | 0.2 % |  |
| 1264 | `perceptionProfile` | 40 | 0.2 % | __ref, name, fileName |
| 1265 | `communicationConfigName` | 39 | 0.2 % |  |
| 1266 | `automaticallyEnableItems` | 39 | 0.2 % |  |
| 1267 | `useGameRulesActivation` | 39 | 0.2 % |  |
| 1268 | `isHostilityPrimaryChild` | 39 | 0.2 % |  |
| 1269 | `subsumptionMastergraph` | 39 | 0.2 % |  |
| 1270 | `subsumptionActivity` | 39 | 0.2 % |  |
| 1271 | `mastergraphStateOverrides` | 39 | 0.2 % |  |
| 1272 | `SetDefaultOperatorModeOnControlGained` | 39 | 0.2 % |  |
| 1273 | `looseSubConfigBase` | 36 | 0.2 % | __ref, name, fileName, initialSlotsProbability, initialSlotsProbabilityDeepest, configRespawnTimeMultiplier, ignoreAttachableTagsForTaggedConfigs, harvestableEntityClass |
| 1274 | `allowAutoRespawning` | 36 | 0.2 % |  |
| 1275 | `StartChargingEffectTag` | 35 | 0.1 % | __ref, name, fileName |
| 1276 | `StartDecayingEffectTag` | 35 | 0.1 % |  |
| 1277 | `FinishChargingEffectTag` | 35 | 0.1 % |  |
| 1278 | `variant` | 34 | 0.1 % |  |
| 1279 | `shopType` | 34 | 0.1 % |  |
| 1280 | `brand` | 34 | 0.1 % | __ref, name, fileName |
| 1281 | `globalInventoryPersistentQueryDef` | 34 | 0.1 % | Name, DisplayName, PortTags, RequiredPortTags, Flags, PropagateOnAttachTagsToHierarchy, MinSize, MaxSize |
| 1282 | `commsChannels` | 33 | 0.1 % | __ref, name, fileName |
| 1283 | `activation` | 33 | 0.1 % |  |
| 1284 | `startUpMainProvider` | 33 | 0.1 % | __weak, __instance |
| 1285 | `backgroundEffectSettings` | 33 | 0.1 % | darkenBackgroundWhenFocussed, darkenBackgroundWhenCentered, centerDarkenScreenSizeRatio, centerDarkenScreenCenterDistance |
| 1286 | `displayPreset` | 33 | 0.1 % | __ref, name, fileName |
| 1287 | `displayRange` | 33 | 0.1 % |  |
| 1288 | `overridePlaneAlignment` | 33 | 0.1 % |  |
| 1289 | `overrideFollowOrientation` | 33 | 0.1 % |  |
| 1290 | `overrideUseInputOrientation` | 33 | 0.1 % |  |
| 1291 | `radarDisplaySettings` | 33 | 0.1 % | __ref, name, fileName |
| 1292 | `collapsedEnvironmentSettings` | 33 | 0.1 % | __ref, name, fileName |
| 1293 | `values` | 32 | 0.1 % | name, value |
| 1294 | `forceCrosshairOnline` | 32 | 0.1 % |  |
| 1295 | `modifierPortTag` | 32 | 0.1 % |  |
| 1296 | `applyModifierPortTagOnStart` | 32 | 0.1 % |  |
| 1297 | `dashboardScreen` | 32 | 0.1 % | Name, GeomName, MaterialOverride, Template, Type, Helper, Scale, x |
| 1298 | `PumpInteraction` | 30 | 0.1 % | __weak, __instance |
| 1299 | `FullChargeInteraction` | 30 | 0.1 % | __weak, __instance |
| 1300 | `lootConfig` | 30 | 0.1 % | poolFilter, secondaryChoices, min, max, totalResultsLimit, chanceToGenerate, chanceToGenerateAdditionalAttachedInventories, pruningLevel |
| 1301 | `forceEntities` | 27 | 0.1 % |  |
| 1302 | `networkSynced` | 27 | 0.1 % |  |
| 1303 | `ignoreTerrain` | 27 | 0.1 % |  |
| 1304 | `explodeImpulse` | 27 | 0.1 % |  |
| 1305 | `impulseRelativeToScale` | 27 | 0.1 % |  |
| 1306 | `particleLifetime` | 27 | 0.1 % |  |
| 1307 | `pieceSpawnPlanetCheckRadius` | 27 | 0.1 % |  |
| 1308 | `numPiecesOverride` | 27 | 0.1 % |  |
| 1309 | `localOffsetForAdditionalOverridenDebris` | 27 | 0.1 % | x, y, z |
| 1310 | `entityClassOverride` | 27 | 0.1 % |  |
| 1311 | `onBreakAudioTrigger` | 27 | 0.1 % | audioTrigger |
| 1312 | `ProvidesExclusionArea` | 27 | 0.1 % |  |
| 1313 | `AreaExclusionDimensions` | 27 | 0.1 % | x, y, z |
| 1314 | `OverridesDockingPoint` | 27 | 0.1 % |  |
| 1315 | `fragmentUnready` | 27 | 0.1 % |  |
| 1316 | `fragmentUnreadying` | 27 | 0.1 % |  |
| 1317 | `fragmentReadying` | 27 | 0.1 % |  |
| 1318 | `fragmentReady` | 27 | 0.1 % |  |
| 1319 | `animationDuration` | 27 | 0.1 % |  |
| 1320 | `dockingArmExtendingLoopStart` | 27 | 0.1 % | audioTrigger |
| 1321 | `dockingArmExtendingLoopStop` | 27 | 0.1 % | audioTrigger |
| 1322 | `dockingArmRetractingLoopStart` | 27 | 0.1 % | audioTrigger |
| 1323 | `dockingArmRetractingLoopStop` | 27 | 0.1 % | audioTrigger |
| 1324 | `skills` | 26 | 0.1 % | __ref, name, fileName |
| 1325 | `profile` | 26 | 0.1 % | __ref, name, fileName |
| 1326 | `motiveList` | 26 | 0.1 % |  |
| 1327 | `categoryIcons` | 26 | 0.1 % |  |
| 1328 | `defaultModeBuying` | 26 | 0.1 % |  |
| 1329 | `degradationIcon` | 26 | 0.1 % |  |
| 1330 | `TeleportTimeScale` | 24 | 0.1 % |  |
| 1331 | `doorOpenInteraction` | 24 | 0.1 % | __weak, __instance |
| 1332 | `doorCloseInteraction` | 24 | 0.1 % | __weak, __instance |
| 1333 | `ascentRequestInteraction` | 24 | 0.1 % | __weak, __instance |
| 1334 | `descentRequestInteraction` | 24 | 0.1 % | __weak, __instance |
| 1335 | `cancelStopInteraction` | 24 | 0.1 % | __weak, __instance |
| 1336 | `gatewayParams` | 24 | 0.1 % | timingInTransit, __weak, __instance |
| 1337 | `accessibilityParams` | 24 | 0.1 % |  |
| 1338 | `enabled` | 24 | 0.1 % |  |
| 1339 | `signageAspectRatio` | 24 | 0.1 % | __ref, name, fileName |
| 1340 | `signageType` | 24 | 0.1 % | __ref, name, fileName |
| 1341 | `defaultCanvas` | 24 | 0.1 % | __ref, name, fileName |
| 1342 | `hidden` | 23 | 0.1 % |  |
| 1343 | `factionSC` | 23 | 0.1 % | __ref, name, fileName |
| 1344 | `playerUsableSlots` | 23 | 0.1 % | __weak, __instance, fragmentTag, useSlot |
| 1345 | `playerUseChannels` | 23 | 0.1 % | __weak, __instance, delinkOnEnterComplete, tag, hintDescription, activationMode |
| 1346 | `passRadiusAgent` | 23 | 0.1 % |  |
| 1347 | `passRadiusObstacleMoving` | 23 | 0.1 % |  |
| 1348 | `passRadiusObstacleStatic` | 23 | 0.1 % |  |
| 1349 | `baseAgentAvoidanceRange` | 23 | 0.1 % |  |
| 1350 | `baseObstacleAvoidanceRange` | 23 | 0.1 % |  |
| 1351 | `baseNavmeshEdgeAvoidanceRange` | 23 | 0.1 % |  |
| 1352 | `velocityInfluenceMultiplier` | 23 | 0.1 % |  |
| 1353 | `timeHorizonScale` | 23 | 0.1 % |  |
| 1354 | `agentAvoidanceTimeHorizon` | 23 | 0.1 % |  |
| 1355 | `obstacleAvoidanceTimeHorizon` | 23 | 0.1 % |  |
| 1356 | `navmeshEdgeAvoidanceTimeHorizon` | 23 | 0.1 % |  |
| 1357 | `alwaysAnObstacle` | 23 | 0.1 % |  |
| 1358 | `preferMinSpeedDuringAvoidance` | 23 | 0.1 % |  |
| 1359 | `offsetAgent` | 23 | 0.1 % | x, y |
| 1360 | `offsetObstacle` | 23 | 0.1 % | x, y |
| 1361 | `fragmentDeploy` | 22 | 0.1 % |  |
| 1362 | `fragmentRetract` | 22 | 0.1 % |  |
| 1363 | `updateTimeSeconds` | 22 | 0.1 % |  |
| 1364 | `maxCharges` | 21 | 0.1 % |  |
| 1365 | `primedState` | 21 | 0.1 % | __weak, __instance |
| 1366 | `unprimedState` | 21 | 0.1 % | __weak, __instance |
| 1367 | `settledState` | 21 | 0.1 % | __weak, __instance |
| 1368 | `pickedUpState` | 21 | 0.1 % | __weak, __instance |
| 1369 | `onPrimeInteraction` | 21 | 0.1 % | __weak, __instance |
| 1370 | `onUnprimeInteraction` | 21 | 0.1 % | __weak, __instance |
| 1371 | `primeableAnimatedStates` | 21 | 0.1 % | __weak, __instance, fragmentId, fragTag |
| 1372 | `unprimeOnTake` | 21 | 0.1 % |  |
| 1373 | `primeOnTake` | 21 | 0.1 % |  |
| 1374 | `primeOnPlace` | 21 | 0.1 % |  |
| 1375 | `primeOnPlaceAttach` | 21 | 0.1 % |  |
| 1376 | `primeOnThrow` | 21 | 0.1 % |  |
| 1377 | `primeOnAttach` | 21 | 0.1 % |  |
| 1378 | `equipInteraction` | 21 | 0.1 % | __weak, __instance |
| 1379 | `hangInteraction` | 21 | 0.1 % | __weak, __instance |
| 1380 | `swapInteraction` | 21 | 0.1 % | __weak, __instance |
| 1381 | `swapAllInteraction` | 21 | 0.1 % | __weak, __instance |
| 1382 | `equipAllInteraction` | 21 | 0.1 % | __weak, __instance |
| 1383 | `hangAllInteraction` | 21 | 0.1 % | __weak, __instance |
| 1384 | `disguiseSwapAllInteraction` | 21 | 0.1 % |  |
| 1385 | `itemPortTypeSubtypes` | 21 | 0.1 % | itemType, itemSubType |
| 1386 | `animatedOutfitSwap` | 21 | 0.1 % | __weak, __instance, __ref, name, fileName |
| 1387 | `animatedOutfitHang` | 21 | 0.1 % | __weak, __instance, __ref, name, fileName |
| 1388 | `destroyPlayerItems` | 21 | 0.1 % |  |
| 1389 | `MaxSpeed` | 20 | 0.1 % |  |
| 1390 | `EasingDistance` | 20 | 0.1 % |  |
| 1391 | `IdlingPeriod` | 20 | 0.1 % |  |
| 1392 | `OpenWaitTime` | 20 | 0.1 % |  |
| 1393 | `QueueWaitTime` | 20 | 0.1 % |  |
| 1394 | `SlowDownAtBends` | 20 | 0.1 % |  |
| 1395 | `Collision` | 20 | 0.1 % |  |
| 1396 | `OpenInnerDoorInteraction` | 20 | 0.1 % | __weak, __instance |
| 1397 | `OpenInnerDoorFinishedInteraction` | 20 | 0.1 % | __weak, __instance |
| 1398 | `CloseAllDoorsInteraction` | 20 | 0.1 % | __weak, __instance |
| 1399 | `CloseInnerDoorFinishedInteraction` | 20 | 0.1 % | __weak, __instance |
| 1400 | `Effects` | 20 | 0.1 % | __ref, name, fileName, stopTrigger, rampUpTrigger, inTransitTag, powerUpTrigger, powerDownTrigger |
| 1401 | `text` | 20 | 0.1 % |  |
| 1402 | `minScale` | 20 | 0.1 % |  |
| 1403 | `maxDistance` | 20 | 0.1 % |  |
| 1404 | `charsPerLine` | 20 | 0.1 % |  |
| 1405 | `fixed` | 20 | 0.1 % |  |
| 1406 | `color` | 20 | 0.1 % | r, g, b |
| 1407 | `seed` | 17 | 0.1 % |  |
| 1408 | `armParams` | 17 | 0.1 % | straightenJointName, x, y, z |
| 1409 | `scrapingParams` | 17 | 0.1 % | __ref, name, fileName |
| 1410 | `structuralParams` | 17 | 0.1 % | numFieldSupportersRequired, x, y, z, fractureTimePerRadiusMetre, minFracturableRadius, maxFracturableRadius, minDisintegratableRadius |
| 1411 | `cargoParams` | 17 | 0.1 % | __ref, name, fileName, ejectCargoBoxInteration, conveyorResetInteration, x, y, z |
| 1412 | `tractorParams` | 17 | 0.1 % | towingController |
| 1413 | `sensorRaycastArmingDistance` | 17 | 0.1 % |  |
| 1414 | `numSupportedSalvageHeads` | 17 | 0.1 % |  |
| 1415 | `salvageAudioParams` | 17 | 0.1 % | audioTrigger, structuralAudio, targetAuxProxyLifetime, rtpc, isGatheringMaterialHoldTime |
| 1416 | `useControllerToInitalizeControlComponent` | 17 | 0.1 % |  |
| 1417 | `usesCargoGrid` | 17 | 0.1 % |  |
| 1418 | `autoEjectRequireManualStart` | 17 | 0.1 % |  |
| 1419 | `lockAngleAtMin` | 17 | 0.1 % |  |
| 1420 | `lockAngleAtMax` | 17 | 0.1 % |  |
| 1421 | `maxArmedMissiles` | 17 | 0.1 % |  |
| 1422 | `launchCooldownTime` | 17 | 0.1 % |  |
| 1423 | `interactionPoint` | 17 | 0.1 % |  |
| 1424 | `interactionName` | 17 | 0.1 % |  |
| 1425 | `initialSpawn` | 17 | 0.1 % |  |
| 1426 | `allowChildActors` | 17 | 0.1 % |  |
| 1427 | `registerWithGameRules` | 17 | 0.1 % |  |
| 1428 | `primaryListener` | 16 | 0.1 % |  |
| 1429 | `inputRadius` | 16 | 0.1 % |  |
| 1430 | `outputRadius` | 16 | 0.1 % |  |
| 1431 | `entityExclusive` | 16 | 0.1 % |  |
| 1432 | `bus` | 16 | 0.1 % |  |
| 1433 | `hover` | 16 | 0.1 % | __weak, __instance, activateHoverByDefault, activateHoverOnGripAttached, deactivateHoverOnGripDetached, blendInDuration, blendOutDuration, powerOffDesiredHoverHeight |
| 1434 | `fillVFXPath` | 16 | 0.1 % |  |
| 1435 | `fillSourceHelper` | 16 | 0.1 % |  |
| 1436 | `fillVFXTintOverride` | 16 | 0.1 % | r, g, b |
| 1437 | `trigger` | 15 | 0.1 % | __ref, name, fileName |
| 1438 | `bounds` | 15 | 0.1 % | x, y, z |
| 1439 | `showDebugInEditor` | 15 | 0.1 % |  |
| 1440 | `ignoreWarmupAndCooldown` | 15 | 0.1 % |  |
| 1441 | `fragmentIdle` | 15 | 0.1 % |  |
| 1442 | `fragmentStartup` | 15 | 0.1 % |  |
| 1443 | `fragmentRun` | 15 | 0.1 % |  |
| 1444 | `fragmentDeactivate` | 15 | 0.1 % |  |
| 1445 | `deployConditions` | 15 | 0.1 % | gearUp |
| 1446 | `isEnabled` | 14 | 0.1 % |  |
| 1447 | `baseDuration` | 14 | 0.1 % |  |
| 1448 | `baseErrorChance` | 14 | 0.1 % |  |
| 1449 | `numErrorChecks` | 14 | 0.1 % |  |
| 1450 | `maxPauseDuration` | 14 | 0.1 % |  |
| 1451 | `updateProgressDeltaTime` | 14 | 0.1 % |  |
| 1452 | `resetAfterHackSuccess` | 14 | 0.1 % |  |
| 1453 | `audioTriggerProgressLoopStart` | 14 | 0.1 % | audioTrigger |
| 1454 | `audioTriggerProgressLoopStop` | 14 | 0.1 % | audioTrigger |
| 1455 | `audioTriggerStart` | 14 | 0.1 % | audioTrigger |
| 1456 | `audioTriggerPause` | 14 | 0.1 % | audioTrigger |
| 1457 | `audioTriggerResume` | 14 | 0.1 % | audioTrigger |
| 1458 | `audioTriggerError` | 14 | 0.1 % | audioTrigger |
| 1459 | `audioTriggerPartSuccess` | 14 | 0.1 % | audioTrigger |
| 1460 | `audioTriggerSuccess` | 14 | 0.1 % | audioTrigger |
| 1461 | `audioTriggerReset` | 14 | 0.1 % | audioTrigger |
| 1462 | `audioRtpcOverallProgress` | 14 | 0.1 % | rtpc |
| 1463 | `audioRtpcPartProgress` | 14 | 0.1 % | rtpc |
| 1464 | `audioRtpcTotalDuration` | 14 | 0.1 % | rtpc |
| 1465 | `audioRtpcRemainingDuration` | 14 | 0.1 % | rtpc |
| 1466 | `deployInteraction` | 14 | 0.1 % | __weak, __instance |
| 1467 | `retractInteraction` | 14 | 0.1 % | __weak, __instance |
| 1468 | `hideSelectorRatio` | 14 | 0.1 % |  |
| 1469 | `hudMessagesParams` | 14 | 0.1 % | DockingMessageTimer, WaitingPermission, PermissionDenied, NoMatching, OutOfRange, DockeeLanded, NoAvailable, InMotion |
| 1470 | `dockingAutodockingParams` | 14 | 0.1 % | DockingMaximumSpeedRequirement, DockingMaximumAngularSpeedRequirement, DockingMinimumAngularAlignmentAngle, DockingHoldForCompletionTime, DockingMaximumAngleFromDockingPoint, DockingAngularTiltForShipGeometry, DockingMinimumDistance |
| 1471 | `MinimumPowerAmount` | 14 | 0.1 % |  |
| 1472 | `physRadius` | 14 | 0.1 % |  |
| 1473 | `minPhysRadius` | 14 | 0.1 % |  |
| 1474 | `DNA` | 14 | 0.1 % |  |
| 1475 | `customizationFile` | 14 | 0.1 % |  |
| 1476 | `randomizeFromArchetypes` | 14 | 0.1 % |  |
| 1477 | `fullArchetypeRandomization` | 14 | 0.1 % |  |
| 1478 | `voiceBundle` | 13 | 0.1 % |  |
| 1479 | `voiceSingle` | 13 | 0.1 % |  |
| 1480 | `communicationConfig` | 13 | 0.1 % | __ref, name, fileName |
| 1481 | `contextualDialog` | 13 | 0.1 % |  |
| 1482 | `isVault` | 13 | 0.1 % |  |
| 1483 | `isDoubleSided` | 13 | 0.1 % |  |
| 1484 | `isFlipped` | 13 | 0.1 % |  |
| 1485 | `autoTransition` | 13 | 0.1 % |  |
| 1486 | `followTerrain` | 13 | 0.1 % |  |
| 1487 | `ledgeMaxDepth` | 13 | 0.1 % |  |
| 1488 | `ledgeMaxExitAngle` | 13 | 0.1 % |  |
| 1489 | `cornerMaxAngle` | 13 | 0.1 % |  |
| 1490 | `cornerEndAdjustAmount` | 13 | 0.1 % |  |
| 1491 | `aiParams` | 13 | 0.1 % | navigationLinksSpacing |
| 1492 | `pEnityParams` | 13 | 0.1 % | excludeLeft, excludeRight, excludeBack, excludeFront |
| 1493 | `active` | 13 | 0.1 % |  |
| 1494 | `MaxTimeToWaitForDoors` | 13 | 0.1 % |  |
| 1495 | `MinTimeToWaitAfterDoorsClosed` | 13 | 0.1 % |  |
| 1496 | `CycleTime` | 13 | 0.1 % |  |
| 1497 | `InitializationUpdateTimerLength` | 13 | 0.1 % |  |
| 1498 | `GreenzoneParams` | 13 | 0.1 % |  |
| 1499 | `AreaOverride` | 13 | 0.1 % |  |
| 1500 | `attachmentTriggers` | 13 | 0.1 % | name, entityLinkName, handholdName, attachSpotName, fallbackParams |
| 1501 | `sharedInteractionLinks` | 13 | 0.1 % |  |
| 1502 | `interactionPointLinks` | 13 | 0.1 % | ignoreInteractionOnFail, __weak, __instance |
| 1503 | `pausable` | 13 | 0.1 % |  |
| 1504 | `particleEffects` | 13 | 0.1 % |  |
| 1505 | `startAudioTriggerOneshot` | 13 | 0.1 % | audioTrigger |
| 1506 | `startAudioTriggerLoop` | 13 | 0.1 % | audioTrigger |
| 1507 | `stopAudioTrigger` | 13 | 0.1 % | audioTrigger |
| 1508 | `endOfUseAudioTrigger` | 13 | 0.1 % | audioTrigger |
| 1509 | `auxiliaryWeaponAction` | 13 | 0.1 % | range, helper, hitEffectName, cuttableImpacts, tractorBeam, skipListIncludeOwner, useADSHelper, detachOnActivate |
| 1510 | `idleAnimation` | 13 | 0.1 % | fragment, forceWeaponController |
| 1511 | `supplementaryFireAnimation` | 13 | 0.1 % | fragment, forceWeaponController |
| 1512 | `alwaysOn` | 13 | 0.1 % |  |
| 1513 | `vfxTag` | 12 | 0.1 % | __ref, name, fileName |
| 1514 | `lightType` | 12 | 0.1 % |  |
| 1515 | `importance` | 12 | 0.1 % |  |
| 1516 | `affectsThisAreaOnly` | 12 | 0.1 % |  |
| 1517 | `affectsFog` | 12 | 0.1 % |  |
| 1518 | `affectsObjects` | 12 | 0.1 % |  |
| 1519 | `ignoreLightFlickerEntities` | 12 | 0.1 % |  |
| 1520 | `useTemperature` | 12 | 0.1 % |  |
| 1521 | `distantImposter` | 12 | 0.1 % |  |
| 1522 | `affectGI` | 12 | 0.1 % |  |
| 1523 | `enabledWithGI` | 12 | 0.1 % |  |
| 1524 | `sizeParams` | 12 | 0.1 % | lightRadius, bulbRadius, planeWidth, planeHeight |
| 1525 | `offState` | 12 | 0.1 % | presetTag |
| 1526 | `defaultState` | 12 | 0.1 % | r, g, b, intensity, presetTag, lightStyle, temperature |
| 1527 | `auxiliaryState` | 12 | 0.1 % | r, g, b, intensity, presetTag, lightStyle, temperature |
| 1528 | `emergencyState` | 12 | 0.1 % | r, g, b, intensity, presetTag, lightStyle, temperature |
| 1529 | `cinematicState` | 12 | 0.1 % | r, g, b, intensity, presetTag, lightStyle, temperature |
| 1530 | `tagBasedStates` | 12 | 0.1 % |  |
| 1531 | `projectorParams` | 12 | 0.1 % | texture, FOV, focusedBeam |
| 1532 | `shadowParams` | 12 | 0.1 % | shadowCasting, projectorNearPlane, constantBias, slopeBiasMultiplier, resolutionScale, maxShadowCastDist, disableScreenSpaceShadow |
| 1533 | `styleParams` | 12 | 0.1 % | animationSpeed, animationPhase, randomAnimationPhase, lightanimation, angularSpeed |
| 1534 | `groupParams` | 12 | 0.1 % | flickerOn, temperatureTransition, transitionDelayId, useRandomDelayId |
| 1535 | `clipBoxParams` | 12 | 0.1 % | useClipBox, autoDetectClipBox |
| 1536 | `fadeParams` | 12 | 0.1 % | minDistance, minFade, maxDistance, maxFade |
| 1537 | `miscParams` | 12 | 0.1 % | specularMultiplier, fogMultiplier, glowMultiplier, planeSoftness, linkIgnoresColor, attenuationTweak, forceKeepEntity |
| 1538 | `flareParams` | 12 | 0.1 % | flareEnabled, flare, flareFOV, flareScale, attachToSun |
| 1539 | `aiExtender` | 12 | 0.1 % |  |
| 1540 | `useInteraction` | 12 | 0.1 % | __weak, __instance |
| 1541 | `pitchAxis` | 12 | 0.1 % | jointName, minRot, maxRot, maxSpeedDelta, rotSpeedDamping, minRotADS, maxRotADS, maxSpeedDeltaADS |
| 1542 | `yawAxis` | 12 | 0.1 % | jointName, minRot, maxRot, maxSpeedDelta, rotSpeedDamping, minRotADS, maxRotADS, maxSpeedDeltaADS |
| 1543 | `WeaponItemPort` | 12 | 0.1 % | __weak, __instance |
| 1544 | `FreeRotateYaw` | 12 | 0.1 % |  |
| 1545 | `pitchAxisRtpc` | 12 | 0.1 % | rtpc |
| 1546 | `yawAxisRtpc` | 12 | 0.1 % | rtpc |
| 1547 | `useStartTrigger` | 12 | 0.1 % | audioTrigger |
| 1548 | `useStopTrigger` | 12 | 0.1 % | audioTrigger |
| 1549 | `alignmentRate` | 12 | 0.1 % |  |
| 1550 | `alignmentDecayRate` | 12 | 0.1 % |  |
| 1551 | `tuningRate` | 12 | 0.1 % |  |
| 1552 | `tuningDecayRate` | 12 | 0.1 % |  |
| 1553 | `fuelUsageEfficiencyMultiplier` | 12 | 0.1 % |  |
| 1554 | `jumpDriveEffectParams` | 12 | 0.1 % | enabled, allowMultipleTags, path, maxPenetration, shieldPulseMaxTime, interactionStartDistance, reactionBurstTriggerDistance, minimum |
| 1555 | `transitingState` | 12 | 0.1 % | __weak, __instance |
| 1556 | `flightTuning` | 12 | 0.1 % | __ref, name, fileName |
| 1557 | `tunnelForces` | 12 | 0.1 % | __ref, name, fileName |
| 1558 | `stateToEnable` | 11 | 0.0 % | __weak, __instance |
| 1559 | `stateToDisable` | 11 | 0.0 % | __weak, __instance |
| 1560 | `events` | 11 | 0.0 % |  |
| 1561 | `tagBehaviours` | 11 | 0.0 % | __ref, name, fileName, musicLogicEvent, audioTrigger, parameter, rtpc |
| 1562 | `ProbeOffset` | 11 | 0.0 % | x, y, z |
| 1563 | `NoHazardEffectGroup` | 11 | 0.0 % |  |
| 1564 | `MinorHazardEffectGroup` | 11 | 0.0 % |  |
| 1565 | `MajorHazardEffectGroup` | 11 | 0.0 % |  |
| 1566 | `enabledByDefault` | 10 | 0.0 % |  |
| 1567 | `phase` | 10 | 0.0 % |  |
| 1568 | `cooldownTime` | 10 | 0.0 % |  |
| 1569 | `sortingPosition` | 9 | 0.0 % |  |
| 1570 | `defaultTeam` | 9 | 0.0 % |  |
| 1571 | `scaleMarkerByDistance` | 9 | 0.0 % |  |
| 1572 | `availableToDefaultTeam` | 9 | 0.0 % |  |
| 1573 | `percentageString` | 9 | 0.0 % |  |
| 1574 | `removeMarkerOnCapture` | 9 | 0.0 % |  |
| 1575 | `showMarker` | 9 | 0.0 % |  |
| 1576 | `canTriggerOvertime` | 9 | 0.0 % |  |
| 1577 | `capturedNotification` | 9 | 0.0 % | messagePriority, messageDuration, message |
| 1578 | `lostNotification` | 9 | 0.0 % | messagePriority, messageDuration, message |
| 1579 | `neutralizedNotification` | 9 | 0.0 % | messagePriority, messageDuration, message |
| 1580 | `objectiveMarkerMessages` | 9 | 0.0 % | captureMessage, defendMessage, capturedMessage, lostMessage, capturingMessage, boostCapturingMessage, contestedMessage, resettingMessage |
| 1581 | `objectiveMarkerSettings` | 9 | 0.0 % | state, markerFillProgress |
| 1582 | `onInteractDamageToObjective` | 9 | 0.0 % |  |
| 1583 | `onInteractDamageRadius` | 9 | 0.0 % |  |
| 1584 | `handlePlayers` | 9 | 0.0 % |  |
| 1585 | `handleNPCs` | 9 | 0.0 % |  |
| 1586 | `minigameStartInteraction` | 9 | 0.0 % | __weak, __instance |
| 1587 | `triggers` | 9 | 0.0 % | name, isAuthoritative, enabled, minFrequency, maxFrequency, rampUpTime, tag, minRange |
| 1588 | `aiTriggers` | 9 | 0.0 % | name, isAuthoritative, enabled, minFrequency, maxFrequency, rampUpTime, tag, minRange |
| 1589 | `deathBehavior` | 9 | 0.0 % | name, shouldBeDestroyed, startSequence, endSequence, friendlyFire, minRadius, maxRadius, soundRadius |
| 1590 | `updateSeconds` | 9 | 0.0 % |  |
| 1591 | `selfRefillSpeed` | 9 | 0.0 % |  |
| 1592 | `maxCapacity` | 9 | 0.0 % |  |
| 1593 | `maxUnitCapacity` | 9 | 0.0 % |  |
| 1594 | `transferSpeed` | 9 | 0.0 % |  |
| 1595 | `gasType` | 9 | 0.0 % | __ref, name, fileName |
| 1596 | `FlashString` | 8 | 0.0 % |  |
| 1597 | `EnableFlashColourCorrection` | 8 | 0.0 % |  |
| 1598 | `OverrideMaterial` | 8 | 0.0 % |  |
| 1599 | `AspectRatio` | 8 | 0.0 % |  |
| 1600 | `MipSelectionBias` | 8 | 0.0 % |  |
| 1601 | `Active` | 8 | 0.0 % |  |
| 1602 | `EnableExposureControl` | 8 | 0.0 % |  |
| 1603 | `AcceptedRenderType` | 8 | 0.0 % |  |
| 1604 | `LightDirection` | 8 | 0.0 % | x, y, z |
| 1605 | `enableSunLight` | 8 | 0.0 % |  |
| 1606 | `SunColour` | 8 | 0.0 % | r, g, b |
| 1607 | `AmbientColour` | 8 | 0.0 % | r, g, b |
| 1608 | `SilhouetteParams` | 8 | 0.0 % | Enable, ColourSource, r, g, b, TintStrength, Brightness, EdgeWidth |
| 1609 | `EnableCubemapBackdrop` | 8 | 0.0 % |  |
| 1610 | `EnableSkyboxRendering` | 8 | 0.0 % |  |
| 1611 | `EnableLightWeightNodesRendering` | 8 | 0.0 % |  |
| 1612 | `EnableParticleRendering` | 8 | 0.0 % |  |
| 1613 | `imageSource` | 8 | 0.0 % |  |
| 1614 | `IsStaticContent` | 8 | 0.0 % |  |
| 1615 | `EnableSSDO` | 8 | 0.0 % |  |
| 1616 | `EnableSubsurfaceScattering` | 8 | 0.0 % |  |
| 1617 | `EnableTAA` | 8 | 0.0 % |  |
| 1618 | `OutputType` | 8 | 0.0 % |  |
| 1619 | `DisablePortalCulling` | 8 | 0.0 % |  |
| 1620 | `DisableVisareaCulling` | 8 | 0.0 % |  |
| 1621 | `DisableLODCulling` | 8 | 0.0 % |  |
| 1622 | `DisableTransparencySorting` | 8 | 0.0 % |  |
| 1623 | `DisableRecursiveRTTs` | 8 | 0.0 % |  |
| 1624 | `ObjectFadeDistance` | 8 | 0.0 % |  |
| 1625 | `RenderLayers` | 8 | 0.0 % |  |
| 1626 | `FriendlyFire` | 8 | 0.0 % |  |
| 1627 | `LaserVFX` | 8 | 0.0 % | path |
| 1628 | `TriggerType` | 8 | 0.0 % | LaserLength, LaserHitOffset, x, y, z, MaxRaysPerMine, Radius, WarningRadius |
| 1629 | `recipeList` | 8 | 0.0 % | __ref, name, fileName |
| 1630 | `screenPort` | 8 | 0.0 % | __weak, __instance |
| 1631 | `outputEntityPorts` | 8 | 0.0 % | __weak, __instance |
| 1632 | `containerPorts` | 8 | 0.0 % |  |
| 1633 | `itemInteractions` | 8 | 0.0 % | __weak, __instance, __ref, name, fileName |
| 1634 | `resourceInteractions` | 8 | 0.0 % | __weak, __instance, __ref, name, fileName |
| 1635 | `priority` | 7 | 0.0 % |  |
| 1636 | `noFPSWeapons` | 7 | 0.0 % |  |
| 1637 | `noFPSWeaponsSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1638 | `noShipWeapons` | 7 | 0.0 % |  |
| 1639 | `noShipWeaponsSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1640 | `noShipSelfDestruct` | 7 | 0.0 % |  |
| 1641 | `noShipSelfDestructSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1642 | `noMelee` | 7 | 0.0 % |  |
| 1643 | `noMeleeSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1644 | `noTakedown` | 7 | 0.0 % |  |
| 1645 | `noTakedownSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1646 | `walkOnly` | 7 | 0.0 % |  |
| 1647 | `walkOnlySettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1648 | `softLockFPSWeapons` | 7 | 0.0 % |  |
| 1649 | `softLockFPSWeaponsSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1650 | `unlawfulZone` | 7 | 0.0 % |  |
| 1651 | `unlawfulZoneSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1652 | `noTractorBeam` | 7 | 0.0 % |  |
| 1653 | `noTractorBeamSettings` | 7 | 0.0 % | applyInVacuum, applyInVehicles |
| 1654 | `flagsToInherit` | 7 | 0.0 % | noFPSWeapons, noShipWeapons, noShipSelfDestruct, noMelee, noTakedown, walkOnly, softLockFPSWeapons, unlawfulZone |
| 1655 | `captureStartedNotification` | 7 | 0.0 % | messagePriority, messageDuration, message |
| 1656 | `gamefeedNeutralizedStatus` | 7 | 0.0 % |  |
| 1657 | `gamefeedCapturedStatus` | 7 | 0.0 % |  |
| 1658 | `gameTokenName` | 7 | 0.0 % |  |
| 1659 | `gameTokenValue` | 7 | 0.0 % |  |
| 1660 | `affectsPhaseProgress` | 7 | 0.0 % |  |
| 1661 | `objectiveAnnouncerParams` | 7 | 0.0 % | audioSignalName, globalAnnouncementVO, teamAnnouncementVO |
| 1662 | `radiationReceiverTag` | 7 | 0.0 % | __ref, name, fileName |
| 1663 | `useRaycasts` | 7 | 0.0 % |  |
| 1664 | `toggleOnEntityHide` | 7 | 0.0 % |  |
| 1665 | `emissionRangeMinimum` | 7 | 0.0 % |  |
| 1666 | `emissionRangeMaximum` | 7 | 0.0 % |  |
| 1667 | `emissionStrength` | 7 | 0.0 % |  |
| 1668 | `falloffCurve` | 7 | 0.0 % |  |
| 1669 | `emissionRangeHeightMinimum` | 7 | 0.0 % |  |
| 1670 | `emissionRangeHeightMaximum` | 7 | 0.0 % |  |
| 1671 | `lifetimeParams` | 7 | 0.0 % | useLifetime, lifetimeLength, lifetimeCurve |
| 1672 | `iconPath` | 7 | 0.0 % |  |
| 1673 | `markerType` | 7 | 0.0 % |  |
| 1674 | `factionTag` | 7 | 0.0 % |  |
| 1675 | `activeDistanceTreshold` | 7 | 0.0 % |  |
| 1676 | `boxRadius` | 7 | 0.0 % |  |
| 1677 | `fovModifier` | 7 | 0.0 % |  |
| 1678 | `fragmentCompress` | 7 | 0.0 % |  |
| 1679 | `altitudeToExtraGears` | 7 | 0.0 % |  |
| 1680 | `allowReverseDockingRequest` | 7 | 0.0 % |  |
| 1681 | `captureInteraction` | 7 | 0.0 % | __weak, __instance |
| 1682 | `stopCaptureInteraction` | 7 | 0.0 % | __weak, __instance |
| 1683 | `capturableType` | 7 | 0.0 % |  |
| 1684 | `skipNeutral` | 7 | 0.0 % |  |
| 1685 | `instantReset` | 7 | 0.0 % |  |
| 1686 | `allowOwnerChange` | 7 | 0.0 % |  |
| 1687 | `enableOnCompleteCapture` | 7 | 0.0 % |  |
| 1688 | `allowTeamAssistBoost` | 7 | 0.0 % |  |
| 1689 | `defendersAffectInfluence` | 7 | 0.0 % |  |
| 1690 | `audioTriggerAmbienceLoop` | 7 | 0.0 % | audioTrigger |
| 1691 | `audioTriggerHackingStarted` | 7 | 0.0 % | audioTrigger |
| 1692 | `audioTriggerHackingStopped` | 7 | 0.0 % | audioTrigger |
| 1693 | `audioTriggerHackingInterrupted` | 7 | 0.0 % | audioTrigger |
| 1694 | `audioTriggerHackingStartReversal` | 7 | 0.0 % | audioTrigger |
| 1695 | `audioTriggerHackingComplete` | 7 | 0.0 % | audioTrigger |
| 1696 | `audioTriggerAttackerEnter` | 7 | 0.0 % | audioTrigger |
| 1697 | `audioTriggerAttackerExit` | 7 | 0.0 % | audioTrigger |
| 1698 | `audioTriggerDefenderEnter` | 7 | 0.0 % | audioTrigger |
| 1699 | `audioTriggerDefenderExit` | 7 | 0.0 % | audioTrigger |
| 1700 | `audioRtpcControl` | 7 | 0.0 % | rtpc |
| 1701 | `audioRtpcCaptureProcess` | 7 | 0.0 % | rtpc |
| 1702 | `audioRtpcCaptureRate` | 7 | 0.0 % | rtpc |
| 1703 | `audioRtpcAttackerCount` | 7 | 0.0 % | rtpc |
| 1704 | `audioRtpcDefenderCount` | 7 | 0.0 % | rtpc |
| 1705 | `hoverPlane` | 7 | 0.0 % | width, length, x, y, z |
| 1706 | `springs` | 7 | 0.0 % | undampedFrequency, dampingRatio, forceBlendOutDelay, forceBlendInRate, forceBlendOutRate, bumpStop, x, y |
| 1707 | `height` | 7 | 0.0 % | desiredHoverHeight, minimum, maximum, hoverHeightOffsetAcceleration, hoverHeightOffsetMaxSpeed, maxExtraHoverHeight |
| 1708 | `tilting` | 7 | 0.0 % | strafeBankFactor, forwardBackTiltFactor, turnBankFactor, x, y, useLUT |
| 1709 | `collisions` | 7 | 0.0 % | antiSpinThreshold, linearCollisionDamp, angularCollisionDamp |
| 1710 | `handling` | 7 | 0.0 % | turnFriction, selfRightingAccelBoost, hoverMaxSpeed, airControlMultiplier, antiFallMultiplier, lateralStrafeMultiplier, x, y |
| 1711 | `hoverHeightRtpc` | 7 | 0.0 % | rtpc |
| 1712 | `hoverHeightDifferentialRtpc` | 7 | 0.0 % | rtpc |
| 1713 | `chargeTime` | 7 | 0.0 % |  |
| 1714 | `distortionDamage` | 7 | 0.0 % |  |
| 1715 | `empRadius` | 7 | 0.0 % |  |
| 1716 | `minEmpRadius` | 7 | 0.0 % |  |
| 1717 | `pressure` | 7 | 0.0 % |  |
| 1718 | `unleashTime` | 7 | 0.0 % |  |
| 1719 | `ChargingParticle` | 7 | 0.0 % | path |
| 1720 | `ChargedParticle` | 7 | 0.0 % | path |
| 1721 | `ChargingTag` | 7 | 0.0 % | __ref, name, fileName |
| 1722 | `ChargedTag` | 7 | 0.0 % | __ref, name, fileName |
| 1723 | `StartChargingTrigger` | 7 | 0.0 % | __ref, name, fileName |
| 1724 | `StopChargingTrigger` | 7 | 0.0 % | __ref, name, fileName |
| 1725 | `StartChargedTrigger` | 7 | 0.0 % | __ref, name, fileName |
| 1726 | `StopChargedTrigger` | 7 | 0.0 % | __ref, name, fileName |
| 1727 | `StartUnleashTrigger` | 7 | 0.0 % | __ref, name, fileName |
| 1728 | `StopUnleashTrigger` | 7 | 0.0 % | __ref, name, fileName |
| 1729 | `chargingState` | 7 | 0.0 % | __weak, __instance |
| 1730 | `chargedState` | 7 | 0.0 % | __weak, __instance |
| 1731 | `releasingState` | 7 | 0.0 % | __weak, __instance |
| 1732 | `damage` | 7 | 0.0 % |  |
| 1733 | `minRadius` | 7 | 0.0 % |  |
| 1734 | `time` | 7 | 0.0 % |  |
| 1735 | `engageSelfDestructInteraction` | 7 | 0.0 % | __weak, __instance |
| 1736 | `disengageSelfDestructInteraction` | 7 | 0.0 % | __weak, __instance |
| 1737 | `jammerSettings` | 6 | 0.0 % | jammerRange, maxPowerDraw, greenZoneCheckRange, __weak, __instance |
| 1738 | `quantumInterdictionPulseSettings` | 6 | 0.0 % | chargeTimeSecs, dischargeTimeSecs, cooldownTimeSecs, radiusMeters, decreaseChargeRateTimeSeconds, increaseChargeRateTimeSeconds, activationPhaseDuration_seconds, disperseChargeTimeSeconds |
| 1739 | `basePowerDrawFraction` | 6 | 0.0 % |  |
| 1740 | `pulsePowerFraction` | 6 | 0.0 % |  |
| 1741 | `jammerPowerFraction` | 6 | 0.0 % |  |
| 1742 | `visualGraphParams` | 6 | 0.0 % | effectStrengthLink, fragmentName, fragmentTag, playbackBias, loop, entityEffectTag, entityEffectTrigger, strength |
| 1743 | `mainDeviceSwitchOn` | 6 | 0.0 % | __weak, __instance |
| 1744 | `mainDeviceSwitchOff` | 6 | 0.0 % | __weak, __instance |
| 1745 | `species` | 6 | 0.0 % |  |
| 1746 | `count` | 6 | 0.0 % |  |
| 1747 | `defaultFullness` | 6 | 0.0 % |  |
| 1748 | `composition` | 6 | 0.0 % | __ref, name, fileName, ratio |
| 1749 | `displayFelonies` | 6 | 0.0 % |  |
| 1750 | `displayMisdemeanors` | 6 | 0.0 % |  |
| 1751 | `warningTime` | 6 | 0.0 % |  |
| 1752 | `autoStartRemoveTime` | 6 | 0.0 % |  |
| 1753 | `removeTimeUpdateSeconds` | 6 | 0.0 % |  |
| 1754 | `unlockedByScan` | 6 | 0.0 % |  |
| 1755 | `unlockedByInteraction` | 6 | 0.0 % |  |
| 1756 | `unlockedByPickingUp` | 6 | 0.0 % |  |
| 1757 | `entriesToUnlock` | 6 | 0.0 % |  |
| 1758 | `landingCommsChannel` | 5 | 0.0 % | __ref, name, fileName |
| 1759 | `cargoCommsChannel` | 5 | 0.0 % | __ref, name, fileName |
| 1760 | `isItemBank` | 5 | 0.0 % |  |
| 1761 | `canBeLoweredWithItem` | 5 | 0.0 % |  |
| 1762 | `canBeRaisedManually` | 5 | 0.0 % |  |
| 1763 | `gearStorageCamera` | 5 | 0.0 % | __ref, name, fileName |
| 1764 | `damagePerHit` | 5 | 0.0 % | DamagePhysical, DamageEnergy, DamageDistortion, DamageThermal, DamageBiochemical, DamageStun |
| 1765 | `damageInShipScalar` | 5 | 0.0 % | DamagePhysical, DamageEnergy, DamageDistortion, DamageThermal, DamageBiochemical, DamageStun |
| 1766 | `damagePeriod` | 5 | 0.0 % |  |
| 1767 | `ignoreShields` | 5 | 0.0 % |  |
| 1768 | `useRadialFalloff` | 5 | 0.0 % |  |
| 1769 | `falloffStartRadius` | 5 | 0.0 % |  |
| 1770 | `ignoreVerticalFalloff` | 5 | 0.0 % |  |
| 1771 | `hazardAreaShape` | 5 | 0.0 % | radius, x, y, z |
| 1772 | `hazardAreaForceReaction` | 5 | 0.0 % |  |
| 1773 | `hazardRadiation` | 5 | 0.0 % |  |
| 1774 | `tagListBehavior` | 5 | 0.0 % |  |
| 1775 | `receiverTags` | 5 | 0.0 % |  |
| 1776 | `mipSelectionBias` | 5 | 0.0 % |  |
| 1777 | `PumpPercentagePerSecondPerLever` | 5 | 0.0 % |  |
| 1778 | `DecayPercentagePerSecond` | 5 | 0.0 % |  |
| 1779 | `EnabledInteractionWhenFullyCharged` | 5 | 0.0 % | __weak, __instance |
| 1780 | `CurrentChargeRTPC` | 5 | 0.0 % | rtpc |
| 1781 | `jobDescriptionLength` | 5 | 0.0 % |  |
| 1782 | `controlIntVariables` | 4 | 0.0 % |  |
| 1783 | `controlFloatVariables` | 4 | 0.0 % | name, fragmentTag, __weak, __instance, useAnimationEffectiveSection, amountToChange, animationCycle |
| 1784 | `audio` | 4 | 0.0 % | enableAudio, isManagedAudioObject, rtpc, attenuationScale, volume, audioTrigger |
| 1785 | `disabledOnStart` | 4 | 0.0 % |  |
| 1786 | `failHackOnAbort` | 4 | 0.0 % |  |
| 1787 | `generalSettingsPreset` | 4 | 0.0 % | __ref |
| 1788 | `difficultyPreset` | 4 | 0.0 % | __ref |
| 1789 | `difficultyPresetOverride` | 4 | 0.0 % | boardWidthOverride, boardHeightOverride, timelimitOverride, minSpawnPointsCountOverride, maxSpawnPointsCountOverride, defenseAlertDurationOverride, seedOverride, codeOnlyInputFlagOverride |
| 1790 | `startHackingInteraction` | 4 | 0.0 % | __weak, __instance |
| 1791 | `debugBypassHackSucceedInteraction` | 4 | 0.0 % | __weak, __instance |
| 1792 | `debugBypassHackFailInteraction` | 4 | 0.0 % | __weak, __instance |
| 1793 | `debugResetHackInteraction` | 4 | 0.0 % | __weak, __instance |
| 1794 | `onHackSucceededInteraction` | 4 | 0.0 % | __weak, __instance |
| 1795 | `onHackFailedInteraction` | 4 | 0.0 % | __weak, __instance |
| 1796 | `onHackResetInteraction` | 4 | 0.0 % | __weak, __instance |
| 1797 | `defaultItemLifetimeSeconds` | 4 | 0.0 % |  |
| 1798 | `itemPort` | 4 | 0.0 % | __weak, __instance |
| 1799 | `detachTimeSeconds` | 4 | 0.0 % |  |
| 1800 | `despawnTimeSeconds` | 4 | 0.0 % |  |
| 1801 | `cooldownSeconds` | 4 | 0.0 % |  |
| 1802 | `items` | 4 | 0.0 % | name, __ref, fileName, imagePath, cooldownSeconds, detachTimeSeconds, despawnTimeSeconds |
| 1803 | `usableGroupCoordinatorData` | 4 | 0.0 % |  |
| 1804 | `pickupInteraction` | 4 | 0.0 % | __weak, __instance |
| 1805 | `dropOffInteraction` | 4 | 0.0 % | __weak, __instance |
| 1806 | `openHatchInteraction` | 4 | 0.0 % | __weak, __instance |
| 1807 | `closeHatchInteraction` | 4 | 0.0 % | __weak, __instance |
| 1808 | `hatchOpenState` | 4 | 0.0 % | __weak, __instance |
| 1809 | `hatchClosedState` | 4 | 0.0 % | __weak, __instance |
| 1810 | `homeState` | 4 | 0.0 % | __weak, __instance |
| 1811 | `checkingState` | 4 | 0.0 % | __weak, __instance |
| 1812 | `collectPackageState` | 4 | 0.0 % | __weak, __instance |
| 1813 | `deliverPackageState` | 4 | 0.0 % | __weak, __instance |
| 1814 | `completeState` | 4 | 0.0 % | __weak, __instance |
| 1815 | `timedOutState` | 4 | 0.0 % | __weak, __instance |
| 1816 | `wrongItemState` | 4 | 0.0 % | __weak, __instance |
| 1817 | `failedRequestState` | 4 | 0.0 % | __weak, __instance |
| 1818 | `spawnTimeOutSeconds` | 4 | 0.0 % |  |
| 1819 | `requestProcessSeconds` | 4 | 0.0 % |  |
| 1820 | `waitForPickupSeconds` | 4 | 0.0 % |  |
| 1821 | `finishedPickupSeconds` | 4 | 0.0 % |  |
| 1822 | `despawnFailedPickupSeconds` | 4 | 0.0 % |  |
| 1823 | `pickUpShutterDelaySeconds` | 4 | 0.0 % |  |
| 1824 | `waitForDropOffSeconds` | 4 | 0.0 % |  |
| 1825 | `dropOffShutterDelaySeconds` | 4 | 0.0 % |  |
| 1826 | `wrongItemPickUpSeconds` | 4 | 0.0 % |  |
| 1827 | `entityLinkName` | 4 | 0.0 % |  |
| 1828 | `itemPortName` | 4 | 0.0 % |  |
| 1829 | `itemPortIndex` | 4 | 0.0 % |  |
| 1830 | `entityClipName` | 4 | 0.0 % |  |
| 1831 | `starMarineEntityClipName` | 4 | 0.0 % |  |
| 1832 | `transform` | 4 | 0.0 % | x, y, z, Scale |
| 1833 | `geometryRecord` | 4 | 0.0 % | __ref, name, fileName |
| 1834 | `starMarineGeometryRecord` | 4 | 0.0 % |  |
| 1835 | `previewWindowDimensions` | 4 | 0.0 % | x, y |
| 1836 | `scopeContext` | 4 | 0.0 % |  |
| 1837 | `alwaysVisible` | 4 | 0.0 % |  |
| 1838 | `spring` | 4 | 0.0 % | lengthTarget, lengthMin, lengthMax, stiffness, damping, springBone, x, y |
| 1839 | `offlineInventoryJSON` | 4 | 0.0 % |  |
| 1840 | `eventSignalRadius` | 4 | 0.0 % |  |
| 1841 | `specialEventManufacturer` | 4 | 0.0 % |  |
| 1842 | `franchise` | 4 | 0.0 % |  |
| 1843 | `acceptedCurrency` | 4 | 0.0 % |  |
| 1844 | `shopInventoryType` | 4 | 0.0 % |  |
| 1845 | `allowTransactionsForPlayerInventory` | 4 | 0.0 % |  |
| 1846 | `allowTransactionsForLocationInventory` | 4 | 0.0 % |  |
| 1847 | `allowTransactionsForVehicleInventory` | 4 | 0.0 % |  |
| 1848 | `superGuidOverride` | 4 | 0.0 % |  |
| 1849 | `allowSpaceships` | 3 | 0.0 % |  |
| 1850 | `allowGroundVehicles` | 3 | 0.0 % |  |
| 1851 | `allowGravLevVehicles` | 3 | 0.0 % |  |
| 1852 | `allowREC_RentedShips` | 3 | 0.0 % |  |
| 1853 | `allowUEC_RentedShips` | 3 | 0.0 % |  |
| 1854 | `setPlayerProfile` | 3 | 0.0 % |  |
| 1855 | `filterByLocation` | 3 | 0.0 % |  |
| 1856 | `attachToTile` | 3 | 0.0 % |  |
| 1857 | `controllable` | 3 | 0.0 % |  |
| 1858 | `powerRequirement` | 3 | 0.0 % |  |
| 1859 | `reactToVehicleEmergency` | 3 | 0.0 % |  |
| 1860 | `particleEffect` | 3 | 0.0 % | path |
| 1861 | `comment` | 3 | 0.0 % |  |
| 1862 | `activate` | 3 | 0.0 % |  |
| 1863 | `spawnProbability` | 3 | 0.0 % |  |
| 1864 | `primed` | 3 | 0.0 % |  |
| 1865 | `scale` | 3 | 0.0 % | value |
| 1866 | `emissionSizeScale` | 3 | 0.0 % | x, y, z |
| 1867 | `speedScale` | 3 | 0.0 % | value |
| 1868 | `timeScale` | 3 | 0.0 % | value |
| 1869 | `countScale` | 3 | 0.0 % | value |
| 1870 | `countPerUnit` | 3 | 0.0 % |  |
| 1871 | `alphaScale` | 3 | 0.0 % | value |
| 1872 | `pulsePeriod` | 3 | 0.0 % | value |
| 1873 | `externalTint` | 3 | 0.0 % |  |
| 1874 | `attachType` | 3 | 0.0 % |  |
| 1875 | `attachForm` | 3 | 0.0 % |  |
| 1876 | `registerByBbox` | 3 | 0.0 % |  |
| 1877 | `clipToVisArea` | 3 | 0.0 % |  |
| 1878 | `gpuVisAreaCullingMode` | 3 | 0.0 % |  |
| 1879 | `forceDisableShadows` | 3 | 0.0 % |  |
| 1880 | `tesselationAmount` | 3 | 0.0 % |  |
| 1881 | `attachToZone` | 3 | 0.0 % |  |
| 1882 | `gpuAudio` | 3 | 0.0 % | audioTrigger, rtpc |
| 1883 | `renderLayer` | 3 | 0.0 % |  |
| 1884 | `flowgraphPath` | 3 | 0.0 % |  |
| 1885 | `radiusKm` | 3 | 0.0 % |  |
| 1886 | `dragAreaRadius` | 3 | 0.0 % |  |
| 1887 | `centreOfPressureOffsetY` | 3 | 0.0 % |  |
| 1888 | `maximumDropAngleFromFlatFlight` | 3 | 0.0 % |  |
| 1889 | `altitudeRtpc` | 3 | 0.0 % | rtpc |
| 1890 | `maxAltitudeForAudioRtpc` | 3 | 0.0 % |  |
| 1891 | `sampleSize` | 3 | 0.0 % |  |
| 1892 | `segmentLookAhead` | 3 | 0.0 % |  |
| 1893 | `segmentDistance` | 3 | 0.0 % |  |
| 1894 | `pathLength` | 3 | 0.0 % |  |
| 1895 | `defaultAlignmentAccuracy` | 3 | 0.0 % |  |
| 1896 | `defaultAlignmentTime` | 3 | 0.0 % |  |
| 1897 | `predictionOffset` | 3 | 0.0 % | x, y, z |
| 1898 | `collisionTags` | 3 | 0.0 % |  |
| 1899 | `forceEnabled` | 3 | 0.0 % |  |
| 1900 | `hackDisableIfcsActions` | 3 | 0.0 % |  |
| 1901 | `straighteningEnabled` | 3 | 0.0 % |  |
| 1902 | `straighteningStart` | 3 | 0.0 % |  |
| 1903 | `straighteningEnd` | 3 | 0.0 % |  |
| 1904 | `pathSmoothing` | 3 | 0.0 % |  |
| 1905 | `highlightCursorWidth` | 3 | 0.0 % |  |
| 1906 | `highlightSpeedModifier` | 3 | 0.0 % |  |
| 1907 | `timeToLoop` | 3 | 0.0 % |  |
| 1908 | `gridLayerCount` | 3 | 0.0 % |  |
| 1909 | `dimensions` | 3 | 0.0 % | x, y, z |
| 1910 | `drawFarDistance` | 3 | 0.0 % |  |
| 1911 | `gridAreaHeightPerc` | 3 | 0.0 % |  |
| 1912 | `baseLineWidthPerc` | 3 | 0.0 % |  |
| 1913 | `basePaddingInnerPerc` | 3 | 0.0 % |  |
| 1914 | `baseOffset` | 3 | 0.0 % |  |
| 1915 | `gridPaddingInnerPerc` | 3 | 0.0 % |  |
| 1916 | `gridLineWidthPerc` | 3 | 0.0 % |  |
| 1917 | `gridHighlightFeatherPerc` | 3 | 0.0 % |  |
| 1918 | `gridFalloffPerc` | 3 | 0.0 % |  |
| 1919 | `baseLineMaterial` | 3 | 0.0 % |  |
| 1920 | `beamMaterial` | 3 | 0.0 % |  |
| 1921 | `gridLineMaterial` | 3 | 0.0 % |  |
| 1922 | `cuttableShapeParams` | 3 | 0.0 % | cutMargin, autoCompleteThreshold, meleeCompleteThreshold, segmentsPerLine |
| 1923 | `clientParams` | 2 | 0.0 % | x, y, z, scale, angle, tilt, __ref, name |
| 1924 | `remoteParams` | 2 | 0.0 % | x, y, z, scale, angle, tilt, procBreathingSetup, materialGlow |
| 1925 | `effectSettings` | 2 | 0.0 % | projectionFadeInDuration, projectionFadeOutDuration |
| 1926 | `navigationType` | 2 | 0.0 % |  |
| 1927 | `minimapAspectRatioOnLens` | 2 | 0.0 % |  |
| 1928 | `minimapAspectRatioOnVisor` | 2 | 0.0 % |  |
| 1929 | `inheritVehicleStyle` | 2 | 0.0 % |  |
| 1930 | `inheritHelmetStyle` | 2 | 0.0 % |  |
| 1931 | `animateHandover` | 2 | 0.0 % |  |
| 1932 | `defaultVisorStyle` | 2 | 0.0 % | __ref, name, fileName |
| 1933 | `minimalModeTags` | 2 | 0.0 % | __ref, name, fileName |
| 1934 | `displayModeTags` | 2 | 0.0 % | __ref, name, fileName |
| 1935 | `boxout` | 2 | 0.0 % | maxLifetime, maxTargetedLifetime, outroTime, edgeTransitionTime, transitionCooldownTime, edgeBounds, maxPreviews, fpsPreviewZoneSize |
| 1936 | `clipBoundTopLeft` | 2 | 0.0 % | x, y |
| 1937 | `clipBoundTopLeftVehicle` | 2 | 0.0 % | x, y |
| 1938 | `clipBoundBottomRight` | 2 | 0.0 % | x, y |
| 1939 | `clipBoundBottomRightVehicle` | 2 | 0.0 % | x, y |
| 1940 | `aspectRatioVehicle` | 2 | 0.0 % |  |
| 1941 | `clipRadius` | 2 | 0.0 % |  |
| 1942 | `clipRadiusVehicle` | 2 | 0.0 % |  |
| 1943 | `offEnvironmentProbeScale` | 2 | 0.0 % |  |
| 1944 | `auxiliaryWhenDisabled` | 2 | 0.0 % |  |
| 1945 | `affectedByDayNight` | 2 | 0.0 % |  |
| 1946 | `attachViaObjectLink` | 2 | 0.0 % |  |
| 1947 | `nightTimeState` | 2 | 0.0 % |  |
| 1948 | `dayTimeState` | 2 | 0.0 % |  |
| 1949 | `currentState` | 2 | 0.0 % |  |
| 1950 | `lightStateFallbacks` | 2 | 0.0 % |  |
| 1951 | `lightStatePresets` | 2 | 0.0 % |  |
| 1952 | `lightStateOverrides` | 2 | 0.0 % |  |
| 1953 | `useLightItems` | 2 | 0.0 % |  |
| 1954 | `lightItems` | 2 | 0.0 % |  |
| 1955 | `clipboxItems` | 2 | 0.0 % |  |
| 1956 | `envLightItems` | 2 | 0.0 % |  |
| 1957 | `OpenAllInteraction` | 2 | 0.0 % | __weak, __instance |
| 1958 | `HalfOpenAllInteraction` | 2 | 0.0 % | __weak, __instance |
| 1959 | `CloseAllInteraction` | 2 | 0.0 % | __weak, __instance |
| 1960 | `LockAllInteraction` | 2 | 0.0 % | __weak, __instance |
| 1961 | `UnlockAllInteraction` | 2 | 0.0 % | __weak, __instance |
| 1962 | `ignorePhases` | 2 | 0.0 % |  |
| 1963 | `remainActive` | 2 | 0.0 % |  |
| 1964 | `jumpThrusterPackConfig` | 2 | 0.0 % | __ref, name, fileName |
| 1965 | `thrusterEffectParams` | 2 | 0.0 % | maxStrengthTime, backwashDistance |
| 1966 | `canvas` | 2 | 0.0 % | __ref, name, fileName |
| 1967 | `decalParams` | 2 | 0.0 % | path, sortPriority, viewDistanceRatio, affectsThisAreaOnly, alphaCutoff, x, y, z |
| 1968 | `fuelFlowRateAudioRtpcs` | 2 | 0.0 % | rtpc |
| 1969 | `fuelSpillAudioRtpc` | 2 | 0.0 % | rtpc |
| 1970 | `stateToPowerOff` | 2 | 0.0 % | __weak, __instance |
| 1971 | `PowerBase` | 2 | 0.0 % |  |
| 1972 | `PowerDraw` | 2 | 0.0 % |  |
| 1973 | `TimeToReachDrawRequest` | 2 | 0.0 % |  |
| 1974 | `SafeguardPriority` | 2 | 0.0 % |  |
| 1975 | `DisplayedInPoweredItemList` | 2 | 0.0 % |  |
| 1976 | `IsThrottleable` | 2 | 0.0 % |  |
| 1977 | `IsOverclockable` | 2 | 0.0 % |  |
| 1978 | `OverclockThresholdMin` | 2 | 0.0 % |  |
| 1979 | `OverclockThresholdMax` | 2 | 0.0 % |  |
| 1980 | `OverpowerPerformance` | 2 | 0.0 % |  |
| 1981 | `OverclockPerformance` | 2 | 0.0 % |  |
| 1982 | `PowerToEM` | 2 | 0.0 % |  |
| 1983 | `DecayRateOfEM` | 2 | 0.0 % |  |
| 1984 | `WarningDelayTime` | 2 | 0.0 % |  |
| 1985 | `WarningDisplayTime` | 2 | 0.0 % |  |
| 1986 | `MisfireItemTypeLocID` | 2 | 0.0 % |  |
| 1987 | `MisfireGenerationParams` | 2 | 0.0 % |  |
| 1988 | `MisfireEvents` | 2 | 0.0 % |  |
| 1989 | `ejectParams` | 2 | 0.0 % | x, y, z, impulseStrength, portName, __ref, name, fileName |
| 1990 | `inventoryItemsPerPage` | 1 | 0.0 % |  |
| 1991 | `inventoryPaintGeoTag` | 1 | 0.0 % |  |
| 1992 | `accountSearchDelayInMilliSeconds` | 1 | 0.0 % |  |
| 1993 | `ableToJoinPartyServerPopUpMenuOptionText` | 1 | 0.0 % |  |
| 1994 | `notAbleToJoinPartyServerPopUpMenuOptionText` | 1 | 0.0 % |  |
| 1995 | `notAbleToJoinPartyStowedOnServerPopUpMenuOptionText` | 1 | 0.0 % |  |
| 1996 | `leavePartyPopUpMenuOptionText` | 1 | 0.0 % |  |
| 1997 | `disbandPartyPopUpMenuOptionText` | 1 | 0.0 % |  |
| 1998 | `transferLeadershipToPartyMemberPopUpMenuOptionText` | 1 | 0.0 % |  |
| 1999 | `kickPartyMemberPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2000 | `sendFriendRequestToPartyMemberPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2001 | `inviteToPartyPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2002 | `ableToJoinFriendServerPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2003 | `notAbleToJoinFriendServerPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2004 | `removeFriendPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2005 | `inviteToLobbyPopUpMenuOptionText` | 1 | 0.0 % |  |
| 2006 | `maximumScreenSizeRatio` | 1 | 0.0 % |  |
| 2007 | `noShieldScaleAdjustment` | 1 | 0.0 % |  |
| 2008 | `allChannelText` | 1 | 0.0 % |  |
| 2009 | `settings` | 1 | 0.0 % |  |
| 2010 | `shield` | 1 | 0.0 % |  |
| 2011 | `startupVFX` | 1 | 0.0 % |  |
| 2012 | `destroyedVFX` | 1 | 0.0 % |  |
| 2013 | `openAnim` | 1 | 0.0 % |  |
| 2014 | `closedAnim` | 1 | 0.0 % |  |
| 2015 | `audioCommsEffectOverride` | 1 | 0.0 % |  |
| 2016 | `baseXOffset` | 1 | 0.0 % |  |
| 2017 | `baseXOffsetMultiplier` | 1 | 0.0 % |  |
| 2018 | `baseYOffset` | 1 | 0.0 % |  |
| 2019 | `baseYOffsetMultiplier` | 1 | 0.0 % |  |
| 2020 | `baseXAngleMultiplier` | 1 | 0.0 % |  |
| 2021 | `baseYAngleMultiplier` | 1 | 0.0 % |  |
| 2022 | `interactions` | 1 | 0.0 % |  |
| 2023 | `onInitDefaultActive` | 1 | 0.0 % |  |
| 2024 | `selectRandomRewardInteraction` | 1 | 0.0 % | __weak, __instance |
| 2025 | `claimInteraction` | 1 | 0.0 % | __weak, __instance |
| 2026 | `retrieveInteraction` | 1 | 0.0 % | __weak, __instance |
| 2027 | `cleanupInteraction` | 1 | 0.0 % | __weak, __instance |
| 2028 | `allowCleanupInSameRevolution` | 1 | 0.0 % |  |
| 2029 | `missionScenario` | 1 | 0.0 % | __ref, name, fileName |
| 2030 | `rewardPool` | 1 | 0.0 % | __ref, name, fileName, weight |
| 2031 | `minAssignment` | 1 | 0.0 % |  |
| 2032 | `maxAssignment` | 1 | 0.0 % |  |
| 2033 | `broken` | 1 | 0.0 % |  |
| 2034 | `damping` | 1 | 0.0 % |  |
| 2035 | `noSelfCollisions` | 1 | 0.0 % |  |
| 2036 | `useEntityFrame` | 1 | 0.0 % |  |
| 2037 | `maxPullForce` | 1 | 0.0 % |  |
| 2038 | `maxBendTorque` | 1 | 0.0 % |  |
| 2039 | `constrainToLine` | 1 | 0.0 % |  |
| 2040 | `constrainToPlane` | 1 | 0.0 % |  |
| 2041 | `constrainFully` | 1 | 0.0 % |  |
| 2042 | `noRotation` | 1 | 0.0 % |  |
| 2043 | `xMin` | 1 | 0.0 % |  |
| 2044 | `xMax` | 1 | 0.0 % |  |
| 2045 | `yzMax` | 1 | 0.0 % |  |
| 2046 | `xTranslationalCompliance` | 1 | 0.0 % |  |
| 2047 | `yzTranslationalCompliance` | 1 | 0.0 % |  |
| 2048 | `xTranslationalDampingRate` | 1 | 0.0 % |  |
| 2049 | `yzTranslationalDampingRate` | 1 | 0.0 % |  |
| 2050 | `xRotationalCompliance` | 1 | 0.0 % |  |
| 2051 | `yzRotationalCompliance` | 1 | 0.0 % |  |
| 2052 | `xRotationalDampingRate` | 1 | 0.0 % |  |
| 2053 | `yzRotationalDampingRate` | 1 | 0.0 % |  |
| 2054 | `targetRelativePosition` | 1 | 0.0 % | x, y, z |
| 2055 | `targetRelativeRotation` | 1 | 0.0 % | x, y, z |
| 2056 | `targetRelativeLinearVelocity` | 1 | 0.0 % | x, y, z |
| 2057 | `maxMotorForceLin` | 1 | 0.0 % |  |
| 2058 | `linearMotorInviscosityCoefficient` | 1 | 0.0 % | x, y, z |
| 2059 | `targetRelativeAngularVelocity` | 1 | 0.0 % | x, y, z |
| 2060 | `maxMotorForceAng` | 1 | 0.0 % |  |
| 2061 | `angularMotorInviscosityCoefficient` | 1 | 0.0 % | x, y, z |
| 2062 | `message` | 1 | 0.0 % |  |
| 2063 | `ThermalConductivity` | 1 | 0.0 % |  |
| 2064 | `ThermalEmissivity` | 1 | 0.0 % |  |
| 2065 | `SpecificHeatCapacity` | 1 | 0.0 % |  |
| 2066 | `Mass` | 1 | 0.0 % |  |
| 2067 | `SurfaceArea` | 1 | 0.0 % |  |
| 2068 | `repairAvailable` | 1 | 0.0 % |  |
| 2069 | `useZoneServicing` | 1 | 0.0 % |  |
| 2070 | `allowHostile` | 1 | 0.0 % |  |
| 2071 | `usingRequireBeingLanded` | 1 | 0.0 % |  |
| 2072 | `servicesClass` | 1 | 0.0 % | __ref, name, fileName |
| 2073 | `hailTargetInteraction` | 1 | 0.0 % | __weak, __instance |
| 2074 | `acceptIncomingCallInteraction` | 1 | 0.0 % | __weak, __instance |
| 2075 | `declineIncomingCallInteraction` | 1 | 0.0 % | __weak, __instance |
| 2076 | `hangUpCallInteraction` | 1 | 0.0 % | __weak, __instance |
| 2077 | `holoVolumeType` | 1 | 0.0 % |  |
| 2078 | `holoRenderType` | 1 | 0.0 % |  |
| 2079 | `objectFadeDist` | 1 | 0.0 % |  |
| 2080 | `sphereVolume` | 1 | 0.0 % | radius |
| 2081 | `cubeVolume` | 1 | 0.0 % | sizeX, sizeY, sizeZ |
| 2082 | `controlledByComms` | 1 | 0.0 % |  |
| 2083 | `visualState` | 1 | 0.0 % | wear, dirt, interference, damage |
| 2084 | `enableSSDO` | 1 | 0.0 % |  |
| 2085 | `enableSubsurfaceScattering` | 1 | 0.0 % |  |
| 2086 | `enableTAA` | 1 | 0.0 % |  |
| 2087 | `physicalInterference` | 1 | 0.0 % |  |
| 2088 | `interferenceAmountRTPC` | 1 | 0.0 % | rtpc |
| 2089 | `interferenceStartedAudioTrigger` | 1 | 0.0 % | audioTrigger |
| 2090 | `interferenceStoppedAudioTrigger` | 1 | 0.0 % | audioTrigger |
| 2091 | `pipe` | 1 | 0.0 % |  |
| 2092 | `distortionQuantityMessage` | 1 | 0.0 % |  |
| 2093 | `powerShuttingDownMessage` | 1 | 0.0 % |  |
| 2094 | `shuttingDownMessageDuration` | 1 | 0.0 % |  |
| 2095 | `lightningEffect` | 1 | 0.0 % |  |
| 2096 | `activeGeneration` | 1 | 0.0 % |  |
| 2097 | `strikeControls` | 1 | 0.0 % | minimum, maximum, scaleMultiplier, intensity, strength |
| 2098 | `spawnShape` | 1 | 0.0 % | offsetToPlanetClouds, applyScaleMultiplier, x, y, z, radius |
| 2099 | `targeting` | 1 | 0.0 % | enable, minimum, maximum, scaleMultiplier, intensity, strength, strikeReferenceVolumeSize, targetPlanetSurface |
| 2100 | `unifiedShakeParams` | 1 | 0.0 % | __ref, name, fileName |
| 2101 | `distanceIntensityCurve` | 1 | 0.0 % | __ref, name, fileName |
| 2102 | `visualFieldProfile` | 1 | 0.0 % | __ref, name, fileName |
| 2103 | `filterProfile` | 1 | 0.0 % | __ref, name, fileName |
| 2104 | `adapter` | 1 | 0.0 % | helperName, x, y, z |
| 2105 | `startTrigger` | 1 | 0.0 % | audioTrigger |
| 2106 | `stopTrigger` | 1 | 0.0 % | audioTrigger |
| 2107 | `openSplineEvent` | 1 | 0.0 % |  |
| 2108 | `closeSplineEvent` | 1 | 0.0 % |  |
| 2109 | `environmentFadeDistance` | 1 | 0.0 % |  |
| 2110 | `fadeDistance` | 1 | 0.0 % |  |