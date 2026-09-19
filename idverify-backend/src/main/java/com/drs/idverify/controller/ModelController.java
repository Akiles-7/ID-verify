package com.drs.idverify.controller;

import com.drs.idverify.model.ModelRegistryEntry;
import com.drs.idverify.repository.ModelRegistryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final ModelRegistryRepository modelRegistryRepository;

    public ModelController(ModelRegistryRepository modelRegistryRepository) {
        this.modelRegistryRepository = modelRegistryRepository;
    }

    @GetMapping
    public ResponseEntity<List<ModelRegistryEntry>> getActiveModels() {
        return ResponseEntity.ok(modelRegistryRepository.findAll());
    }
}
