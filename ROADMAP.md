# Pedigree PRO Project Roadmap

This document outlines the strategic priorities, upcoming milestones, and long-term vision for **Pedigree PRO**.

---

## Current Release: v1.4.0 (Stable / Apache 2.0 Open-Source Release)

* :white_check_mark: Zero-server local-first architecture (Tauri Rust + Browser WASM).
* :white_check_mark: Topological auto-layout engine with consanguinity collision resolution and crossing minimization.
* :white_check_mark: Full standard pedigree symbol palette (twins, deceased, SAB/TOP/stillbirth, carrier states, proband indicator).
* :white_check_mark: Clinical annotations & inbreeding coefficient calculation ($F$).
* :white_check_mark: Relay sharing with zero cloud data retention.
* :white_check_mark: Export to PDF, PowerPoint (PPTX), PNG, and native `.ppro` format.

---

## Milestone 1: Interoperability & Data Standards (v1.4.0)

* [ ] **GA4GH Pedigree Standard Support:** Import and export GA4GH Pedigree format JSON.
* [ ] **HL7 / FHIR Observation & FamilyMemberHistory:** Support mapping pedigree trees to FHIR standard resources for seamless clinical EMR interoperability.
* [ ] **Extended PED / LINKAGE Format Support:** Enhanced validation and import error recovery for legacy linkage pedigree files.

---

## Milestone 2: Advanced Clinical Genetics & Risk Models (v1.5.0)

* [ ] **Bayesian Risk Calculation Engine:** Integrated Bayes theorem calculator for carrier probabilities across X-linked recessive and autosomal dominant conditions with reduced penetrance.
* [ ] **Expanded Consanguinity Topologies:** Multi-loop inbreeding coefficient resolution with interactive path tracing.
* [ ] **Custom Genotype Matrix:** Enhanced multi-locus marker visualizer for complex genomic analysis.

---

## Milestone 3: Presentation, Usability & Collaboration (v1.6.0)

* [ ] **Publication-Ready Vector PDF Exporter:** Multi-page layout engine for massive 5+ generation extended pedigrees with customizable title blocks, legends, and institutional headers.
* [ ] **Local Network Peer Discovery:** Zero-configuration mDNS/Bonjour LAN peer discovery for instant clinician-to-clinician P2P handoffs without typing connection tokens.
* [ ] **Plugin / Scripting Architecture:** Sandboxed plugin interface allowing research groups to write custom layout scripts or annotation calculators.

---

## Community Input

We encourage clinicians, genetic counselors, and computational biologists to propose features or shape our roadmap by opening an issue on GitHub using our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.yml) or [Clinical Feedback Template](.github/ISSUE_TEMPLATE/clinical_feedback.yml).
