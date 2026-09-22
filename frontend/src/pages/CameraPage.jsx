import AlertImage from "../components/AlertImage";
import GlassButton from "../components/GlassButton";
import { Camera as CameraIcon, Upload, Square, Play, Target, Video, Radio, Zap } from "lucide-react";
import { COLORS } from "../constants/theme";
import Webcam from "react-webcam";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";

export default function CameraPage({analyzingUpload, audioInputRef, backendOnline, cameraSubTab, dashboardImage, handleFileUpload, imageInputRef, isWebcamStreaming, runDemoDetection, setCameraSubTab, setIsWebcamStreaming, uploadDetection, uploading, videoInputRef, webcamDetection, webcamRef}) {
return (<div>
              <div
                style={{
                  display:
                    "flex",
                  gap: 8,
                  marginBottom: 20,
                  flexWrap:
                    "wrap",
                }}
              >
                <GlassButton
                  active={
                    cameraSubTab ===
                    "webcam"
                  }
                  onClick={() =>
                    setCameraSubTab(
                      "webcam"
                    )
                  }
                  icon={
                    <CameraIcon
                      size={15}
                    />
                  }
                >
                  Edge Device Simulator
                </GlassButton>

                <GlassButton
                  active={
                    cameraSubTab ===
                    "upload"
                  }
                  onClick={() =>
                    setCameraSubTab(
                      "upload"
                    )
                  }
                  icon={
                    <Upload
                      size={15}
                    />
                  }
                >
                  Manual Data Ingestion
                </GlassButton>
              </div>

              {cameraSubTab ===
                "webcam" && (
                <div
                  className="camera-grid"
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1.15fr 1fr",
                    gap: 18,
                  }}
                >
                  <div
                    className="glass-panel"
                    style={{
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        marginBottom:
                          15,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight:
                              700,
                            fontSize:
                              15,
                          }}
                        >
                          Live Sensor Array
                        </div>

                        <div
                          style={{
                            color:
                              COLORS.dim,
                            fontSize:
                              10,
                            marginTop:
                              3,
                          }}
                        >
                          Laptop webcam
                          → edge AI
                        </div>
                      </div>

                      <GlassButton
                        success={
                          !isWebcamStreaming
                        }
                        danger={
                          isWebcamStreaming
                        }
                        onClick={() =>
                          setIsWebcamStreaming(
                            !isWebcamStreaming
                          )
                        }
                        icon={
                          isWebcamStreaming ? (
                            <Square
                              size={14}
                            />
                          ) : (
                            <Play
                              size={14}
                            />
                          )
                        }
                      >
                        {isWebcamStreaming
                          ? "Terminate"
                          : "Initialize AI"}
                      </GlassButton>
                    </div>

                    <div
                      style={{
                        height: 430,
                        borderRadius: 13,
                        overflow:
                          "hidden",
                        background:
                          "#000",
                        position:
                          "relative",
                      }}
                    >
                      {isWebcamStreaming && <Webcam audio={false}
                        ref={
                          webcamRef
                        }
                        screenshotFormat="image/jpeg"
                        videoConstraints={{
                          facingMode:
                            "user",
                        }}
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "cover",
                        }}
                      />}

                      {isWebcamStreaming && (
                        <>
                          <div className="scan-line" />

                          <div
                            style={{
                              position:
                                "absolute",
                              top: 12,
                              left: 12,
                              padding:
                                "6px 10px",
                              borderRadius:
                                20,
                              background:
                                "rgba(239,68,68,.85)",
                              color:
                                "#fff",
                              fontSize:
                                10,
                              fontWeight:
                                800,
                            }}
                          >
                            {webcamDetection?.threat_level === "UNAVAILABLE" ? "INFERENCE UNAVAILABLE" : "VISION INFERENCE ENABLED"}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="glass-panel"
                    style={{
                      padding: 20,
                    }}
                  >
                    <SectionHeader
                      title="Inference Pipeline"
                      subtitle="Latest YOLO/model response"
                      icon={
                        <Target
                          size={18}
                          color="#4ade80"
                        />
                      }
                    />

                    {webcamDetection ? (
                      <div>
                        <p role="status">Vision status: {webcamDetection.threat_level}</p>
                        {webcamDetection.alert?.image_url && (
                          <AlertImage
                            path={webcamDetection.alert?.image_url}
                            alt="AI annotated"
                            style={{
                              width:
                                "100%",
                              height:
                                290,
                              objectFit:
                                "cover",
                              borderRadius:
                                12,
                            }}
                          />
                        )}

                        <div
                          style={{
                            display:
                              "grid",
                            gap: 9,
                            marginTop:
                              14,
                          }}
                        >
                          {(
                            webcamDetection.detections ||
                            []
                          ).map(
                            (
                              detection,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                                style={{
                                  padding:
                                    12,
                                  background:
                                    "rgba(255,255,255,.035)",
                                  borderRadius:
                                    9,
                                  display:
                                    "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "center",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight:
                                      700,
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {detection.label?.toUpperCase()}
                                </span>

                                <span
                                  style={{
                                    color:
                                      "#4ade80",
                                    fontWeight:
                                      800,
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {Math.round(
                                    (detection.confidence ||
                                      0) *
                                      100
                                  )}
                                  %
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          minHeight:
                            350,
                          display:
                            "grid",
                          placeItems:
                            "center",
                          border:
                            "1px dashed rgba(255,255,255,.1)",
                          borderRadius:
                            12,
                          color:
                            COLORS.dim,
                          textAlign:
                            "center",
                        }}
                      >
                        <div>
                          <Target
                            size={40}
                            style={{
                              opacity:
                                .35,
                            }}
                          />

                          <div
                            style={{
                              marginTop:
                                12,
                              fontSize:
                                12,
                            }}
                          >
                            Awaiting model
                            inference
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {cameraSubTab ===
                "upload" && (
                <div
                  className="glass-panel"
                  style={{
                    padding: 28,
                  }}
                >
                  <SectionHeader
                    title="Manual Data Ingestion"
                    subtitle="Send optical, video or acoustic telemetry into the AI pipeline."
                    icon={
                      <Upload
                        size={18}
                        color="#4ade80"
                      />
                    }
                  />

                  <input
                    ref={
                      imageInputRef
                    }
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    style={{
                      display:
                        "none",
                    }}
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        "image"
                      )
                    }
                  />

                  <input
                    ref={
                      videoInputRef
                    }
                    type="file"
                    accept=".mp4,.avi,.mov,.webm"
                    style={{
                      display:
                        "none",
                    }}
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        "video"
                      )
                    }
                  />

                  <input
                    ref={
                      audioInputRef
                    }
                    type="file"
                    accept=".wav,.mp3,.flac,.ogg"
                    style={{
                      display:
                        "none",
                    }}
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        "audio"
                      )
                    }
                  />

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(3,1fr)",
                      gap: 14,
                    }}
                  >
                    <button
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        imageInputRef.current?.click()
                      }
                      className="glass-panel"
                      style={{
                        minHeight:
                          150,
                        padding: 20,
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                        border:
                          "1px solid rgba(74,222,128,.12)",
                      }}
                    >
                      <CameraIcon
                        size={32}
                        color="#4ade80"
                      />

                      <div
                        style={{
                          marginTop:
                            12,
                          fontWeight:
                            700,
                        }}
                      >
                        Optical Frame
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize:
                            11,
                          marginTop:
                            5,
                        }}
                      >
                        JPG / PNG
                      </div>
                    </button>

                    <button
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        videoInputRef.current?.click()
                      }
                      className="glass-panel"
                      style={{
                        minHeight:
                          150,
                        padding: 20,
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      <Video
                        size={32}
                        color="#38bdf8"
                      />

                      <div
                        style={{
                          marginTop:
                            12,
                          fontWeight:
                            700,
                        }}
                      >
                        CCTV Stream
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize:
                            11,
                          marginTop:
                            5,
                        }}
                      >
                        MP4 / video
                      </div>
                    </button>

                    <button
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        audioInputRef.current?.click()
                      }
                      className="glass-panel"
                      style={{
                        minHeight:
                          150,
                        padding: 20,
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      <Radio
                        size={32}
                        color="#f59e0b"
                      />

                      <div
                        style={{
                          marginTop:
                            12,
                          fontWeight:
                            700,
                        }}
                      >
                        Acoustic Signature
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize:
                            11,
                          marginTop:
                            5,
                        }}
                      >
                        WAV / audio
                      </div>
                    </button>
                  </div>

                  {dashboardImage && (
                    <div
                      style={{
                        marginTop:
                          22,
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1.4fr 1fr",
                        gap: 18,
                      }}
                    >
                      <div
                        style={{
                          position:
                            "relative",
                          borderRadius:
                            12,
                          overflow:
                            "hidden",
                          background:
                            "#000",
                        }}
                      >
                        <img
                          src={
                            dashboardImage
                          }
                          alt="Uploaded"
                          style={{
                            width:
                              "100%",
                            height:
                              350,
                            objectFit:
                              "contain",
                          }}
                        />

                        {analyzingUpload && (
                          <>
                            <div className="scan-line" />

                            <div
                              style={{
                                position:
                                  "absolute",
                                inset: 0,
                                display:
                                  "grid",
                                placeItems:
                                  "center",
                                background:
                                  "rgba(0,0,0,.35)",
                                fontWeight:
                                  800,
                              }}
                            >
                              ANALYZING...
                            </div>
                          </>
                        )}

                        {uploadDetection?.box && (
                          <div
                            style={{
                              position:
                                "absolute",
                              top: `${uploadDetection.box.top}%`,
                              left: `${uploadDetection.box.left}%`,
                              width: `${uploadDetection.box.width}%`,
                              height: `${uploadDetection.box.height}%`,
                              border: `3px solid ${
                                uploadDetection.critical
                                  ? "#ef4444"
                                  : "#4ade80"
                              }`,
                              background:
                                uploadDetection.critical
                                  ? "rgba(239,68,68,.15)"
                                  : "rgba(74,222,128,.12)",
                            }}
                          >
                            <div
                              style={{
                                position:
                                  "absolute",
                                top:
                                  -29,
                                left:
                                  -3,
                                padding:
                                  "5px 8px",
                                background:
                                  uploadDetection.critical
                                    ? "#ef4444"
                                    : "#4ade80",
                                color:
                                  "#fff",
                                fontSize:
                                  11,
                                fontWeight:
                                  800,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                uploadDetection.label
                              }{" "}
                              (
                              {Math.round(
                                uploadDetection.confidence *
                                  100
                              )}
                              %)
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className="glass-panel"
                        style={{
                          padding:
                            20,
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              700,
                          }}
                        >
                          Detection Result
                        </div>

                        {uploadDetection ? (
                          <div
                            style={{
                              marginTop:
                                20,
                            }}
                          >
                            <div
                              style={{
                                color:
                                  uploadDetection.critical
                                    ? "#ef4444"
                                    : "#4ade80",
                                fontSize:
                                  20,
                                fontWeight:
                                  800,
                              }}
                            >
                              {
                                uploadDetection.label
                              }
                            </div>

                            <div
                              style={{
                                color:
                                  COLORS.muted,
                                marginTop:
                                  8,
                                fontSize:
                                  12,
                              }}
                            >
                              Confidence:{" "}
                              <strong>
                                {Math.round(
                                  uploadDetection.confidence *
                                    100
                                )}
                                %
                              </strong>
                            </div>

                            <div
                              style={{
                                marginTop:
                                  15,
                              }}
                            >
                              <StatusBadge
                                status={
                                  uploadDetection.critical
                                    ? "OFFLINE"
                                    : "ONLINE"
                                }
                                label={
                                  uploadDetection.threat_level
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              color:
                                COLORS.dim,
                              marginTop:
                                25,
                              fontSize:
                                12,
                            }}
                          >
                            Upload an image
                            and run the
                            backend detector.
                          </div>
                        )}

                        {!backendOnline && (
                          <GlassButton
                            style={{
                              marginTop:
                                25,
                              width:
                                "100%",
                            }}
                            onClick={
                              runDemoDetection
                            }
                            disabled={
                              !dashboardImage ||
                              analyzingUpload
                            }
                            icon={
                              <Zap
                                size={
                                  14
                                }
                              />
                            }
                          >
                            Demo AI Detection
                          </GlassButton>
                        )}
                      </div>
                    </div>
                  )}

                  {uploading && (
                    <div
                      style={{
                        marginTop:
                          18,
                        padding: 12,
                        textAlign:
                          "center",
                        color:
                          "#4ade80",
                        background:
                          "rgba(74,222,128,.05)",
                        borderRadius:
                          8,
                      }}
                    >
                      Processing neural
                      network inference...
                    </div>
                  )}
                </div>
              )}
            </div>);
}
