// AUTO-GENERATED-FRIENDLY medication library for the Kotoba FCA report tool.
// Sourced from the original picker design (~210 commonly prescribed AU medications).
// This file is a typed TS module re-export of MEDICATION_LIBRARY plus shared
// frequency/admin-aid presets used by MedicationPicker.

export interface MedicationLibraryEntry {
  id: string;
  generic: string;
  brands: string[];
  drugClass: string;
  category: string;
  defaultStrength: string;
  defaultQuantity: string;
  defaultFrequency: string;
  commonIndication: string;
  route: string;
  isCustom?: boolean;
}

// MedicationInstance = a library entry that has been added to a participant's
// medication list. Carries its own per-instance UUID so the same drug can be
// added more than once (e.g. PRN + scheduled dose), plus per-participant
// fields (chosen brand, strength, quantity, frequency, timing, indication,
// administration aid, clinical notes).
export interface MedicationInstance extends MedicationLibraryEntry {
  instanceId: string;
  chosenBrand: string;
  strength: string;
  quantity: string;
  frequency: string;
  timing: string;
  indication: string;
  adminAid: string;
  notes: string;
}

export const MEDICATION_LIBRARY: MedicationLibraryEntry[] = [
const MEDICATION_LIBRARY = [
  // ═══════════════════════════════════════════
  // ANTIPSYCHOTICS
  // ═══════════════════════════════════════════
  { id: "med_clozapine", generic: "Clozapine", brands: ["Clopine", "Clozaril"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Treatment-resistant schizophrenia", route: "Oral" },
  { id: "med_olanzapine", generic: "Olanzapine", brands: ["Zyprexa", "Zypine", "Lanzek"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Schizophrenia; bipolar disorder", route: "Oral" },
  { id: "med_olanzapine_depot", generic: "Olanzapine depot", brands: ["Zyprexa Relprevv"], drugClass: "Atypical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "300mg", defaultQuantity: "1 injection", defaultFrequency: "Fortnightly", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_risperidone", generic: "Risperidone", brands: ["Risperdal", "Rispa"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "2mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; bipolar disorder; behavioural disturbance", route: "Oral" },
  { id: "med_risperidone_depot", generic: "Risperidone depot", brands: ["Risperdal Consta"], drugClass: "Atypical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "37.5mg", defaultQuantity: "1 injection", defaultFrequency: "Fortnightly", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_paliperidone_oral", generic: "Paliperidone (oral)", brands: ["Invega"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "6mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Schizophrenia; schizoaffective disorder", route: "Oral" },
  { id: "med_paliperidone_depot_monthly", generic: "Paliperidone palmitate (monthly)", brands: ["Invega Sustenna"], drugClass: "Atypical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "100mg", defaultQuantity: "1 injection", defaultFrequency: "Monthly", commonIndication: "Schizophrenia; schizoaffective disorder (maintenance)", route: "IM injection" },
  { id: "med_paliperidone_depot_3monthly", generic: "Paliperidone palmitate (3-monthly)", brands: ["Invega Trinza"], drugClass: "Atypical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "350mg", defaultQuantity: "1 injection", defaultFrequency: "Every 3 months", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_quetiapine_ir", generic: "Quetiapine (immediate-release)", brands: ["Seroquel", "Tepine"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; bipolar; adjunct depression; insomnia (off-label)", route: "Oral" },
  { id: "med_quetiapine_xr", generic: "Quetiapine XR (modified-release)", brands: ["Seroquel XR", "Quetia-XR"], drugClass: "Atypical antipsychotic (modified-release)", category: "Antipsychotic", defaultStrength: "400mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Schizophrenia; bipolar disorder", route: "Oral" },
  { id: "med_aripiprazole", generic: "Aripiprazole", brands: ["Abilify", "Aripiprazole Sandoz"], drugClass: "Atypical antipsychotic (partial dopamine agonist)", category: "Antipsychotic", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Schizophrenia; bipolar disorder; adjunct depression", route: "Oral" },
  { id: "med_aripiprazole_depot", generic: "Aripiprazole depot", brands: ["Abilify Maintena"], drugClass: "Atypical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "400mg", defaultQuantity: "1 injection", defaultFrequency: "Monthly", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_brexpiprazole", generic: "Brexpiprazole", brands: ["Rexulti"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "2mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Schizophrenia; adjunct major depression", route: "Oral" },
  { id: "med_lurasidone", generic: "Lurasidone", brands: ["Latuda"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (with food)", commonIndication: "Schizophrenia; bipolar depression", route: "Oral" },
  { id: "med_asenapine", generic: "Asenapine", brands: ["Saphris"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "5mg", defaultQuantity: "1 sublingual tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; bipolar mania", route: "Sublingual" },
  { id: "med_cariprazine", generic: "Cariprazine", brands: ["Reagila"], drugClass: "Atypical antipsychotic (partial dopamine agonist)", category: "Antipsychotic", defaultStrength: "1.5mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Schizophrenia", route: "Oral" },
  { id: "med_ziprasidone", generic: "Ziprasidone", brands: ["Zeldox"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "40mg", defaultQuantity: "1 capsule", defaultFrequency: "Twice daily (with food)", commonIndication: "Schizophrenia; bipolar mania", route: "Oral" },
  { id: "med_amisulpride", generic: "Amisulpride", brands: ["Solian"], drugClass: "Atypical antipsychotic", category: "Antipsychotic", defaultStrength: "200mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia (positive and negative symptoms)", route: "Oral" },
  { id: "med_haloperidol", generic: "Haloperidol", brands: ["Serenace", "Haldol"], drugClass: "Typical antipsychotic", category: "Antipsychotic", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; acute psychosis; severe agitation", route: "Oral" },
  { id: "med_haloperidol_depot", generic: "Haloperidol decanoate", brands: ["Haldol Depot"], drugClass: "Typical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "100mg", defaultQuantity: "1 injection", defaultFrequency: "Every 4 weeks", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_chlorpromazine", generic: "Chlorpromazine", brands: ["Largactil"], drugClass: "Typical antipsychotic (low potency)", category: "Antipsychotic", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Schizophrenia; severe agitation; intractable hiccups", route: "Oral" },
  { id: "med_trifluoperazine", generic: "Trifluoperazine", brands: ["Stelazine"], drugClass: "Typical antipsychotic (high potency)", category: "Antipsychotic", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; severe anxiety (short-term)", route: "Oral" },
  { id: "med_fluphenazine_depot", generic: "Fluphenazine decanoate", brands: ["Modecate"], drugClass: "Typical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "25mg", defaultQuantity: "1 injection", defaultFrequency: "Every 2-4 weeks", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_zuclopenthixol", generic: "Zuclopenthixol", brands: ["Clopixol"], drugClass: "Typical antipsychotic", category: "Antipsychotic", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; acute psychosis", route: "Oral" },
  { id: "med_zuclopenthixol_depot", generic: "Zuclopenthixol decanoate", brands: ["Clopixol Depot"], drugClass: "Typical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "200mg", defaultQuantity: "1 injection", defaultFrequency: "Every 2-4 weeks", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_pericyazine", generic: "Pericyazine", brands: ["Neulactil"], drugClass: "Typical antipsychotic", category: "Antipsychotic", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Schizophrenia; behavioural disturbance", route: "Oral" },
  { id: "med_flupentixol", generic: "Flupentixol decanoate", brands: ["Fluanxol"], drugClass: "Typical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "40mg", defaultQuantity: "1 injection", defaultFrequency: "Every 2-4 weeks", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },
  { id: "med_pipothiazine", generic: "Pipothiazine palmitate", brands: ["Piportil"], drugClass: "Typical antipsychotic (long-acting injectable)", category: "Antipsychotic", defaultStrength: "50mg", defaultQuantity: "1 injection", defaultFrequency: "Every 4 weeks", commonIndication: "Schizophrenia (maintenance)", route: "IM injection" },

  // ═══════════════════════════════════════════
  // ANTIDEPRESSANTS
  // ═══════════════════════════════════════════
  { id: "med_sertraline", generic: "Sertraline", brands: ["Zoloft", "Eleva", "Setrona"], drugClass: "SSRI", category: "Antidepressant", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Depression; anxiety; OCD; PTSD", route: "Oral" },
  { id: "med_fluoxetine", generic: "Fluoxetine", brands: ["Prozac", "Lovan", "Zactin"], drugClass: "SSRI", category: "Antidepressant", defaultStrength: "20mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily (mane)", commonIndication: "Depression; OCD; bulimia; PMDD", route: "Oral" },
  { id: "med_escitalopram", generic: "Escitalopram", brands: ["Lexapro", "Esipram", "Loxalate"], drugClass: "SSRI", category: "Antidepressant", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Depression; generalised anxiety; panic disorder", route: "Oral" },
  { id: "med_citalopram", generic: "Citalopram", brands: ["Cipramil", "Celapram", "Talam"], drugClass: "SSRI", category: "Antidepressant", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Depression; panic disorder", route: "Oral" },
  { id: "med_paroxetine", generic: "Paroxetine", brands: ["Aropax", "Extine"], drugClass: "SSRI", category: "Antidepressant", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Depression; OCD; panic; social anxiety; PTSD", route: "Oral" },
  { id: "med_fluvoxamine", generic: "Fluvoxamine", brands: ["Luvox", "Faverin"], drugClass: "SSRI", category: "Antidepressant", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "OCD; depression", route: "Oral" },
  { id: "med_venlafaxine", generic: "Venlafaxine XR", brands: ["Efexor XR", "Elaxine SR"], drugClass: "SNRI", category: "Antidepressant", defaultStrength: "75mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Depression; generalised anxiety; panic disorder", route: "Oral" },
  { id: "med_desvenlafaxine", generic: "Desvenlafaxine", brands: ["Pristiq", "Desfax"], drugClass: "SNRI", category: "Antidepressant", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Major depressive disorder", route: "Oral" },
  { id: "med_duloxetine", generic: "Duloxetine", brands: ["Cymbalta", "Andepra"], drugClass: "SNRI", category: "Antidepressant", defaultStrength: "60mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Depression; generalised anxiety; neuropathic pain; chronic pain", route: "Oral" },
  { id: "med_mirtazapine", generic: "Mirtazapine", brands: ["Avanza", "Remeron", "Mirtazon"], drugClass: "Tetracyclic antidepressant", category: "Antidepressant", defaultStrength: "30mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression; depression with insomnia/poor appetite", route: "Oral" },
  { id: "med_agomelatine", generic: "Agomelatine", brands: ["Valdoxan"], drugClass: "Melatonergic antidepressant", category: "Antidepressant", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Major depressive disorder", route: "Oral" },
  { id: "med_vortioxetine", generic: "Vortioxetine", brands: ["Brintellix"], drugClass: "Multimodal antidepressant", category: "Antidepressant", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Major depressive disorder", route: "Oral" },
  { id: "med_reboxetine", generic: "Reboxetine", brands: ["Edronax"], drugClass: "NRI", category: "Antidepressant", defaultStrength: "4mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Major depressive disorder", route: "Oral" },
  { id: "med_mianserin", generic: "Mianserin", brands: ["Tolvon", "Lumin"], drugClass: "Tetracyclic antidepressant", category: "Antidepressant", defaultStrength: "30mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression", route: "Oral" },
  { id: "med_amitriptyline", generic: "Amitriptyline", brands: ["Endep"], drugClass: "Tricyclic antidepressant (TCA)", category: "Antidepressant", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression; neuropathic pain; migraine prophylaxis; insomnia", route: "Oral" },
  { id: "med_nortriptyline", generic: "Nortriptyline", brands: ["Allegron", "Nortriptyline"], drugClass: "Tricyclic antidepressant (TCA)", category: "Antidepressant", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression; neuropathic pain", route: "Oral" },
  { id: "med_clomipramine", generic: "Clomipramine", brands: ["Anafranil", "Placil"], drugClass: "Tricyclic antidepressant (TCA)", category: "Antidepressant", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "OCD; depression", route: "Oral" },
  { id: "med_imipramine", generic: "Imipramine", brands: ["Tofranil"], drugClass: "Tricyclic antidepressant (TCA)", category: "Antidepressant", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression; nocturnal enuresis", route: "Oral" },
  { id: "med_doxepin", generic: "Doxepin", brands: ["Sinequan", "Deptran"], drugClass: "Tricyclic antidepressant (TCA)", category: "Antidepressant", defaultStrength: "25mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression; chronic urticaria; insomnia", route: "Oral" },
  { id: "med_dothiepin", generic: "Dothiepin (dosulepin)", brands: ["Dothep", "Prothiaden"], drugClass: "Tricyclic antidepressant (TCA)", category: "Antidepressant", defaultStrength: "75mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression", route: "Oral" },
  { id: "med_phenelzine", generic: "Phenelzine", brands: ["Nardil"], drugClass: "MAOI (irreversible)", category: "Antidepressant", defaultStrength: "15mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Treatment-resistant depression; atypical depression", route: "Oral" },
  { id: "med_tranylcypromine", generic: "Tranylcypromine", brands: ["Parnate"], drugClass: "MAOI (irreversible)", category: "Antidepressant", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Treatment-resistant depression", route: "Oral" },
  { id: "med_moclobemide", generic: "Moclobemide", brands: ["Aurorix", "Amira"], drugClass: "RIMA (reversible MAOI)", category: "Antidepressant", defaultStrength: "150mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Depression; social anxiety", route: "Oral" },
  { id: "med_esketamine", generic: "Esketamine (intranasal)", brands: ["Spravato"], drugClass: "NMDA receptor antagonist", category: "Antidepressant", defaultStrength: "56mg", defaultQuantity: "2 sprays per nostril", defaultFrequency: "Twice weekly (induction)", commonIndication: "Treatment-resistant depression (clinic-administered)", route: "Intranasal" },
  { id: "med_trazodone", generic: "Trazodone", brands: ["Molipaxin", "Trittico"], drugClass: "Serotonin antagonist and reuptake inhibitor", category: "Antidepressant", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Depression; insomnia (off-label)", route: "Oral" },

  // ═══════════════════════════════════════════
  // MOOD STABILISERS / ANTI-EPILEPTICS
  // ═══════════════════════════════════════════
  { id: "med_lithium", generic: "Lithium carbonate", brands: ["Lithicarb", "Quilonum SR"], drugClass: "Mood stabiliser", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "250mg", defaultQuantity: "2 tablets", defaultFrequency: "Twice daily (BD)", commonIndication: "Bipolar disorder; treatment-resistant depression (adjunct)", route: "Oral" },
  { id: "med_sodium_valproate", generic: "Sodium valproate", brands: ["Epilim", "Valpro"], drugClass: "Anti-epileptic / mood stabiliser", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "500mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy; bipolar disorder; migraine prophylaxis", route: "Oral" },
  { id: "med_carbamazepine", generic: "Carbamazepine", brands: ["Tegretol", "Teril"], drugClass: "Anti-epileptic / mood stabiliser", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "200mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy; bipolar disorder; trigeminal neuralgia", route: "Oral" },
  { id: "med_lamotrigine", generic: "Lamotrigine", brands: ["Lamictal", "Lamidus"], drugClass: "Anti-epileptic / mood stabiliser", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Bipolar depression maintenance; epilepsy", route: "Oral" },
  { id: "med_oxcarbazepine", generic: "Oxcarbazepine", brands: ["Trileptal"], drugClass: "Anti-epileptic / mood stabiliser", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "300mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy; bipolar disorder (off-label)", route: "Oral" },
  { id: "med_topiramate", generic: "Topiramate", brands: ["Topamax", "Epiramax"], drugClass: "Anti-epileptic", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy; migraine prophylaxis", route: "Oral" },
  { id: "med_levetiracetam", generic: "Levetiracetam", brands: ["Keppra", "Levitaccord"], drugClass: "Anti-epileptic", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "500mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy (focal and generalised seizures)", route: "Oral" },
  { id: "med_phenytoin", generic: "Phenytoin", brands: ["Dilantin"], drugClass: "Anti-epileptic", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "100mg", defaultQuantity: "1 capsule", defaultFrequency: "Three times daily (TDS)", commonIndication: "Epilepsy", route: "Oral" },
  { id: "med_gabapentin", generic: "Gabapentin", brands: ["Neurontin", "Gantin"], drugClass: "Anti-epileptic / neuropathic pain", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "300mg", defaultQuantity: "1 capsule", defaultFrequency: "Three times daily (TDS)", commonIndication: "Neuropathic pain; epilepsy", route: "Oral" },
  { id: "med_pregabalin", generic: "Pregabalin", brands: ["Lyrica", "Pregabalin Sandoz"], drugClass: "Anti-epileptic / neuropathic pain", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "75mg", defaultQuantity: "1 capsule", defaultFrequency: "Twice daily (BD)", commonIndication: "Neuropathic pain; generalised anxiety; epilepsy", route: "Oral" },
  { id: "med_phenobarbitone", generic: "Phenobarbitone", brands: ["Phenobarb"], drugClass: "Anti-epileptic (barbiturate)", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "30mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy", route: "Oral" },
  { id: "med_perampanel", generic: "Perampanel", brands: ["Fycompa"], drugClass: "Anti-epileptic", category: "Mood Stabiliser / Anti-epileptic", defaultStrength: "4mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Epilepsy (adjunctive)", route: "Oral" },

  // ═══════════════════════════════════════════
  // ANXIOLYTICS & SEDATIVES
  // ═══════════════════════════════════════════
  { id: "med_diazepam", generic: "Diazepam", brands: ["Valium", "Ducene", "Antenex"], drugClass: "Benzodiazepine (long-acting)", category: "Anxiolytic / Sedative", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "PRN (as needed)", commonIndication: "Acute anxiety; muscle spasm; alcohol withdrawal; seizures", route: "Oral" },
  { id: "med_oxazepam", generic: "Oxazepam", brands: ["Serepax", "Murelax"], drugClass: "Benzodiazepine (short-acting)", category: "Anxiolytic / Sedative", defaultStrength: "15mg", defaultQuantity: "1 tablet", defaultFrequency: "PRN (as needed)", commonIndication: "Anxiety; alcohol withdrawal", route: "Oral" },
  { id: "med_temazepam", generic: "Temazepam", brands: ["Normison", "Temaze", "Euhypnos"], drugClass: "Benzodiazepine (hypnotic)", category: "Anxiolytic / Sedative", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "PRN (nocte)", commonIndication: "Short-term insomnia", route: "Oral" },
  { id: "med_lorazepam", generic: "Lorazepam", brands: ["Ativan"], drugClass: "Benzodiazepine (intermediate-acting)", category: "Anxiolytic / Sedative", defaultStrength: "1mg", defaultQuantity: "1 tablet", defaultFrequency: "PRN (as needed)", commonIndication: "Anxiety; pre-medication; status epilepticus", route: "Oral" },
  { id: "med_clonazepam", generic: "Clonazepam", brands: ["Rivotril", "Paxam"], drugClass: "Benzodiazepine / anti-epileptic", category: "Anxiolytic / Sedative", defaultStrength: "0.5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Epilepsy; panic disorder", route: "Oral" },
  { id: "med_alprazolam", generic: "Alprazolam", brands: ["Xanax", "Kalma", "Alprax"], drugClass: "Benzodiazepine (short-acting)", category: "Anxiolytic / Sedative", defaultStrength: "0.5mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Panic disorder (Schedule 8 in Australia)", route: "Oral" },
  { id: "med_bromazepam", generic: "Bromazepam", brands: ["Lexotan"], drugClass: "Benzodiazepine", category: "Anxiolytic / Sedative", defaultStrength: "3mg", defaultQuantity: "1 tablet", defaultFrequency: "PRN (as needed)", commonIndication: "Anxiety", route: "Oral" },
  { id: "med_nitrazepam", generic: "Nitrazepam", brands: ["Mogadon", "Alodorm"], drugClass: "Benzodiazepine (hypnotic)", category: "Anxiolytic / Sedative", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "PRN (nocte)", commonIndication: "Insomnia", route: "Oral" },
  { id: "med_midazolam", generic: "Midazolam", brands: ["Hypnovel", "Versed"], drugClass: "Benzodiazepine (ultra short-acting)", category: "Anxiolytic / Sedative", defaultStrength: "5mg", defaultQuantity: "1 ampoule", defaultFrequency: "PRN (as needed)", commonIndication: "Procedural sedation; status epilepticus; palliative care", route: "IM/SC/IV injection" },
  { id: "med_zopiclone", generic: "Zopiclone", brands: ["Imovane", "Imrest"], drugClass: "Z-drug (non-benzodiazepine hypnotic)", category: "Anxiolytic / Sedative", defaultStrength: "7.5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Short-term insomnia", route: "Oral" },
  { id: "med_zolpidem", generic: "Zolpidem", brands: ["Stilnox"], drugClass: "Z-drug (non-benzodiazepine hypnotic)", category: "Anxiolytic / Sedative", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Short-term insomnia", route: "Oral" },
  { id: "med_buspirone", generic: "Buspirone", brands: ["Buspar"], drugClass: "Azapirone anxiolytic", category: "Anxiolytic / Sedative", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Generalised anxiety disorder", route: "Oral" },
  { id: "med_promethazine", generic: "Promethazine", brands: ["Phenergan", "Avomine"], drugClass: "Sedating antihistamine", category: "Anxiolytic / Sedative", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Allergies; nausea; sedation", route: "Oral" },
  { id: "med_suvorexant", generic: "Suvorexant", brands: ["Belsomra"], drugClass: "Orexin receptor antagonist", category: "Anxiolytic / Sedative", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Insomnia", route: "Oral" },
  { id: "med_melatonin", generic: "Melatonin", brands: ["Circadin"], drugClass: "Melatonin agonist", category: "Anxiolytic / Sedative", defaultStrength: "2mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Insomnia (sleep onset); circadian rhythm disorders", route: "Oral" },

  // ═══════════════════════════════════════════
  // ADHD / STIMULANTS
  // ═══════════════════════════════════════════
  { id: "med_methylphenidate_ir", generic: "Methylphenidate (immediate-release)", brands: ["Ritalin"], drugClass: "CNS stimulant", category: "ADHD / Stimulant", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "ADHD; narcolepsy", route: "Oral" },
  { id: "med_methylphenidate_la", generic: "Methylphenidate LA", brands: ["Ritalin LA"], drugClass: "CNS stimulant (long-acting)", category: "ADHD / Stimulant", defaultStrength: "20mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily (mane)", commonIndication: "ADHD", route: "Oral" },
  { id: "med_methylphenidate_concerta", generic: "Methylphenidate ER", brands: ["Concerta"], drugClass: "CNS stimulant (extended-release)", category: "ADHD / Stimulant", defaultStrength: "36mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "ADHD", route: "Oral" },
  { id: "med_dexamfetamine", generic: "Dexamfetamine", brands: ["Aspen Dexamfetamine"], drugClass: "CNS stimulant", category: "ADHD / Stimulant", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "ADHD; narcolepsy", route: "Oral" },
  { id: "med_lisdexamfetamine", generic: "Lisdexamfetamine", brands: ["Vyvanse"], drugClass: "CNS stimulant (prodrug)", category: "ADHD / Stimulant", defaultStrength: "30mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily (mane)", commonIndication: "ADHD; binge eating disorder", route: "Oral" },
  { id: "med_atomoxetine", generic: "Atomoxetine", brands: ["Strattera"], drugClass: "Selective NRI (non-stimulant)", category: "ADHD / Stimulant", defaultStrength: "40mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "ADHD (non-stimulant option)", route: "Oral" },
  { id: "med_guanfacine", generic: "Guanfacine ER", brands: ["Intuniv"], drugClass: "Alpha-2A agonist (non-stimulant)", category: "ADHD / Stimulant", defaultStrength: "1mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "ADHD (non-stimulant)", route: "Oral" },
  { id: "med_clonidine", generic: "Clonidine", brands: ["Catapres"], drugClass: "Alpha-2 agonist", category: "ADHD / Stimulant", defaultStrength: "100mcg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "ADHD (off-label); hypertension; tics", route: "Oral" },
  { id: "med_modafinil", generic: "Modafinil", brands: ["Modavigil", "Modafinil"], drugClass: "Wakefulness-promoting agent", category: "ADHD / Stimulant", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Narcolepsy; shift work sleep disorder", route: "Oral" },

  // ═══════════════════════════════════════════
  // CARDIOVASCULAR
  // ═══════════════════════════════════════════
  { id: "med_atorvastatin", generic: "Atorvastatin", brands: ["Lipitor", "Atorvastatin Sandoz"], drugClass: "Statin", category: "Cardiovascular", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Hypercholesterolaemia; cardiovascular risk reduction", route: "Oral" },
  { id: "med_rosuvastatin", generic: "Rosuvastatin", brands: ["Crestor", "Rosuvastatin Sandoz"], drugClass: "Statin", category: "Cardiovascular", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Hypercholesterolaemia; cardiovascular risk reduction", route: "Oral" },
  { id: "med_simvastatin", generic: "Simvastatin", brands: ["Zocor", "Lipex"], drugClass: "Statin", category: "Cardiovascular", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Hypercholesterolaemia", route: "Oral" },
  { id: "med_pravastatin", generic: "Pravastatin", brands: ["Pravachol"], drugClass: "Statin", category: "Cardiovascular", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Hypercholesterolaemia", route: "Oral" },
  { id: "med_perindopril", generic: "Perindopril", brands: ["Coversyl", "Coversyl Plus"], drugClass: "ACE inhibitor", category: "Cardiovascular", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Hypertension; heart failure; cardiovascular protection", route: "Oral" },
  { id: "med_ramipril", generic: "Ramipril", brands: ["Tritace"], drugClass: "ACE inhibitor", category: "Cardiovascular", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; heart failure; post-MI", route: "Oral" },
  { id: "med_telmisartan", generic: "Telmisartan", brands: ["Micardis"], drugClass: "Angiotensin II receptor blocker (ARB)", category: "Cardiovascular", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; cardiovascular protection", route: "Oral" },
  { id: "med_candesartan", generic: "Candesartan", brands: ["Atacand"], drugClass: "Angiotensin II receptor blocker (ARB)", category: "Cardiovascular", defaultStrength: "8mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; heart failure", route: "Oral" },
  { id: "med_irbesartan", generic: "Irbesartan", brands: ["Avapro", "Karvea"], drugClass: "Angiotensin II receptor blocker (ARB)", category: "Cardiovascular", defaultStrength: "150mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; diabetic nephropathy", route: "Oral" },
  { id: "med_metoprolol", generic: "Metoprolol", brands: ["Betaloc", "Lopressor", "Metohexal"], drugClass: "Beta-blocker (cardioselective)", category: "Cardiovascular", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Hypertension; angina; heart failure; arrhythmia", route: "Oral" },
  { id: "med_atenolol", generic: "Atenolol", brands: ["Noten", "Tenormin"], drugClass: "Beta-blocker (cardioselective)", category: "Cardiovascular", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; angina; arrhythmia", route: "Oral" },
  { id: "med_bisoprolol", generic: "Bisoprolol", brands: ["Bicor"], drugClass: "Beta-blocker (cardioselective)", category: "Cardiovascular", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Heart failure; hypertension", route: "Oral" },
  { id: "med_carvedilol", generic: "Carvedilol", brands: ["Dilatrend", "Kredex"], drugClass: "Non-selective beta-blocker with alpha-1 blockade", category: "Cardiovascular", defaultStrength: "12.5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Heart failure; hypertension", route: "Oral" },
  { id: "med_propranolol", generic: "Propranolol", brands: ["Inderal", "Deralin"], drugClass: "Non-selective beta-blocker", category: "Cardiovascular", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Hypertension; performance anxiety; migraine prophylaxis; tremor", route: "Oral" },
  { id: "med_amlodipine", generic: "Amlodipine", brands: ["Norvasc", "Amlodipine Sandoz"], drugClass: "Calcium channel blocker (dihydropyridine)", category: "Cardiovascular", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; angina", route: "Oral" },
  { id: "med_diltiazem", generic: "Diltiazem CD", brands: ["Cardizem CD", "Vasocardol CD"], drugClass: "Calcium channel blocker (non-dihydropyridine)", category: "Cardiovascular", defaultStrength: "180mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Hypertension; angina; arrhythmia", route: "Oral" },
  { id: "med_verapamil", generic: "Verapamil SR", brands: ["Isoptin SR", "Anpec SR"], drugClass: "Calcium channel blocker (non-dihydropyridine)", category: "Cardiovascular", defaultStrength: "240mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Hypertension; angina; arrhythmia", route: "Oral" },
  { id: "med_frusemide", generic: "Frusemide (furosemide)", brands: ["Lasix", "Uremide"], drugClass: "Loop diuretic", category: "Cardiovascular", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Heart failure; oedema", route: "Oral" },
  { id: "med_hydrochlorothiazide", generic: "Hydrochlorothiazide", brands: ["Hydrodiuril", "Dithiazide"], drugClass: "Thiazide diuretic", category: "Cardiovascular", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Hypertension; oedema", route: "Oral" },
  { id: "med_indapamide", generic: "Indapamide SR", brands: ["Natrilix SR", "Dapa-Tabs"], drugClass: "Thiazide-like diuretic", category: "Cardiovascular", defaultStrength: "1.5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Hypertension", route: "Oral" },
  { id: "med_spironolactone", generic: "Spironolactone", brands: ["Aldactone", "Spiractin"], drugClass: "Aldosterone antagonist (potassium-sparing diuretic)", category: "Cardiovascular", defaultStrength: "25mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Heart failure; resistant hypertension; oedema", route: "Oral" },
  { id: "med_aspirin_low", generic: "Aspirin (low-dose)", brands: ["Cardiprin", "Cartia", "Astrix"], drugClass: "Antiplatelet", category: "Cardiovascular", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Cardiovascular secondary prevention", route: "Oral" },
  { id: "med_clopidogrel", generic: "Clopidogrel", brands: ["Plavix", "Iscover", "Clopidogrel Sandoz"], drugClass: "Antiplatelet (P2Y12 inhibitor)", category: "Cardiovascular", defaultStrength: "75mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Cardiovascular secondary prevention; post-stent", route: "Oral" },
  { id: "med_apixaban", generic: "Apixaban", brands: ["Eliquis"], drugClass: "Direct oral anticoagulant (DOAC)", category: "Cardiovascular", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Atrial fibrillation; VTE prevention/treatment", route: "Oral" },
  { id: "med_rivaroxaban", generic: "Rivaroxaban", brands: ["Xarelto"], drugClass: "Direct oral anticoagulant (DOAC)", category: "Cardiovascular", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (with food)", commonIndication: "Atrial fibrillation; VTE prevention/treatment", route: "Oral" },
  { id: "med_warfarin", generic: "Warfarin", brands: ["Coumadin", "Marevan"], drugClass: "Vitamin K antagonist anticoagulant", category: "Cardiovascular", defaultStrength: "5mg", defaultQuantity: "Variable per INR", defaultFrequency: "Once daily", commonIndication: "Atrial fibrillation; VTE; mechanical valves (requires INR monitoring)", route: "Oral" },
  { id: "med_digoxin", generic: "Digoxin", brands: ["Lanoxin"], drugClass: "Cardiac glycoside", category: "Cardiovascular", defaultStrength: "62.5mcg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Atrial fibrillation; heart failure", route: "Oral" },
  { id: "med_gtn_sl", generic: "Glyceryl trinitrate (sublingual)", brands: ["Anginine", "Nitrolingual spray"], drugClass: "Nitrate (vasodilator)", category: "Cardiovascular", defaultStrength: "600mcg", defaultQuantity: "1 tablet/spray", defaultFrequency: "PRN (as needed)", commonIndication: "Acute angina", route: "Sublingual" },

  // ═══════════════════════════════════════════
  // DIABETES
  // ═══════════════════════════════════════════
  { id: "med_metformin", generic: "Metformin", brands: ["Diabex", "Diaformin", "Glucophage"], drugClass: "Biguanide", category: "Diabetes", defaultStrength: "500mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (with meals)", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_metformin_xr", generic: "Metformin XR", brands: ["Diabex XR", "Diaformin XR"], drugClass: "Biguanide (modified-release)", category: "Diabetes", defaultStrength: "1000mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (with evening meal)", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_gliclazide", generic: "Gliclazide MR", brands: ["Diamicron MR"], drugClass: "Sulfonylurea", category: "Diabetes", defaultStrength: "30mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_glipizide", generic: "Glipizide", brands: ["Minidiab"], drugClass: "Sulfonylurea", category: "Diabetes", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_glimepiride", generic: "Glimepiride", brands: ["Amaryl"], drugClass: "Sulfonylurea", category: "Diabetes", defaultStrength: "2mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_sitagliptin", generic: "Sitagliptin", brands: ["Januvia"], drugClass: "DPP-4 inhibitor", category: "Diabetes", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_linagliptin", generic: "Linagliptin", brands: ["Trajenta"], drugClass: "DPP-4 inhibitor", category: "Diabetes", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Type 2 diabetes mellitus", route: "Oral" },
  { id: "med_empagliflozin", generic: "Empagliflozin", brands: ["Jardiance"], drugClass: "SGLT-2 inhibitor", category: "Diabetes", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Type 2 diabetes; heart failure; CKD", route: "Oral" },
  { id: "med_dapagliflozin", generic: "Dapagliflozin", brands: ["Forxiga"], drugClass: "SGLT-2 inhibitor", category: "Diabetes", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Type 2 diabetes; heart failure; CKD", route: "Oral" },
  { id: "med_semaglutide", generic: "Semaglutide", brands: ["Ozempic"], drugClass: "GLP-1 receptor agonist", category: "Diabetes", defaultStrength: "0.5mg", defaultQuantity: "1 injection", defaultFrequency: "Weekly", commonIndication: "Type 2 diabetes mellitus", route: "SC injection" },
  { id: "med_dulaglutide", generic: "Dulaglutide", brands: ["Trulicity"], drugClass: "GLP-1 receptor agonist", category: "Diabetes", defaultStrength: "1.5mg", defaultQuantity: "1 injection", defaultFrequency: "Weekly", commonIndication: "Type 2 diabetes mellitus", route: "SC injection" },
  { id: "med_insulin_glargine", generic: "Insulin glargine", brands: ["Lantus", "Optisulin", "Toujeo"], drugClass: "Long-acting basal insulin", category: "Diabetes", defaultStrength: "Variable units", defaultQuantity: "Per dose chart", defaultFrequency: "Once daily (nocte)", commonIndication: "Type 1 and Type 2 diabetes mellitus", route: "SC injection" },
  { id: "med_insulin_aspart", generic: "Insulin aspart", brands: ["NovoRapid", "Fiasp"], drugClass: "Rapid-acting bolus insulin", category: "Diabetes", defaultStrength: "Variable units", defaultQuantity: "Per dose chart", defaultFrequency: "Three times daily (with meals)", commonIndication: "Type 1 and Type 2 diabetes mellitus", route: "SC injection" },
  { id: "med_insulin_mixed", generic: "Insulin mixed (aspart/aspart protamine)", brands: ["NovoMix 30"], drugClass: "Pre-mixed insulin", category: "Diabetes", defaultStrength: "Variable units", defaultQuantity: "Per dose chart", defaultFrequency: "Twice daily (with meals)", commonIndication: "Type 2 diabetes mellitus", route: "SC injection" },

  // ═══════════════════════════════════════════
  // THYROID
  // ═══════════════════════════════════════════
  { id: "med_levothyroxine", generic: "Levothyroxine", brands: ["Eutroxsig", "Oroxine", "Levothyroxine APO"], drugClass: "Thyroid hormone replacement", category: "Thyroid", defaultStrength: "50mcg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane, fasting)", commonIndication: "Hypothyroidism", route: "Oral" },
  { id: "med_carbimazole", generic: "Carbimazole", brands: ["Neo-Mercazole"], drugClass: "Antithyroid", category: "Thyroid", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Hyperthyroidism", route: "Oral" },
  { id: "med_liothyronine", generic: "Liothyronine (T3)", brands: ["Tertroxin"], drugClass: "Thyroid hormone replacement", category: "Thyroid", defaultStrength: "20mcg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Hypothyroidism (specialist use)", route: "Oral" },

  // ═══════════════════════════════════════════
  // RESPIRATORY
  // ═══════════════════════════════════════════
  { id: "med_salbutamol", generic: "Salbutamol", brands: ["Ventolin", "Asmol", "Airomir"], drugClass: "Short-acting beta-2 agonist (SABA)", category: "Respiratory", defaultStrength: "100mcg/dose", defaultQuantity: "1-2 puffs", defaultFrequency: "PRN (as needed)", commonIndication: "Asthma; COPD (reliever)", route: "Inhaled (MDI)" },
  { id: "med_terbutaline", generic: "Terbutaline", brands: ["Bricanyl Turbuhaler"], drugClass: "Short-acting beta-2 agonist (SABA)", category: "Respiratory", defaultStrength: "500mcg/dose", defaultQuantity: "1 inhalation", defaultFrequency: "PRN (as needed)", commonIndication: "Asthma; COPD (reliever)", route: "Inhaled (DPI)" },
  { id: "med_salmeterol", generic: "Salmeterol", brands: ["Serevent"], drugClass: "Long-acting beta-2 agonist (LABA)", category: "Respiratory", defaultStrength: "50mcg/dose", defaultQuantity: "1 inhalation", defaultFrequency: "Twice daily (BD)", commonIndication: "Asthma; COPD (preventer)", route: "Inhaled (DPI)" },
  { id: "med_fluticasone", generic: "Fluticasone propionate", brands: ["Flixotide"], drugClass: "Inhaled corticosteroid (ICS)", category: "Respiratory", defaultStrength: "125mcg/dose", defaultQuantity: "2 puffs", defaultFrequency: "Twice daily (BD)", commonIndication: "Asthma (preventer)", route: "Inhaled (MDI)" },
  { id: "med_budesonide", generic: "Budesonide", brands: ["Pulmicort Turbuhaler"], drugClass: "Inhaled corticosteroid (ICS)", category: "Respiratory", defaultStrength: "200mcg/dose", defaultQuantity: "1 inhalation", defaultFrequency: "Twice daily (BD)", commonIndication: "Asthma (preventer)", route: "Inhaled (DPI)" },
  { id: "med_symbicort", generic: "Budesonide/formoterol", brands: ["Symbicort Turbuhaler", "Symbicort Rapihaler"], drugClass: "ICS/LABA combination", category: "Respiratory", defaultStrength: "200/6mcg", defaultQuantity: "1 inhalation", defaultFrequency: "Twice daily (BD)", commonIndication: "Asthma; COPD", route: "Inhaled (DPI/MDI)" },
  { id: "med_seretide", generic: "Fluticasone/salmeterol", brands: ["Seretide MDI", "Seretide Accuhaler"], drugClass: "ICS/LABA combination", category: "Respiratory", defaultStrength: "250/25mcg", defaultQuantity: "2 puffs", defaultFrequency: "Twice daily (BD)", commonIndication: "Asthma; COPD", route: "Inhaled (MDI/DPI)" },
  { id: "med_tiotropium", generic: "Tiotropium", brands: ["Spiriva", "Spiriva Respimat"], drugClass: "Long-acting muscarinic antagonist (LAMA)", category: "Respiratory", defaultStrength: "18mcg", defaultQuantity: "1 inhalation/2 puffs", defaultFrequency: "Once daily", commonIndication: "COPD; severe asthma", route: "Inhaled (DPI/SMI)" },
  { id: "med_spiolto", generic: "Tiotropium/olodaterol", brands: ["Spiolto Respimat"], drugClass: "LAMA/LABA combination", category: "Respiratory", defaultStrength: "2.5/2.5mcg", defaultQuantity: "2 puffs", defaultFrequency: "Once daily", commonIndication: "COPD", route: "Inhaled (SMI)" },
  { id: "med_breo", generic: "Fluticasone furoate/vilanterol", brands: ["Breo Ellipta"], drugClass: "ICS/LABA combination", category: "Respiratory", defaultStrength: "100/25mcg", defaultQuantity: "1 inhalation", defaultFrequency: "Once daily", commonIndication: "Asthma; COPD", route: "Inhaled (DPI)" },
  { id: "med_trelegy", generic: "Fluticasone/umeclidinium/vilanterol", brands: ["Trelegy Ellipta"], drugClass: "ICS/LAMA/LABA triple combination", category: "Respiratory", defaultStrength: "100/62.5/25mcg", defaultQuantity: "1 inhalation", defaultFrequency: "Once daily", commonIndication: "COPD; severe asthma", route: "Inhaled (DPI)" },
  { id: "med_montelukast", generic: "Montelukast", brands: ["Singulair", "Lukair"], drugClass: "Leukotriene receptor antagonist", category: "Respiratory", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Asthma; allergic rhinitis", route: "Oral" },

  // ═══════════════════════════════════════════
  // PAIN & ANTI-INFLAMMATORY
  // ═══════════════════════════════════════════
  { id: "med_paracetamol", generic: "Paracetamol", brands: ["Panadol", "Panamax", "Dymadon"], drugClass: "Simple analgesic / antipyretic", category: "Pain / Anti-inflammatory", defaultStrength: "500mg", defaultQuantity: "2 tablets", defaultFrequency: "Four times daily (QID) PRN", commonIndication: "Mild-moderate pain; fever", route: "Oral" },
  { id: "med_ibuprofen", generic: "Ibuprofen", brands: ["Nurofen", "Brufen", "Advil"], drugClass: "NSAID", category: "Pain / Anti-inflammatory", defaultStrength: "400mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS) PRN", commonIndication: "Pain; inflammation; fever", route: "Oral" },
  { id: "med_naproxen", generic: "Naproxen", brands: ["Naprosyn", "Naprogesic", "Inza"], drugClass: "NSAID (longer half-life)", category: "Pain / Anti-inflammatory", defaultStrength: "500mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Pain; inflammation; arthritis", route: "Oral" },
  { id: "med_celecoxib", generic: "Celecoxib", brands: ["Celebrex"], drugClass: "COX-2 selective NSAID", category: "Pain / Anti-inflammatory", defaultStrength: "200mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Osteoarthritis; rheumatoid arthritis", route: "Oral" },
  { id: "med_meloxicam", generic: "Meloxicam", brands: ["Mobic", "Movalis"], drugClass: "Preferential COX-2 NSAID", category: "Pain / Anti-inflammatory", defaultStrength: "15mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Osteoarthritis; rheumatoid arthritis", route: "Oral" },
  { id: "med_diclofenac", generic: "Diclofenac", brands: ["Voltaren", "Voltaren Rapid"], drugClass: "NSAID", category: "Pain / Anti-inflammatory", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Pain; inflammation", route: "Oral" },
  { id: "med_codeine", generic: "Codeine (with paracetamol)", brands: ["Panadeine Forte"], drugClass: "Weak opioid analgesic", category: "Pain / Anti-inflammatory", defaultStrength: "30mg/500mg", defaultQuantity: "1-2 tablets", defaultFrequency: "Four times daily (QID) PRN", commonIndication: "Moderate pain (Schedule 4 in Australia)", route: "Oral" },
  { id: "med_tramadol", generic: "Tramadol", brands: ["Tramal", "Tramedo", "Zydol SR"], drugClass: "Atypical opioid analgesic", category: "Pain / Anti-inflammatory", defaultStrength: "50mg", defaultQuantity: "1 capsule", defaultFrequency: "Four times daily (QID) PRN", commonIndication: "Moderate-severe pain", route: "Oral" },
  { id: "med_tapentadol", generic: "Tapentadol SR", brands: ["Palexia SR"], drugClass: "Atypical opioid analgesic (mu-agonist + NRI)", category: "Pain / Anti-inflammatory", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Severe chronic pain (Schedule 8)", route: "Oral" },
  { id: "med_morphine_sr", generic: "Morphine sulfate (sustained-release)", brands: ["MS Contin", "Kapanol"], drugClass: "Strong opioid analgesic", category: "Pain / Anti-inflammatory", defaultStrength: "30mg", defaultQuantity: "1 tablet/capsule", defaultFrequency: "Twice daily (BD)", commonIndication: "Severe chronic pain (Schedule 8)", route: "Oral" },
  { id: "med_oxycodone_ir", generic: "Oxycodone (immediate-release)", brands: ["Endone", "OxyNorm"], drugClass: "Strong opioid analgesic", category: "Pain / Anti-inflammatory", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Four-hourly PRN", commonIndication: "Acute severe pain (Schedule 8)", route: "Oral" },
  { id: "med_oxycodone_cr", generic: "Oxycodone (controlled-release)", brands: ["OxyContin", "Targin (with naloxone)"], drugClass: "Strong opioid analgesic", category: "Pain / Anti-inflammatory", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Severe chronic pain (Schedule 8)", route: "Oral" },
  { id: "med_buprenorphine_patch", generic: "Buprenorphine transdermal patch", brands: ["Norspan"], drugClass: "Partial opioid agonist (transdermal)", category: "Pain / Anti-inflammatory", defaultStrength: "5mcg/hr", defaultQuantity: "1 patch", defaultFrequency: "Weekly (every 7 days)", commonIndication: "Chronic moderate pain (Schedule 8)", route: "Transdermal patch" },
  { id: "med_fentanyl_patch", generic: "Fentanyl transdermal patch", brands: ["Durogesic", "Denpax"], drugClass: "Strong opioid analgesic (transdermal)", category: "Pain / Anti-inflammatory", defaultStrength: "12mcg/hr", defaultQuantity: "1 patch", defaultFrequency: "Every 72 hours (3-daily)", commonIndication: "Severe chronic stable pain (Schedule 8)", route: "Transdermal patch" },

  // ═══════════════════════════════════════════
  // GASTROINTESTINAL
  // ═══════════════════════════════════════════
  { id: "med_esomeprazole", generic: "Esomeprazole", brands: ["Nexium"], drugClass: "Proton pump inhibitor (PPI)", category: "Gastrointestinal", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "GORD; peptic ulcer; H. pylori eradication", route: "Oral" },
  { id: "med_pantoprazole", generic: "Pantoprazole", brands: ["Somac", "Pantoloc"], drugClass: "Proton pump inhibitor (PPI)", category: "Gastrointestinal", defaultStrength: "40mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "GORD; peptic ulcer", route: "Oral" },
  { id: "med_omeprazole", generic: "Omeprazole", brands: ["Losec", "Probitor", "Acimax"], drugClass: "Proton pump inhibitor (PPI)", category: "Gastrointestinal", defaultStrength: "20mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily (mane)", commonIndication: "GORD; peptic ulcer", route: "Oral" },
  { id: "med_rabeprazole", generic: "Rabeprazole", brands: ["Pariet"], drugClass: "Proton pump inhibitor (PPI)", category: "Gastrointestinal", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "GORD; peptic ulcer", route: "Oral" },
  { id: "med_famotidine", generic: "Famotidine", brands: ["Pepcid", "Pepzan"], drugClass: "H2 receptor antagonist", category: "Gastrointestinal", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "GORD; peptic ulcer", route: "Oral" },
  { id: "med_movicol", generic: "Macrogol 3350 (with electrolytes)", brands: ["Movicol", "OsmoLax"], drugClass: "Osmotic laxative", category: "Gastrointestinal", defaultStrength: "13.7g sachet", defaultQuantity: "1 sachet (in 125mL water)", defaultFrequency: "Once daily", commonIndication: "Chronic constipation; faecal impaction", route: "Oral" },
  { id: "med_lactulose", generic: "Lactulose", brands: ["Duphalac", "Actilax"], drugClass: "Osmotic laxative", category: "Gastrointestinal", defaultStrength: "10g/15mL", defaultQuantity: "15mL", defaultFrequency: "Twice daily (BD)", commonIndication: "Constipation; hepatic encephalopathy", route: "Oral" },
  { id: "med_senna", generic: "Sennoside (with docusate)", brands: ["Coloxyl with Senna", "Senokot"], drugClass: "Stimulant laxative", category: "Gastrointestinal", defaultStrength: "8mg/50mg", defaultQuantity: "1-2 tablets", defaultFrequency: "Once daily (nocte)", commonIndication: "Constipation; opioid-induced constipation", route: "Oral" },
  { id: "med_ondansetron", generic: "Ondansetron", brands: ["Zofran", "Ondaz Wafers"], drugClass: "5-HT3 antagonist (antiemetic)", category: "Gastrointestinal", defaultStrength: "4mg", defaultQuantity: "1 tablet/wafer", defaultFrequency: "Three times daily (TDS) PRN", commonIndication: "Nausea and vomiting", route: "Oral / Sublingual wafer" },
  { id: "med_metoclopramide", generic: "Metoclopramide", brands: ["Maxolon"], drugClass: "Dopamine antagonist (antiemetic / prokinetic)", category: "Gastrointestinal", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS) PRN", commonIndication: "Nausea and vomiting; gastroparesis", route: "Oral" },
  { id: "med_prochlorperazine", generic: "Prochlorperazine", brands: ["Stemetil"], drugClass: "Dopamine antagonist (antiemetic)", category: "Gastrointestinal", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS) PRN", commonIndication: "Nausea and vomiting; vertigo", route: "Oral" },
  { id: "med_domperidone", generic: "Domperidone", brands: ["Motilium", "Motilon"], drugClass: "Dopamine antagonist (peripheral)", category: "Gastrointestinal", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Nausea; gastroparesis", route: "Oral" },

  // ═══════════════════════════════════════════
  // DEMENTIA / COGNITION
  // ═══════════════════════════════════════════
  { id: "med_donepezil", generic: "Donepezil", brands: ["Aricept", "Donepezil Sandoz"], drugClass: "Cholinesterase inhibitor", category: "Dementia / Cognition", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (nocte)", commonIndication: "Alzheimer's disease (mild-moderate)", route: "Oral" },
  { id: "med_rivastigmine_patch", generic: "Rivastigmine transdermal patch", brands: ["Exelon Patch"], drugClass: "Cholinesterase inhibitor (transdermal)", category: "Dementia / Cognition", defaultStrength: "9.5mg/24hr", defaultQuantity: "1 patch", defaultFrequency: "Once daily", commonIndication: "Alzheimer's disease; Parkinson's disease dementia", route: "Transdermal patch" },
  { id: "med_galantamine", generic: "Galantamine", brands: ["Reminyl", "Galantyl"], drugClass: "Cholinesterase inhibitor", category: "Dementia / Cognition", defaultStrength: "16mg", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Alzheimer's disease (mild-moderate)", route: "Oral" },
  { id: "med_memantine", generic: "Memantine", brands: ["Ebixa", "APO-Memantine"], drugClass: "NMDA receptor antagonist", category: "Dementia / Cognition", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Alzheimer's disease (moderate-severe)", route: "Oral" },

  // ═══════════════════════════════════════════
  // PARKINSON'S
  // ═══════════════════════════════════════════
  { id: "med_sinemet", generic: "Levodopa/carbidopa", brands: ["Sinemet", "Kinson"], drugClass: "Dopamine precursor + decarboxylase inhibitor", category: "Parkinson's", defaultStrength: "100/25mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Parkinson's disease", route: "Oral" },
  { id: "med_madopar", generic: "Levodopa/benserazide", brands: ["Madopar"], drugClass: "Dopamine precursor + decarboxylase inhibitor", category: "Parkinson's", defaultStrength: "100/25mg", defaultQuantity: "1 capsule", defaultFrequency: "Three times daily (TDS)", commonIndication: "Parkinson's disease", route: "Oral" },
  { id: "med_pramipexole", generic: "Pramipexole", brands: ["Sifrol", "Sifrol ER"], drugClass: "Dopamine agonist", category: "Parkinson's", defaultStrength: "0.375mg ER", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Parkinson's disease; restless legs syndrome", route: "Oral" },
  { id: "med_ropinirole", generic: "Ropinirole", brands: ["Repreve"], drugClass: "Dopamine agonist", category: "Parkinson's", defaultStrength: "2mg", defaultQuantity: "1 tablet", defaultFrequency: "Three times daily (TDS)", commonIndication: "Parkinson's disease; restless legs syndrome", route: "Oral" },
  { id: "med_rasagiline", generic: "Rasagiline", brands: ["Azilect"], drugClass: "MAO-B inhibitor", category: "Parkinson's", defaultStrength: "1mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Parkinson's disease", route: "Oral" },

  // ═══════════════════════════════════════════
  // SUBSTANCE USE / SMOKING CESSATION
  // ═══════════════════════════════════════════
  { id: "med_naltrexone", generic: "Naltrexone (oral)", brands: ["ReVia"], drugClass: "Opioid antagonist", category: "Substance Use", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Alcohol use disorder; opioid use disorder", route: "Oral" },
  { id: "med_acamprosate", generic: "Acamprosate", brands: ["Campral"], drugClass: "Glutamate modulator", category: "Substance Use", defaultStrength: "333mg", defaultQuantity: "2 tablets", defaultFrequency: "Three times daily (TDS)", commonIndication: "Alcohol dependence (relapse prevention)", route: "Oral" },
  { id: "med_disulfiram", generic: "Disulfiram", brands: ["Antabuse"], drugClass: "Aldehyde dehydrogenase inhibitor", category: "Substance Use", defaultStrength: "200mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily (mane)", commonIndication: "Alcohol use disorder (aversive therapy)", route: "Oral" },
  { id: "med_methadone", generic: "Methadone syrup", brands: ["Methadone Syrup"], drugClass: "Long-acting opioid agonist", category: "Substance Use", defaultStrength: "Variable mg", defaultQuantity: "Per dosing schedule", defaultFrequency: "Once daily (supervised dosing)", commonIndication: "Opioid use disorder (OAT)", route: "Oral" },
  { id: "med_suboxone", generic: "Buprenorphine/naloxone", brands: ["Suboxone Film"], drugClass: "Partial opioid agonist + antagonist", category: "Substance Use", defaultStrength: "8mg/2mg", defaultQuantity: "1 film", defaultFrequency: "Once daily (sublingual, supervised)", commonIndication: "Opioid use disorder (OAT)", route: "Sublingual" },
  { id: "med_buprenorphine_depot", generic: "Buprenorphine depot", brands: ["Buvidal", "Sublocade"], drugClass: "Partial opioid agonist (long-acting injectable)", category: "Substance Use", defaultStrength: "16mg weekly / 64mg monthly", defaultQuantity: "1 injection", defaultFrequency: "Weekly or monthly", commonIndication: "Opioid use disorder (OAT)", route: "SC injection" },
  { id: "med_varenicline", generic: "Varenicline", brands: ["Champix"], drugClass: "Nicotinic partial agonist", category: "Substance Use", defaultStrength: "1mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Smoking cessation", route: "Oral" },
  { id: "med_nrt_patch", generic: "Nicotine transdermal patch", brands: ["Nicabate", "Nicorette Patch", "Habitrol"], drugClass: "Nicotine replacement therapy (NRT)", category: "Substance Use", defaultStrength: "21mg/24hr", defaultQuantity: "1 patch", defaultFrequency: "Once daily", commonIndication: "Smoking cessation", route: "Transdermal patch" },

  // ═══════════════════════════════════════════
  // STEROIDS / HORMONES
  // ═══════════════════════════════════════════
  { id: "med_prednisolone", generic: "Prednisolone", brands: ["Panafcort", "Solone", "Predsone"], drugClass: "Oral corticosteroid", category: "Steroid / Hormone", defaultStrength: "5mg", defaultQuantity: "Variable tablets", defaultFrequency: "Once daily (mane)", commonIndication: "Inflammatory and autoimmune conditions", route: "Oral" },
  { id: "med_hydrocortisone", generic: "Hydrocortisone (oral)", brands: ["Hysone"], drugClass: "Glucocorticoid replacement", category: "Steroid / Hormone", defaultStrength: "20mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Adrenal insufficiency", route: "Oral" },
  { id: "med_dexamethasone", generic: "Dexamethasone", brands: ["Dexmethsone"], drugClass: "Potent corticosteroid", category: "Steroid / Hormone", defaultStrength: "4mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Inflammation; cerebral oedema; antiemetic", route: "Oral" },
  { id: "med_fludrocortisone", generic: "Fludrocortisone", brands: ["Florinef"], drugClass: "Mineralocorticoid", category: "Steroid / Hormone", defaultStrength: "100mcg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Adrenal insufficiency; postural hypotension", route: "Oral" },
  { id: "med_testosterone_gel", generic: "Testosterone gel", brands: ["Testogel", "Androforte Cream"], drugClass: "Androgen replacement", category: "Steroid / Hormone", defaultStrength: "50mg/sachet", defaultQuantity: "1 sachet/application", defaultFrequency: "Once daily (mane)", commonIndication: "Male hypogonadism", route: "Topical" },
  { id: "med_estradiol", generic: "Estradiol patch", brands: ["Estradot", "Climara"], drugClass: "Oestrogen replacement", category: "Steroid / Hormone", defaultStrength: "50mcg/24hr", defaultQuantity: "1 patch", defaultFrequency: "Twice weekly", commonIndication: "Menopausal hormone therapy", route: "Transdermal patch" },

  // ═══════════════════════════════════════════
  // ALLERGY / ANTIHISTAMINES
  // ═══════════════════════════════════════════
  { id: "med_cetirizine", generic: "Cetirizine", brands: ["Zyrtec", "Zilarex"], drugClass: "Non-sedating antihistamine (2nd-gen)", category: "Allergy", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Allergic rhinitis; urticaria", route: "Oral" },
  { id: "med_loratadine", generic: "Loratadine", brands: ["Claratyne"], drugClass: "Non-sedating antihistamine (2nd-gen)", category: "Allergy", defaultStrength: "10mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Allergic rhinitis; urticaria", route: "Oral" },
  { id: "med_fexofenadine", generic: "Fexofenadine", brands: ["Telfast"], drugClass: "Non-sedating antihistamine (2nd-gen)", category: "Allergy", defaultStrength: "180mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Allergic rhinitis; urticaria", route: "Oral" },
  { id: "med_desloratadine", generic: "Desloratadine", brands: ["Aerius"], drugClass: "Non-sedating antihistamine (2nd-gen)", category: "Allergy", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Allergic rhinitis; urticaria", route: "Oral" },

  // ═══════════════════════════════════════════
  // BONE / CALCIUM
  // ═══════════════════════════════════════════
  { id: "med_alendronate", generic: "Alendronate", brands: ["Fosamax", "Alendro Once Weekly"], drugClass: "Bisphosphonate", category: "Bone / Calcium", defaultStrength: "70mg", defaultQuantity: "1 tablet", defaultFrequency: "Weekly (mane, fasting)", commonIndication: "Osteoporosis", route: "Oral" },
  { id: "med_risedronate", generic: "Risedronate", brands: ["Actonel", "Actonel EC"], drugClass: "Bisphosphonate", category: "Bone / Calcium", defaultStrength: "35mg", defaultQuantity: "1 tablet", defaultFrequency: "Weekly", commonIndication: "Osteoporosis", route: "Oral" },
  { id: "med_denosumab", generic: "Denosumab", brands: ["Prolia"], drugClass: "RANKL inhibitor (monoclonal antibody)", category: "Bone / Calcium", defaultStrength: "60mg", defaultQuantity: "1 injection", defaultFrequency: "Every 6 months", commonIndication: "Osteoporosis", route: "SC injection" },
  { id: "med_calcium_vitd", generic: "Calcium carbonate + Vitamin D3", brands: ["Caltrate Plus", "Cal-D"], drugClass: "Calcium and vitamin D supplement", category: "Bone / Calcium", defaultStrength: "600mg/400IU", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Osteoporosis prevention; calcium/vitamin D deficiency", route: "Oral" },
  { id: "med_cholecalciferol", generic: "Cholecalciferol (Vitamin D3)", brands: ["Ostelin", "Vitamin D-Forte"], drugClass: "Vitamin D supplement", category: "Bone / Calcium", defaultStrength: "1000IU", defaultQuantity: "1 capsule", defaultFrequency: "Once daily", commonIndication: "Vitamin D deficiency", route: "Oral" },

  // ═══════════════════════════════════════════
  // UROLOGICAL
  // ═══════════════════════════════════════════
  { id: "med_tamsulosin", generic: "Tamsulosin", brands: ["Flomaxtra", "Tamsulosin Sandoz"], drugClass: "Selective alpha-1A blocker", category: "Urological", defaultStrength: "400mcg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Benign prostatic hyperplasia (BPH)", route: "Oral" },
  { id: "med_finasteride", generic: "Finasteride", brands: ["Proscar", "Propecia"], drugClass: "5-alpha reductase inhibitor", category: "Urological", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "BPH; androgenic alopecia", route: "Oral" },
  { id: "med_solifenacin", generic: "Solifenacin", brands: ["Vesicare"], drugClass: "Anticholinergic (M3-selective)", category: "Urological", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Overactive bladder; urge incontinence", route: "Oral" },
  { id: "med_oxybutynin", generic: "Oxybutynin", brands: ["Ditropan", "Oxytrol Patch"], drugClass: "Anticholinergic", category: "Urological", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Twice daily (BD)", commonIndication: "Overactive bladder", route: "Oral" },
  { id: "med_mirabegron", generic: "Mirabegron", brands: ["Betmiga"], drugClass: "Beta-3 adrenergic agonist", category: "Urological", defaultStrength: "50mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Overactive bladder", route: "Oral" },

  // ═══════════════════════════════════════════
  // VITAMINS / SUPPLEMENTS
  // ═══════════════════════════════════════════
  { id: "med_b12_im", generic: "Hydroxocobalamin (Vitamin B12)", brands: ["Cytamen", "Neo-B12"], drugClass: "Vitamin B12 replacement", category: "Vitamin / Supplement", defaultStrength: "1000mcg", defaultQuantity: "1 injection", defaultFrequency: "Every 3 months", commonIndication: "B12 deficiency; pernicious anaemia", route: "IM injection" },
  { id: "med_folic_acid", generic: "Folic acid", brands: ["Megafol", "Folic Acid"], drugClass: "Folate supplement", category: "Vitamin / Supplement", defaultStrength: "5mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Folate deficiency; methotrexate adjunct; pregnancy", route: "Oral" },
  { id: "med_iron_ferrous", generic: "Ferrous sulfate", brands: ["Ferro-Gradumet", "FGF"], drugClass: "Iron supplement", category: "Vitamin / Supplement", defaultStrength: "325mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Iron deficiency anaemia", route: "Oral" },
  { id: "med_iron_maltofer", generic: "Iron polymaltose", brands: ["Maltofer"], drugClass: "Iron supplement", category: "Vitamin / Supplement", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Iron deficiency anaemia", route: "Oral" },
  { id: "med_thiamine", generic: "Thiamine (Vitamin B1)", brands: ["Betamin"], drugClass: "Vitamin B1 supplement", category: "Vitamin / Supplement", defaultStrength: "100mg", defaultQuantity: "1 tablet", defaultFrequency: "Once daily", commonIndication: "Thiamine deficiency; alcohol use disorder; Wernicke's prophylaxis", route: "Oral" },
];
];

export const MEDICATION_CATEGORIES: string[] = Array.from(
  new Set(MEDICATION_LIBRARY.map((m) => m.category)),
).sort();

export const FREQUENCY_OPTIONS: string[] = [
  "Once daily",
  "Once daily (mane)",
  "Once daily (nocte)",
  "Twice daily (BD)",
  "Three times daily (TDS)",
  "Four times daily (QID)",
  "Every other day",
  "Specific days (e.g. Mon/Wed/Fri)",
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Every 3 months",
  "PRN (as needed)",
  "Other (custom)",
];

export const ADMIN_AID_OPTIONS: string[] = [
  "None",
  "Webster pack",
  "Blister pack / Dose Administration Aid (DAA)",
  "Sachets",
  "Pre-loaded syringe",
  "Pre-filled pen",
  "Supervised dosing (pharmacy)",
  "Other",
];

// Build a fresh MedicationInstance from a library entry, pre-filling the
// per-participant editable fields with the library defaults.
export function instantiateMedication(
  entry: MedicationLibraryEntry,
): MedicationInstance {
  return {
    ...entry,
    instanceId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "med_inst_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    chosenBrand: entry.brands?.[0] ?? "",
    strength: entry.defaultStrength ?? "",
    quantity: entry.defaultQuantity ?? "",
    frequency: entry.defaultFrequency ?? "Once daily",
    timing: "",
    indication: entry.commonIndication ?? "",
    adminAid: "None",
    notes: "",
  };
}
