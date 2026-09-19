package com.drs.idverify.repository;

import com.drs.idverify.model.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface FaceResultRepository extends JpaRepository<FaceResult, Long> {
    Optional<FaceResult> findByCaseEntityId(Long caseId);
}
