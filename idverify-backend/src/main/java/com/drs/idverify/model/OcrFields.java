package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "ocr_fields")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OcrFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @Column(length = 255)
    private String surname;

    @Column(name = "given_names", length = 255)
    private String givenNames;

    @Column(name = "document_number", length = 100)
    private String documentNumber;

    @Column(name = "document_type", length = 20)
    private String documentType;

    @Column(name = "country_code", length = 20)
    private String countryCode;

    @Column(length = 100)
    private String nationality;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(length = 20)
    private String sex;

    @Column(name = "place_of_birth", length = 255)
    private String placeOfBirth;

    @Column(name = "date_of_issue")
    private LocalDate dateOfIssue;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "issuing_country", length = 100)
    private String issuingCountry;

    @Column(name = "personal_number", length = 100)
    private String personalNumber;

    @Column(name = "mrz_line1", length = 100)
    private String mrzLine1;

    @Column(name = "mrz_line2", length = 100)
    private String mrzLine2;

    @Column(name = "raw_json", columnDefinition = "LONGTEXT")
    private String rawJson;

    @Column(name = "ocr_engine", length = 30)
    private String ocrEngine;

    @Column(name = "processing_ms")
    private Integer processingMs;
}
