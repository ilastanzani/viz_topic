<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  const clusterKeywords = {0:["dns research","network train","distribute train","assess internet","detection dns","simulator train","computational train","network verification","internet measurement","dns insight"],1:["data sketch","data largedimensional","data topological","data geospatial","ice predict","mine spatial","kdd research","data geometric","inference largedimensional","arctic data","data representation","datasets polygonal","topographyaware","datasets ice","datasets telematics"],2:["recognition widely","computational vision","pixel representation","recognition rely","compute immersive","harmful image","iccp photography","additive manufacture","differentiable render","computer vision","image representation","3d vision","fidelity image","embed vision","3d camera","image thermal","camera thermal","recognition visual","derivative image"],3:["emergency manager","food insecurity","food system","food security","safety system","safetycritical software","emergency forecast","food urban","landscape urban","communitygenerated food","emergency food","ambulance model","911 service","emergency management","analyze emergency"],4:["computation shape","bound compute","construct heuristic","computation selfassembly","algorithmic selfassembly","computation reversible","numerical software","computational speed","numerical softwarethat","heuristic search","algorithm mcts","ml tool","computation pathfinding"],5:["koastore storage","largescale storage","data storage","storage system","distribute storage","fast storage","computational storage","infrastructure storage","cluster storage","big containerize","research storage","container scalable","device storage","prune","compute storage"],6:["aipowered rehabilitation","autism innovation","health smart","mhealth technology","analytics health","health rf","autistic drivingage","70000 autistic","health technological","health scholar","analytics opioid"],7:["collaborate machine","labor platform","collaborative future","freelance online","collaboration disaster","handwritten manuscript","scholar semantic","labor online","develop freelance","attend codaspy","islamicate manuscript","collaboration skill","algorithm freelance","pivot platform","collaborative write"],8:["datasets scientific","analyze court","data genomics","spatial topographyaware","datasets geochemical","analysis qualitative","data geochemical","geomorphology technological","qualitative research","contextualize geochemical","fuel geomorphology","currently geomorphology"],9:["cryptography publickey","cryptography pqc","fiberbased grind","encryption homomorphic","conference cryptology","fiberbased sense","adopt encryption"],10:["diversity vulnerability","discovery vulnerability","attack vulnerability","evms source","evms vulnerability","enable grisl","core vulnerability","framework sdv","ev management","vulnerability"],11:["learn personalize","ai personalization","ai attend","ai university","ai predict","chatbots solution","assistant intelligent","ai personalize","ai language","aiapplications student","aibased conversational","ai collaborate","artificial intelligencemachine","aibased dialogue","ai conference","ai conversational","ia interaction","ai teacher","ai tennessee"],12:["causal method","academic compute","causality reason","analysis causalitybased","event forecast","award fund","causal discover","causal discovery","creation sample","computational eventbased","causal network"],13:["accountable software","program specification","responsibility software","software system","julia programmer","program universe","probabilistic program","julia language","program support","concept julia","accountability software","reliability software","infrastructure monitor"],14:["ai security","ai companionship","aipowered developer","ai companion","ai hardware","ai design","ai centerstructures","ai healthcare","ai improvement","ai clinician","ai researcher","ai sentence","aipowered software","ai disease","ai designer","ai tech","ai fpga","ai surrogate","ai education","ai medical","ai research","ai clinical","ai chip","ai tool","ai workforce"],15:["hilcr robotics","robot validation","research robot","autonomy machine","assistive navigation","autonomous multiagent","robotics soft","navigation robot","indoor navigation","experience robot","industrial robotic","active robot","project robot","accessible navigation","perception robotic","robot soft","autonomy highway","autonomous task","craftwork robotic","reconfigurable robotics","observe robot","manipulation robotic","assistance travel"],16:["cyber energy","energy harvest","collect energy","energy internet","ioe renewable","energy oklahoma","energyefficient transfer","gigawatt save","cache energy","data energyefficient","grid power","energyefficient house","energy smart","energy ioe","energy sustainable"],17:["courselets testbeds","curriculum michigan","student write","msu student","learn student","algebra prepare","c education","education hub","content courselets","iccp student","group student","csp teacher","education research","assessment student","base courselets","compute education","compute educational","c teach"],18:["hospitality humancomputer","grasp soft","automation laboratory","service telehealth","grasp project","automation hospitality","control industrial","hand prosthetic","hospitality workforce","tactile visual","automate hand","automate volunteer","sensor tactile"],19:["computer science","curriculum engineer","engineer rse","ap csp","csforall technical","csforall research","csp enrollment","apprenticeship program","practitionerinstructors rse","computer undergraduate","instructor rse","assessment automatic","ppls program","csforall proposal"],20:["engineer performance","organization tech","technology train","learn technology","meet tech","athletics technological","broad tech","athletics science","skill technical","child technology","athleticcentered learn","engineer science","biomedical engineer","learn task","retrofit skill"],21:["ar mobile","detection novelty","flow validation","detection object","flow tourism","detection error","plan tourism","flow information"],22:["classroom communication","linguistic mental","communication sense","interpretation semantic","audio student","audio classroom","islamicate text","aibased teacher","community teacher"],23:["traceable zerotrust","attack online","application malicious","attack endpoint","data zerotrust","security symposium","security usenix","endpoint security","attack project","grisl protect","rout securityfocused","attack hate","attack rowhammer"],24:["cyberthreats ml","automotive cyber","cyberinfrastructure transportation","cyberphysical treatment","cyberphysical system","cybersecurity vehicle","cybertraining program","cyberphysical verification","automate defense","cyberenabled manufacture","compute cybermanufacturing","cyberspace satc","cyberworkforce material","infrastructuresecurity rout","cybersecurity manufacture","cyberphysical medical"],25:["internet prison","juvenile risk","juvenile use","improve prisoner","kiosk telehealth","system unman","opportunity unman","opportunity prisoner","risk youth","unman"],26:["edge learn","b5g edge","application edgetocloud","edge project","edge intelligence","compute edge","edge iot","edge runtime","edgetocloud solution","edge vision","edge server","edgecloud system","diamond service","compute edgetocloud","diamond","computer edge","edgecloud infrastructure"],27:["performance schedule","scalable schedule","contention resource","compute render"],28:["biometrics","web3db zerotrust","biometric security","authenticationtracking novel","biometric","biometrics mobile","attack biometric","authentication daily","biometric vulnerability","biometrics new","biometrics recognition","biometrics human","authentication tool"],29:["brain record","categorization cortex","network neural","olfactory train","cortex prefrontal","neural tactile","olfactory physical","headband neuroimaging","disentangle neural","datasets neuroscience","inference neuromodulation","data neuroimaging","brain connectivity","brain wave","neural record","brain recording","brain model","brain neuromodulation","neural retina","brain network","intervention sensory","biomarkers headband","neural physicsinformedconstrained","neural small"],30:["data moisture","data surface","data gi","data use","data search","overcome sql","sql udf","data sewage","database vldb","dbt system","data material","data source","data infrastructure","challenge dbt","data link","data pathology","database system","datapaths kernel","data integration","database spatial","data program","dbt translation","datamanagement need"],31:["securely workflow","attestation framework","enclave use","enforcement runtime","application fault","can security","kernel security","enforcement informationflow","conference security","anomaly detection","faulttolerance scheme","adversarial security","award security","enclave secure"],32:["network overlay","lowlatency rdma","server switch","packet switch","network rdma","network overlayunderlay","network optical","access rdma","application network","3d network","nomammwavemamimo optimization","network technology","network update","nomammwavemamimo technology","nomammwavemamimo system","network nextg","aperture radar"],33:["court data","data vaccination","counsel dataset","datafree knowledge","dataintensive science","data student","data health","brimi information","data educational","data storytelling","data storyteller","data expertise","data sequence","data literacy","data develop","data science","data disaster","data volunteer","data story","dataintensive scientist","bigdata learn","data qualitative"],34:["sdvs vehicle","occupation truck","symposium vehicle","autonomy vehicle","guide uavs","automate truck","automate vehicle","drone surveillance","security vehicle","truck work","uavs vehicle","map uavs"],35:["fully homomorphic","krylov subspace","homomorphic","abstraction update","nizk proof","compilation parallelization","algebraic set","abstractionrefinement verification","abstraction nizk","compilation parallelize","computation parallel","parallelization schedule","operation subspace"],36:["computation stream","algorithm stream","compute stream","monitor stream","scalable stream","data stream","concurrent data","analytics stream"],37:["deeplearning hardware","deepfake detection","3dprinted electrode","application deepfakes","deepfakes detect","deepfakes video"],38:["house identification","house improve","house refugee","integration refugee","house quantification","develop house","house zone"],39:["notebook platform","colgate supercomputer","ahead supercomputing","optimize supercomputer","general prefetching","carbonefficient notebook","framework prefetching","outoforder processor","supercomputer","conference supercomputing","colgates supercomputer","colgate project","generation supercomputer"],40:["smart textile","eeg textile","retina zebrafish","industrial knit","device implantable","odor virtual","device implant","knit machine","immersive meet","meeting virtual","project textile","compile knit","participant virtual","breast tissue","clothe designer","clothe industry"],41:["p4 technology","delay network","blockchain technology","bandwidth delay","congestion delay","congestion prediction","digital infrastructure","latency ultralow","blockchain","latency reduction"],42:["molecule optimization","particle physic","genomics","3d dna","molecule silico","genome material","bioinformatics computational","discovery drug","genomics multimodal","random walk","biology computational","3d molecularscale","bioinformatics cascam","dna software"],43:["reinforcement","deep reinforcement","contrastive learn","framework learn","learn machine","component learn","learn system","computer learn","interpretability spatiotemporal","decentralize learn","control learn","interpretable learn","fl learn","learn reinforcement","active learn","federate learn","distribute learn"],44:["collaboration research","region researcher","object researcher","experimentsasaserviceinfrastructure student","attendee research","msu researcher"],45:["cybercrime investigation","cyberbullying","cyberbullying user","cyberbullying inappropriate","conduct cybercrime","forensics science","forensics workforce","digital forensics","cybercrime study"],46:["molecular simulation","bioengineering project","generative simulation","chemical simulation","cardiovascular simulation","biomechanical simulation","biomechanics simulation","biomechanics graphic","bioinformatics simulation"],47:["llm runtime","cascam compute","cod pt","cod generalize","kernel policy","anticancer optimization","cache cod","enforce hyperproperties","da generalization","llm workload","cod nonlinear","llm optimize","ability generalization"],48:["diffusion influence","material research","dissemination scientific","dissemination science","scidatbench support","collection scidatbench","community scientific","diffusion knowledge","medium science"],49:["dram vulnerability","bioengineering microelectronics","fault hardware","hardware verification","checkpointing train","formal hardware","system test","ic system","checkpoint learn","checkpoint reproducibility","checkpointing use"],50:["astronomical observatory","deep learn","compute experiential","pdeconstrained pdes","harm multimodal","deeplearning model","observatory rout","pde solver","knowledge multimodal"],51:["lsmkvsbased system","performance software","architecture lsmkvs","selfassembly system","performance test","compute reconfigurable","lsmkvsbased optimize","architecture compute","matter reconfigurable","compute performance","architecture mled"],52:["influence social","peer support","mentor network","peer tutor","corpus scholarly","platform social","computational social","learn social","mentorship network","consortium mentor","mentor","mentor peer"],53:["chip eda","critical tool","engineer intelligence"],54:["blackbox model","automate model","learn model","extract spatiotemporal","cad describe","cad program","model program","proposal workshop","agent model","cad model"],55:["infrastructure reproducible","reproducible software","reproducible research","computer reproducibility","analysis infrastructure","infrastructure research","infrastructure language","accessible reproducible","replicability reproducibility"],56:["dnn model","approach pinnpcnn","dnns implementation","dnn hardwarebased","dnns module","gnn model","algorithm gnn","efficient gnn","generalize gnns","dnn workload","dnn maintainability"],57:["development model","language program","model student","introductory program","program stemworks","program study"],58:["minimumcost transport","plan transport","efficient mobility","optimal transport","mobility train","framework transportation","mobility system","bus esbs","mlfpga security"],59:["cluster computer","cluster university","cluster data","cluster computational","cluster ieee","2023 cluster"],60:["impedance tomography","improve ultrasound","slsc ultrasound","beamformer ultrasound","framework ultrasound"],61:["cloud faa","cloud schedule","cloudfpga ml","cloud scalable","cloudfpga compute","cloud resource","carbonefficient cloud","cloud correlationaware"],62:["game theory","dynamic game","efficient sample","compute highperformance","economics game","sample technique","compute strategic","algorithmic game"],63:["computational lattice","algorithm specification","computation reserve","algorithm notebook","algorithm optimal","chinese remainder","award lattice","algorithm lattice","computation verifiable","compute reserve","algorithm generalpurpose","algorithmic replicability","algorithm network","algorithm use","algorithm replicable","remainder robust"],64:["biodiversity research","aienabled ecological","challenge diversity","environmental report","ecosystem research","content personal","countryspecific distinctive","content share","biodiversity ecological"],65:["data iot","b5gbased iot","iot research","iot project","iot multiple","b5g iot","iotbased support","datasets iot"],66:["design meeting","challenge designevaluation","child design","design risk","galaxy project","consumer designer","interactive requirement","design device","design space","community project","design software","design project","project sinapse"],67:["gpus research","gpu project","compute gpu","diverse gpus","energyharvesting gpu","gpus suitability","gpu program","cluster gpu","compute server"],68:["cache design","simulation supercomputer","programmable transistorlevel","transistorlevel trap","p4 programmable"],69:["computational geometry","discretizes shape","complexity","advance computational","complexity impact","communication complexity","complexity research","discretization shape","complexity theory","bring complexity","complexity computational","communication computational"],70:["gnns network","degradation network","community net","community netsvo","functional network","dynamic network","ccmnet effort","compute network","netsvo organization"],71:["cluster conference","conference wsdm","kdd mine","mine wsdm","conference vldb","conference research","cikm library","agenda cikm","conference kdd","conference sigkdd","conference visualization","conference system","cikm conference"],72:["flag perception","flag information","activity cognitive","cognitive leadership","cognitive learner","brain learn","cognitive synchronization","flag","cognitive task","cognitive workload"],73:["management water","footprint water","epidemiology wastewaterbased","manage water","stormwater wastewater","account water","plan water","urban water","system water"],74:["opensource","explore openness","opensource streamci","openness study","ecosystem opensource","open science","accountability opensource","challenge openness","opensource research","open scholarship","open scholar","governance opensource","openhmi opensource"],75:["consortium cyberinfrastructure","cyberattacks transportation","assistive malicious","cyberthreats defense","cyberattack intelligenceaidriven","cyberinfrastructure education","cyberattack detection","cyberinfrastructures secure","ai cybersecurity","cyberattack innetwork"],76:["dialogue policy","recognize utterance","intelligibility speech","speechtotext systemswhich","conversation purposeful","development speech","speechtotext system","speech toxic","develop speechtotext","conversational purposeful"],77:["fairness framework","allocation fair","bias language","fairness machinelearning","allocation fairness","machine unfairness","decision fairness","fairness implement","bias unfairness","bias health","bias design","ai bias"],78:["ar utilize","augment utilize","interactive tourism","augmentation data","em reality","ar reality","augment reality","augment virtual"],79:["distribute test","distribute ml","distribute manufacture","distribute scalable","distribute executionapplication","distribute system","application distribute","computational distribute","algorithm distribute","distribute execution","compute distribute"],80:["accessibility professional","disability information","accessibility student","accessibility xr","accessibility sidewalk","disability exist","disability project","blind individual","3d disability"],81:["6g generation","5g environment","mobile vpn","cellular cryptographic","6g wireless","6g requirement","cellular requirement","cellular infrastructure","cellular emergency","mobile vpns","cellular service","5g implementation","5g communication"],82:["infrastructure nextg","battery technology","rimenhanced wireless","machinelearning wireless","insight wireless","professional wireless","crowd wireless","train wireless","innovation wireless","infrastructure wireless","technology wireless","network wireless","nextgeneration wireless"],83:["cp responder","community risk","community data","burn community","community mental","community paramedic","community health","community paramedicine","coastal community","community sense"],84:["flood map","collectively hazardscapes","disaster management","river yukonkuskokwin","hazardscapes","kanektok river","flood quinhagak","disaster flood","digital disaster","disaster simulation","fire safety","disaster science"],85:["share spectrum","spectrum utilization","access spectrum","distribute spectrum","management spectrum","spectrum workforce"],86:["design visualization","uncertainty visualization","research visualization","researcher wsdm","guideline visualization","use visual","textual visual","practice visualization"],87:["resilience","research resilience","human resilience","multiagent resilience","autonomous resilient"],88:["programmer quantum","quantumcomputing","quantumenergy workforce","encryption quantumresistant","quantum secure","computer quantum","algorithm quantumcomputing","ai quantumcomputing","publickey quantumresistant","processor quantum","algorithm quantum","cloud quantum","accelerator quantumclassical","cryptosystems quantumsafe","compute quantumclassical","compute quantum","hardware quantum","quantumenergy train","compute photonic","quantum security","compiler quantum","quantum schedule"],89:["graphbased interpretation","graph neural","graph interpretation","graphstructured knowledge","graph optimization","graph spanner","graphbased semisupervised","graph network","ai graphbased","graph process","graph knowledge","graphbased information","graph large"],90:["ai privacyaware","genomic privacy","consent content","danger privacy","challenge privacy","privacy research","privacy understand","privacy visual","privacypreserving technology","privacy vehiclesec","privacy vpn","incident privacy","privacy technology","codaspy privacy","concern privacy","breach privacy","privacy project"],91:["consume news","asiantargeting disinformation","detect ideological","gender race","color woman","black woman","asiantargeted disinformation","disinformation racial","ideology news"],92:["mcu system","labonchip microfluidic","memory secure","batteryfree microfliers","microfliers network","communicate microfliers","controlflow mcu","hardware mcuspecific","biochip microfluidic","cyberphysical microfluidic"],93:["feature rl","cancer heart","hydrogen material","application hydrogen","cardiovascular model","feature generate","electrocardiogramsecgbased model","feature generation"],94:["develop regex","decode grammarconstrained","teacher virtual","neural parser","grammar specification","exist grammarconstrained","language technology","engine regex"],95:["approximation reconfiguration","mcts method","collective optimize","online optimization","optimization policy","mcts methodology","optimal plan","communication reversible"],96:["compute science","scientific software","faa workflow","compute research","scientific workflow","scienceware workflow","compute sustainability","compute scientific"],97:["dataintensive realtime","realtime topological","prediction topological","realtime transaction","data realtime"],98:["adversarial protocol","hardware secure","identify protocol","adversary protocol","ic protocol","protocol reversible"],99:["initiative research","iccp participation","compute university","collaboration reproducibility","initiative science","initiative reproducibility"],100:["datadriven optimize","datadriven discovery","datadriven research","datadriven optimization","datadriven pitfall","datadriven science"],101:["algorithm parallel","polynomial system","computation graph","graph parallelize","algorithm subspace","algorithm graph"],102:["monitor reliable","check monitor","pi proposal","model monitor","mhealth monitor","application xr","grind monitor","capability monitor","application rl"],103:["addiction indiana","pain supervise","assessment pain","health sense","agriculture smart","rehabilitation task","classification pain","rehabilitation stroke"],104:["simulation system","highenergy simulation","simtoreal simulationtoreality","perform simulation","memory simulation","chrono experiment","scientific simulation","breakthrough simulation","pipeline simulationanalysis","chrono simulation","gem5 simulation","chrono computer"],105:["laboratory selfdriving","bayesian pinns","chess nsf","bayesian physicsinformed","chain markov","nsf project","markov walk","nsf"],106:["communication underwater","backscatter underwater","underwater vehicle","autonomous underwater","robot underwater"],107:["intelligence pandemic","pandemic symposium","intelligence pandemicprevention","covid19 pandemic","project vaccination","vaccination workflow","future pandemicready","pandemic prediction"],108:["cnn hardwareaccelerator","accelerator securely","accelerator axdnns","accelerator cnn","accelerator cloudbased","accelerator dnn","accelerator cnnbench"],109:["report transparency","ensure transparency","research transparencycertified","transparency trustworthy","platform transparency"],110:["doctoral mentor","consortium doctoral","counsel model","doctoral interaction","advisor doctoral","classify counselor","attendee doctoral","doctoral present"],111:["compression program","compression scientific","compression requirementoriented","assessment compression","compression predictionbased","compression optimize","compression cyberinfrastructure"],112:["gem5 infrastructure","memory order","dram memory","bandwidth memory","consistency memory","hardware pim","hardware memory"],113:["wildfirespecific","fire plan","wildfire","explore wildfirespecific","fire land","information wildfirerelated"],114:["cluster hpc","advance hpc","hpc system","evolution hpc","application hpc","compute hpc","collaborative hpcc","algorithm hpc","hpc performance","hpdc research","collaborative hpc","hpc workflow","hpc infrastructure","hpc program"],115:["platform prognostic","probabilistic prognostic","analytics prognostic","faasr software","agroecosystems computationally","model soil","agroecology computational","predict soil"],116:["generativeadversarial network","deep generative","basic generativeadversarial","reconstruct turbulence","laboratory system","generative model","generative network"],117:["cybersecurity t3ciders","cybersecurity management","cybersecurity sm","cybersecurity smart","cybersecurity expertannotated","cybersecurity field","cybersecurity technology","cybersecurity framework","cybersecurity involve","cybersecurity future","cybersecurity proposal","cybersecurity identify","automate cybersecurity","cybersecurity infrastructure","cybersecurity hide","advance cybersecurity","cybersecurity ml","cybersecurity","communitylevel cybersecurity","cybersecurity machine","community cybersecurity","cybersecurity train","cybersecurity education","cybersecurity research","ci cybersecurity"],118:["crowdsourcing","crowdsourcing system","machine vote","crowdsourcing task"]};

  const TREE = {"name":"node_236","dist":24.357,"children":[{"name":"node_234","dist":14.911,"children":[{"name":"node_228","dist":5.913,"children":[{"name":"node_214","dist":1.955,"children":[{"name":"node_193","dist":1.066,"children":[{"name":"node_134","dist":0.414,"children":[{"id":30,"name":"30","cx":1.458,"cy":2.651,"kwcount":23,"kw0":"data moisture"},{"id":100,"name":"100","cx":1.809,"cy":2.43,"kwcount":6,"kw0":"datadriven optimize"}]},{"name":"node_169","dist":0.654,"children":[{"id":33,"name":"33","cx":1.044,"cy":2.824,"kwcount":22,"kw0":"court data"},{"name":"node_148","dist":0.47,"children":[{"id":1,"name":"1","cx":1.612,"cy":3.222,"kwcount":15,"kw0":"data sketch"},{"id":8,"name":"8","cx":1.156,"cy":3.331,"kwcount":12,"kw0":"datasets scientific"}]}]}]},{"name":"node_198","dist":1.248,"children":[{"name":"node_153","dist":0.519,"children":[{"id":71,"name":"71","cx":1.859,"cy":4.034,"kwcount":13,"kw0":"cluster conference"},{"id":86,"name":"86","cx":1.344,"cy":3.965,"kwcount":8,"kw0":"design visualization"}]},{"name":"node_177","dist":0.718,"children":[{"id":59,"name":"59","cx":2.36,"cy":3.684,"kwcount":6,"kw0":"cluster computer"},{"id":97,"name":"97","cx":2.057,"cy":3.033,"kwcount":5,"kw0":"dataintensive realtime"}]}]}]},{"name":"node_222","dist":3.108,"children":[{"name":"node_197","dist":1.21,"children":[{"name":"node_161","dist":0.577,"children":[{"id":36,"name":"36","cx":2.92,"cy":4.161,"kwcount":8,"kw0":"computation stream"},{"id":79,"name":"79","cx":3.497,"cy":4.136,"kwcount":11,"kw0":"distribute test"}]},{"name":"node_184","dist":0.822,"children":[{"id":89,"name":"89","cx":4.273,"cy":4.583,"kwcount":13,"kw0":"graphbased interpretation"},{"name":"node_136","dist":0.427,"children":[{"id":63,"name":"63","cx":3.356,"cy":4.686,"kwcount":16,"kw0":"computational lattice"},{"id":101,"name":"101","cx":3.782,"cy":4.695,"kwcount":6,"kw0":"algorithm parallel"}]}]}]},{"name":"node_207","dist":1.584,"children":[{"id":114,"name":"114","cx":3.607,"cy":1.934,"kwcount":14,"kw0":"cluster hpc"},{"name":"node_182","dist":0.808,"children":[{"id":5,"name":"5","cx":3.175,"cy":3.395,"kwcount":15,"kw0":"koastore storage"},{"id":111,"name":"111","cx":3.963,"cy":3.215,"kwcount":7,"kw0":"compression program"}]}]}]}]},{"name":"node_230","dist":6.798,"children":[{"name":"node_225","dist":3.529,"children":[{"name":"node_203","dist":1.445,"children":[{"name":"node_163","dist":0.611,"children":[{"id":44,"name":"44","cx":0.545,"cy":4.043,"kwcount":6,"kw0":"collaboration research"},{"name":"node_150","dist":0.482,"children":[{"id":48,"name":"48","cx":0.968,"cy":4.377,"kwcount":9,"kw0":"diffusion influence"},{"id":99,"name":"99","cx":0.581,"cy":4.663,"kwcount":6,"kw0":"initiative research"}]}]},{"name":"node_166","dist":0.634,"children":[{"id":7,"name":"7","cx":-0.14,"cy":4.141,"kwcount":15,"kw0":"collaborate machine"},{"name":"node_121","dist":0.363,"children":[{"id":52,"name":"52","cx":0.063,"cy":3.835,"kwcount":12,"kw0":"influence social"},{"id":110,"name":"110","cx":0.24,"cy":3.517,"kwcount":8,"kw0":"doctoral mentor"}]}]}]},{"name":"node_215","dist":2.046,"children":[{"name":"node_176","dist":0.717,"children":[{"name":"node_126","dist":0.387,"children":[{"id":55,"name":"55","cx":0.98,"cy":5.063,"kwcount":9,"kw0":"infrastructure reproducible"},{"id":115,"name":"115","cx":1.296,"cy":5.285,"kwcount":8,"kw0":"platform prognostic"}]},{"name":"node_139","dist":0.436,"children":[{"id":12,"name":"12","cx":1.681,"cy":4.855,"kwcount":11,"kw0":"causal method"},{"id":96,"name":"96","cx":1.263,"cy":4.73,"kwcount":8,"kw0":"compute science"}]}]},{"name":"node_179","dist":0.746,"children":[{"name":"node_120","dist":0.362,"children":[{"id":13,"name":"13","cx":0.638,"cy":5.338,"kwcount":13,"kw0":"accountable software"},{"id":57,"name":"57","cx":0.311,"cy":5.494,"kwcount":6,"kw0":"development model"}]},{"name":"node_129","dist":0.392,"children":[{"id":54,"name":"54","cx":0.422,"cy":5.937,"kwcount":10,"kw0":"blackbox model"},{"id":102,"name":"102","cx":0.813,"cy":5.91,"kwcount":9,"kw0":"monitor reliable"}]}]}]}]},{"name":"node_229","dist":6.102,"children":[{"name":"node_209","dist":1.647,"children":[{"name":"node_133","dist":0.406,"children":[{"id":90,"name":"90","cx":-1.666,"cy":2.851,"kwcount":17,"kw0":"ai privacyaware"},{"id":109,"name":"109","cx":-1.305,"cy":3.038,"kwcount":5,"kw0":"report transparency"}]},{"name":"node_205","dist":1.523,"children":[{"name":"node_159","dist":0.565,"children":[{"id":77,"name":"77","cx":-1.968,"cy":4.074,"kwcount":12,"kw0":"fairness framework"},{"id":91,"name":"91","cx":-1.404,"cy":4.107,"kwcount":9,"kw0":"consume news"}]},{"name":"node_162","dist":0.589,"children":[{"id":74,"name":"74","cx":-0.519,"cy":3.488,"kwcount":13,"kw0":"opensource"},{"name":"node_138","dist":0.432,"children":[{"id":64,"name":"64","cx":-1.058,"cy":3.647,"kwcount":9,"kw0":"biodiversity research"},{"id":118,"name":"118","cx":-0.773,"cy":3.971,"kwcount":4,"kw0":"crowdsourcing"}]}]}]}]},{"name":"node_219","dist":2.839,"children":[{"name":"node_202","dist":1.35,"children":[{"name":"node_135","dist":0.424,"children":[{"id":17,"name":"17","cx":-0.058,"cy":4.725,"kwcount":18,"kw0":"courselets testbeds"},{"id":19,"name":"19","cx":0.023,"cy":5.141,"kwcount":14,"kw0":"computer science"}]},{"name":"node_175","dist":0.684,"children":[{"id":76,"name":"76","cx":-1.224,"cy":4.743,"kwcount":10,"kw0":"dialogue policy"},{"name":"node_146","dist":0.464,"children":[{"id":22,"name":"22","cx":-0.737,"cy":4.824,"kwcount":9,"kw0":"classroom communication"},{"id":94,"name":"94","cx":-0.705,"cy":5.287,"kwcount":8,"kw0":"develop regex"}]}]}]},{"name":"node_218","dist":2.468,"children":[{"name":"node_192","dist":1.049,"children":[{"name":"node_127","dist":0.389,"children":[{"id":20,"name":"20","cx":-0.571,"cy":5.848,"kwcount":15,"kw0":"engineer performance"},{"id":43,"name":"43","cx":-0.217,"cy":6.008,"kwcount":17,"kw0":"reinforcement"}]},{"name":"node_155","dist":0.53,"children":[{"id":29,"name":"29","cx":-0.465,"cy":6.868,"kwcount":24,"kw0":"brain record"},{"id":72,"name":"72","cx":-0.737,"cy":6.413,"kwcount":10,"kw0":"flag perception"}]}]},{"name":"node_196","dist":1.127,"children":[{"id":107,"name":"107","cx":-2.136,"cy":6.062,"kwcount":8,"kw0":"intelligence pandemic"},{"name":"node_165","dist":0.631,"children":[{"id":53,"name":"53","cx":-1.122,"cy":5.798,"kwcount":3,"kw0":"chip eda"},{"name":"node_137","dist":0.43,"children":[{"id":11,"name":"11","cx":-1.43,"cy":5.209,"kwcount":19,"kw0":"learn personalize"},{"id":14,"name":"14","cx":-1.585,"cy":5.611,"kwcount":25,"kw0":"ai security"}]}]}]}]}]}]}]}]},{"name":"node_235","dist":18.183,"children":[{"name":"node_226","dist":4.256,"children":[{"name":"node_206","dist":1.546,"children":[{"name":"node_144","dist":0.456,"children":[{"id":15,"name":"15","cx":-0.194,"cy":8.277,"kwcount":23,"kw0":"hilcr robotics"},{"id":18,"name":"18","cx":-0.2,"cy":7.82,"kwcount":13,"kw0":"hospitality humancomputer"}]},{"name":"node_201","dist":1.327,"children":[{"name":"node_170","dist":0.657,"children":[{"id":38,"name":"38","cx":-1.037,"cy":8.999,"kwcount":7,"kw0":"house identification"},{"id":87,"name":"87","cx":-0.979,"cy":8.344,"kwcount":5,"kw0":"resilience"}]},{"name":"node_186","dist":0.927,"children":[{"id":60,"name":"60","cx":-0.569,"cy":9.461,"kwcount":5,"kw0":"impedance tomography"},{"name":"node_140","dist":0.438,"children":[{"id":34,"name":"34","cx":0.148,"cy":8.87,"kwcount":12,"kw0":"sdvs vehicle"},{"id":106,"name":"106","cx":-0.285,"cy":8.797,"kwcount":5,"kw0":"communication underwater"}]}]}]}]},{"name":"node_221","dist":2.925,"children":[{"name":"node_167","dist":0.637,"children":[{"id":73,"name":"73","cx":-2.28,"cy":8.922,"kwcount":9,"kw0":"management water"},{"name":"node_124","dist":0.376,"children":[{"id":84,"name":"84","cx":-1.857,"cy":8.577,"kwcount":12,"kw0":"flood map"},{"id":113,"name":"113","cx":-2.132,"cy":8.321,"kwcount":6,"kw0":"wildfirespecific"}]}]},{"name":"node_211","dist":1.729,"children":[{"name":"node_160","dist":0.566,"children":[{"id":80,"name":"80","cx":-1.752,"cy":7.052,"kwcount":9,"kw0":"accessibility professional"},{"name":"node_128","dist":0.391,"children":[{"id":6,"name":"6","cx":-1.527,"cy":6.524,"kwcount":11,"kw0":"aipowered rehabilitation"},{"id":103,"name":"103","cx":-1.318,"cy":6.854,"kwcount":8,"kw0":"addiction indiana"}]}]},{"name":"node_181","dist":0.786,"children":[{"id":25,"name":"25","cx":-0.915,"cy":7.62,"kwcount":10,"kw0":"internet prison"},{"name":"node_149","dist":0.476,"children":[{"id":3,"name":"3","cx":-1.644,"cy":8.091,"kwcount":15,"kw0":"emergency manager"},{"id":83,"name":"83","cx":-1.449,"cy":7.656,"kwcount":10,"kw0":"cp responder"}]}]}]}]}]},{"name":"node_233","dist":12.409,"children":[{"name":"node_231","dist":7.235,"children":[{"name":"node_220","dist":2.885,"children":[{"name":"node_195","dist":1.121,"children":[{"name":"node_154","dist":0.52,"children":[{"id":0,"name":"0","cx":2.893,"cy":7.938,"kwcount":10,"kw0":"dns research"},{"id":41,"name":"41","cx":3.058,"cy":7.445,"kwcount":10,"kw0":"p4 technology"}]},{"name":"node_180","dist":0.778,"children":[{"id":85,"name":"85","cx":3.945,"cy":8.191,"kwcount":6,"kw0":"share spectrum"},{"name":"node_152","dist":0.503,"children":[{"id":32,"name":"32","cx":3.489,"cy":7.882,"kwcount":17,"kw0":"network overlay"},{"id":70,"name":"70","cx":3.626,"cy":7.398,"kwcount":9,"kw0":"gnns network"}]}]}]},{"name":"node_213","dist":1.842,"children":[{"name":"node_168","dist":0.64,"children":[{"id":26,"name":"26","cx":4.673,"cy":8.895,"kwcount":17,"kw0":"edge learn"},{"id":65,"name":"65","cx":4.138,"cy":9.246,"kwcount":8,"kw0":"data iot"}]},{"name":"node_200","dist":1.276,"children":[{"id":16,"name":"16","cx":3.093,"cy":9.726,"kwcount":15,"kw0":"cyber energy"},{"name":"node_145","dist":0.46,"children":[{"id":81,"name":"81","cx":3.288,"cy":8.866,"kwcount":13,"kw0":"6g generation"},{"id":82,"name":"82","cx":3.274,"cy":8.406,"kwcount":13,"kw0":"infrastructure nextg"}]}]}]}]},{"name":"node_223","dist":3.476,"children":[{"name":"node_173","dist":0.676,"children":[{"id":24,"name":"24","cx":1.046,"cy":9.64,"kwcount":16,"kw0":"cyberthreats ml"},{"name":"node_141","dist":0.446,"children":[{"id":45,"name":"45","cx":0.789,"cy":10.251,"kwcount":9,"kw0":"cybercrime investigation"},{"name":"node_119","dist":0.269,"children":[{"id":75,"name":"75","cx":1.14,"cy":10.03,"kwcount":10,"kw0":"consortium cyberinfrastructure"},{"id":117,"name":"117","cx":1.19,"cy":10.294,"kwcount":25,"kw0":"cybersecurity t3ciders"}]}]}]},{"name":"node_199","dist":1.27,"children":[{"name":"node_143","dist":0.452,"children":[{"id":10,"name":"10","cx":0.94,"cy":8.532,"kwcount":10,"kw0":"diversity vulnerability"},{"id":23,"name":"23","cx":1.295,"cy":8.812,"kwcount":13,"kw0":"traceable zerotrust"}]},{"name":"node_194","dist":1.101,"children":[{"name":"node_142","dist":0.452,"children":[{"id":31,"name":"31","cx":1.532,"cy":8.266,"kwcount":14,"kw0":"securely workflow"},{"id":98,"name":"98","cx":1.943,"cy":8.079,"kwcount":6,"kw0":"adversarial protocol"}]},{"name":"node_178","dist":0.72,"children":[{"id":28,"name":"28","cx":1.762,"cy":9.137,"kwcount":13,"kw0":"biometrics"},{"id":58,"name":"58","cx":2.296,"cy":8.653,"kwcount":9,"kw0":"minimumcost transport"}]}]}]}]}]},{"name":"node_232","dist":9.451,"children":[{"name":"node_224","dist":3.512,"children":[{"name":"node_204","dist":1.506,"children":[{"name":"node_157","dist":0.554,"children":[{"id":40,"name":"40","cx":0.23,"cy":7.007,"kwcount":16,"kw0":"smart textile"},{"id":66,"name":"66","cx":0.404,"cy":6.482,"kwcount":13,"kw0":"design meeting"}]},{"name":"node_174","dist":0.677,"children":[{"id":2,"name":"2","cx":0.915,"cy":7.274,"kwcount":19,"kw0":"recognition widely"},{"name":"node_164","dist":0.629,"children":[{"id":21,"name":"21","cx":0.922,"cy":7.949,"kwcount":8,"kw0":"ar mobile"},{"id":78,"name":"78","cx":0.373,"cy":7.642,"kwcount":8,"kw0":"ar utilize"}]}]}]},{"name":"node_216","dist":2.271,"children":[{"name":"node_172","dist":0.671,"children":[{"id":49,"name":"49","cx":1.886,"cy":7.489,"kwcount":11,"kw0":"dram vulnerability"},{"name":"node_131","dist":0.402,"children":[{"id":92,"name":"92","cx":2.305,"cy":7.323,"kwcount":10,"kw0":"mcu system"},{"id":112,"name":"112","cx":2.373,"cy":6.927,"kwcount":7,"kw0":"gem5 infrastructure"}]}]},{"name":"node_208","dist":1.643,"children":[{"name":"node_189","dist":0.962,"children":[{"name":"node_132","dist":0.406,"children":[{"id":37,"name":"37","cx":1.484,"cy":7.168,"kwcount":6,"kw0":"deeplearning hardware"},{"id":116,"name":"116","cx":1.473,"cy":6.762,"kwcount":7,"kw0":"generativeadversarial network"}]},{"name":"node_147","dist":0.467,"children":[{"id":50,"name":"50","cx":1.005,"cy":6.597,"kwcount":9,"kw0":"astronomical observatory"},{"id":93,"name":"93","cx":1.224,"cy":6.184,"kwcount":8,"kw0":"feature rl"}]}]},{"name":"node_191","dist":1.027,"children":[{"name":"node_122","dist":0.37,"children":[{"id":46,"name":"46","cx":1.778,"cy":6.319,"kwcount":9,"kw0":"molecular simulation"},{"id":104,"name":"104","cx":2.127,"cy":6.441,"kwcount":12,"kw0":"simulation system"}]},{"name":"node_123","dist":0.371,"children":[{"id":42,"name":"42","cx":1.713,"cy":5.889,"kwcount":14,"kw0":"molecule optimization"},{"id":105,"name":"105","cx":1.653,"cy":5.523,"kwcount":8,"kw0":"laboratory selfdriving"}]}]}]}]}]},{"name":"node_227","dist":4.759,"children":[{"name":"node_212","dist":1.824,"children":[{"name":"node_185","dist":0.823,"children":[{"id":61,"name":"61","cx":4.564,"cy":6.208,"kwcount":8,"kw0":"cloud faa"},{"name":"node_130","dist":0.394,"children":[{"id":56,"name":"56","cx":4.26,"cy":7.044,"kwcount":11,"kw0":"dnn model"},{"id":108,"name":"108","cx":4.528,"cy":6.756,"kwcount":7,"kw0":"cnn hardwareaccelerator"}]}]},{"name":"node_188","dist":0.95,"children":[{"id":9,"name":"9","cx":4.478,"cy":5.379,"kwcount":7,"kw0":"cryptography publickey"},{"id":88,"name":"88","cx":5.335,"cy":5.79,"kwcount":22,"kw0":"programmer quantum"}]}]},{"name":"node_217","dist":2.373,"children":[{"name":"node_190","dist":0.983,"children":[{"name":"node_151","dist":0.487,"children":[{"id":4,"name":"4","cx":2.952,"cy":4.9,"kwcount":13,"kw0":"computation shape"},{"name":"node_125","dist":0.384,"children":[{"id":51,"name":"51","cx":3.056,"cy":5.385,"kwcount":11,"kw0":"lsmkvsbased system"},{"id":95,"name":"95","cx":2.698,"cy":5.245,"kwcount":8,"kw0":"approximation reconfiguration"}]}]},{"name":"node_171","dist":0.658,"children":[{"id":62,"name":"62","cx":2.159,"cy":5.164,"kwcount":8,"kw0":"game theory"},{"id":69,"name":"69","cx":2.516,"cy":4.611,"kwcount":12,"kw0":"computational geometry"}]}]},{"name":"node_210","dist":1.703,"children":[{"name":"node_183","dist":0.816,"children":[{"id":47,"name":"47","cx":2.559,"cy":5.801,"kwcount":13,"kw0":"llm runtime"},{"name":"node_158","dist":0.563,"children":[{"id":39,"name":"39","cx":3.104,"cy":6.228,"kwcount":13,"kw0":"notebook platform"},{"id":68,"name":"68","cx":2.693,"cy":6.613,"kwcount":5,"kw0":"cache design"}]}]},{"name":"node_187","dist":0.94,"children":[{"id":67,"name":"67","cx":3.74,"cy":6.183,"kwcount":9,"kw0":"gpus research"},{"name":"node_156","dist":0.537,"children":[{"id":27,"name":"27","cx":3.406,"cy":5.638,"kwcount":4,"kw0":"performance schedule"},{"id":35,"name":"35","cx":3.646,"cy":5.158,"kwcount":13,"kw0":"fully homomorphic"}]}]}]}]}]}]}]}]};

  // ── Granularity helpers ───────────────────────────────────────────────────────
  function cutTree(node, threshold) {
    if (!node.children) return [[node.id]];
    if (node.dist <= threshold) {
      var leaves = [];
      function collectLeaves(n) {
        if ('id' in n) leaves.push(n.id);
        else if (n.children) n.children.forEach(collectLeaves);
      }
      collectLeaves(node);
      return [leaves];
    }
    return node.children.reduce(function(acc, c) {
      return acc.concat(cutTree(c, threshold));
    }, []);
  }

  var LEVEL_THRESHOLDS = [0, 2.0, 6.5, 14.0, 25.0];
  var LEVEL_LABELS = ['Keywords', 'Fine', 'Medium', 'Coarse', 'Root'];

  function getGroupsAtLevel(level) {
    return cutTree(TREE, LEVEL_THRESHOLDS[level]);
  }

  function buildMergedCluster(ids, groupIdx) {
    var leaves = aggClusters.filter(function(c) { return ids.indexOf(c.id) !== -1; });
    var cx = d3.mean(leaves, function(d) { return d.cx; });
    var cy = d3.mean(leaves, function(d) { return d.cy; });
    var kwcount = d3.sum(leaves, function(d) { return d.kwcount; });
    var kw0 = leaves.length > 0 ? leaves[0].kw0 : '';
    return { id: groupIdx, ids: ids, cx: cx, cy: cy, kwcount: kwcount, kw0: kw0 };
  }

  function getGroupColor(ids) {
    return colorScale(d3.mean(ids));
  }

  function getDisplayClusters(level) {
    if (level === 0) {
      return aggClusters.map(function(d) {
        return Object.assign({}, d, { ids: [d.id], groupIdx: d.id, color: colorScale(d.id) });
      });
    }
    var groups = getGroupsAtLevel(level);
    return groups.map(function(ids, groupIdx) {
      var m = buildMergedCluster(ids, groupIdx);
      return Object.assign({}, m, { groupIdx: groupIdx, color: getGroupColor(ids) });
    });
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  let selectedId = null;
  let hoveredId  = null;
  let granularity = 2;
  let isTransitioning = false;

  // Svelte 4 reactive declarations
  $: activeDisplayClusters = getDisplayClusters(granularity);
  $: activeCluster = selectedId !== null ? activeDisplayClusters[selectedId] : null;
  $: displayKws = (function() {
    if (!activeCluster) return [];
    if (granularity === 0) return clusterKeywords[activeCluster.id] || [];
    var allKws = (activeCluster.ids || []).reduce(function(acc, id) {
      return acc.concat(clusterKeywords[id] || []);
    }, []);
    return allKws.slice(0, 40);
  })();
  $: listTitle = selectedId !== null
    ? ('Cluster ' + selectedId + ' — ' + (activeCluster && activeCluster.ids ? activeCluster.ids.length : 1) + ' leaf cluster' + ((activeCluster && activeCluster.ids && activeCluster.ids.length !== 1) ? 's' : ''))
    : hoveredId !== null
    ? ('Cluster ' + hoveredId + ' (hover)')
    : 'Click a bubble to see keywords';
  $: granTrackWidth = (granularity / 4) * 100;

  // Flat cluster list (leaf nodes only)
  var aggClusters = (function() {
    var list = [];
    function walk(n) {
      if ('id' in n) list.push({ id: n.id, cx: n.cx, cy: n.cy, kwcount: n.kwcount, kw0: n.kw0 });
      else if (n.children) n.children.forEach(walk);
    }
    walk(TREE);
    return list.sort(function(a, b) { return a.id - b.id; });
  })();

  var colorScale = d3.scaleSequential(d3.interpolateTurbo).domain([0, 118]);

  let bubbleEl;
  let dendroEl;
  let simulation;
  let bubbleNodes = [];

  // ── BUBBLE CHART ──────────────────────────────────────────────────────────────
  function drawBubble(el, animate) {
    animate = animate || false;
    var W = el.clientWidth  || 600;
    var H = el.clientHeight || 500;

    var displayClusters = getDisplayClusters(granularity);

    var xExt = d3.extent(aggClusters, function(d) { return d.cx; });
    var yExt = d3.extent(aggClusters, function(d) { return d.cy; });
    var xSc  = d3.scaleLinear().domain([xExt[0]-0.5, xExt[1]+0.5]).range([0, W]);
    var ySc  = d3.scaleLinear().domain([yExt[0]-0.5, yExt[1]+0.5]).range([H, 0]);
    var rSc  = d3.scaleSqrt().domain([3, 300]).range([7, 45]);

    var svg = d3.select(el).attr('width', W).attr('height', H);

    var prevByKey = {};
    bubbleNodes.forEach(function(n) {
      var key = n.ids ? n.ids.slice().sort().join(',') : String(n.groupIdx);
      prevByKey[key] = n;
    });

    var newNodes = displayClusters.map(function(d) {
      var tx = xSc(d.cx);
      var ty = ySc(d.cy);
      var r  = rSc(d.kwcount);
      var key = d.ids ? d.ids.slice().sort().join(',') : String(d.groupIdx);
      var prev = prevByKey[key];
      return Object.assign({}, d, {
        r: r, tx: tx, ty: ty,
        x: prev ? prev.x : tx + (Math.random() - 0.5) * 10,
        y: prev ? prev.y : ty + (Math.random() - 0.5) * 10,
        vx: 0, vy: 0
      });
    });

    bubbleNodes = newNodes;
    svg.selectAll('*').remove();

    svg.selectAll('line.cx-h').data(bubbleNodes).join('line').attr('class','cx-h')
      .attr('x1', function(d) { return d.tx-5; }).attr('x2', function(d) { return d.tx+5; })
      .attr('y1', function(d) { return d.ty; }).attr('y2', function(d) { return d.ty; })
      .attr('stroke','#ffffff10').attr('stroke-width',1);
    svg.selectAll('line.cx-v').data(bubbleNodes).join('line').attr('class','cx-v')
      .attr('x1', function(d) { return d.tx; }).attr('x2', function(d) { return d.tx; })
      .attr('y1', function(d) { return d.ty-5; }).attr('y2', function(d) { return d.ty+5; })
      .attr('stroke','#ffffff10').attr('stroke-width',1);

    var keyFn = function(d) { return d.ids ? d.ids.slice().sort().join(',') : String(d.groupIdx); };

    var circles = svg.selectAll('circle.bubble')
      .data(bubbleNodes, keyFn)
      .join(
        function(enter) {
          var e = enter.append('circle').attr('class','bubble')
            .attr('cx', function(d) { return d.tx; })
            .attr('cy', function(d) { return d.ty; })
            .attr('r', 0).attr('opacity', 0);
          if (animate) {
            e.transition().duration(500).delay(function(_, i) { return i * 6; })
              .attr('r', function(d) { return d.r; }).attr('opacity', 0.82);
          } else {
            e.attr('r', function(d) { return d.r; }).attr('opacity', 0.82);
          }
          return e;
        },
        function(update) { return update; },
        function(exit) {
          return exit.transition().duration(350).attr('r', 0).attr('opacity', 0).remove();
        }
      )
      .attr('fill', function(d) { return d.color; })
      .attr('stroke','none').attr('stroke-width',2)
      .style('cursor','pointer')
      .on('mouseenter', function(event, d) {
        hoveredId = d.groupIdx;
        circles
          .attr('r',       function(n) { return n.groupIdx===d.groupIdx ? n.r*1.35 : n.r; })
          .attr('opacity', function(n) { return n.groupIdx===d.groupIdx ? 1 : 0.4; })
          .attr('stroke',  function(n) { return n.groupIdx===d.groupIdx ? '#ffffffcc' : 'none'; });
        labels
          .attr('font-size',   function(n) { return n.groupIdx===d.groupIdx ? '11px' : (n.r>16?'9px':'7px'); })
          .attr('font-weight', function(n) { return n.groupIdx===d.groupIdx ? 'bold' : 'normal'; });
        if (dendroEl) drawDendrogram(dendroEl);
      })
      .on('mouseleave', function() {
        hoveredId = null;
        refreshBubbleStyles();
        if (dendroEl) drawDendrogram(dendroEl);
      })
      .on('click', function(event, d) {
        selectedId = selectedId === d.groupIdx ? null : d.groupIdx;
        refreshBubbleStyles();
        if (dendroEl) drawDendrogram(dendroEl);
      });

    var labels = svg.selectAll('text.blbl')
      .data(bubbleNodes, keyFn)
      .join('text').attr('class','blbl')
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-size', function(d) { return d.r > 16 ? '9px' : '7px'; })
      .attr('fill','#fff').attr('pointer-events','none')
      .text(function(d) {
        if (granularity === 0) return d.id;
        return d.ids && d.ids.length > 1 ? String(d.ids.length) : String(d.ids ? d.ids[0] : d.id);
      });

    refreshBubbleStyles();

    if (simulation) simulation.stop();
    simulation = d3.forceSimulation(bubbleNodes)
      .force('x', d3.forceX(function(d) { return d.tx; }).strength(0.4))
      .force('y', d3.forceY(function(d) { return d.ty; }).strength(0.4))
      .force('collide', d3.forceCollide(function(d) { return d.r + 2; }).strength(0.9).iterations(4))
      .alphaDecay(0.025)
      .on('tick', function() {
        circles.attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; });
        labels.attr('x', function(d) { return d.x; }).attr('y', function(d) { return d.y; });
      });
  }

  function refreshBubbleStyles() {
    if (!bubbleEl) return;
    var svg = d3.select(bubbleEl);
    svg.selectAll('circle.bubble')
      .attr('r', function(d) { return d.r; })
      .attr('fill', function(d) { return selectedId === d.groupIdx ? '#f8c948' : d.color; })
      .attr('opacity', function(d) { return selectedId === null ? 0.82 : selectedId === d.groupIdx ? 1 : 0.25; })
      .attr('stroke', function(d) { return selectedId === d.groupIdx ? '#fff' : 'none'; });
    svg.selectAll('text.blbl')
      .attr('fill', function(d) { return selectedId === d.groupIdx ? '#0f172a' : '#fff'; })
      .attr('font-weight', function(d) { return selectedId === d.groupIdx ? 'bold' : 'normal'; })
      .attr('font-size', function(d) { return d.r > 16 ? '9px' : '7px'; });
  }

  // ── DENDROGRAM ───────────────────────────────────────────────────────────────
  function drawDendrogram(el) {
    var W = el.clientWidth  || 400;
    var H = el.clientHeight || 240;
    var m  = { top:14, right:12, bottom:24, left:38 };
    var iw = W - m.left - m.right;
    var ih = H - m.top  - m.bottom;
    var maxDist = TREE.dist;
    var root = d3.hierarchy(TREE, function(n) { return n.children; });
    d3.cluster().size([iw, ih])(root);
    var yScale = d3.scaleLinear().domain([0, maxDist]).range([ih, 0]);
    root.each(function(node) {
      node.y = yScale(node.data.dist != null ? node.data.dist : 0);
    });

    var cutY = yScale(LEVEL_THRESHOLDS[granularity]);

    var svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-iw))
      .call(function(ax) {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke','#1e3a5f').attr('stroke-dasharray','2,3');
        ax.selectAll('.tick text').attr('fill','#475569').attr('font-size','9px');
      });

    if (granularity > 0 && granularity < 4) {
      g.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', cutY).attr('y2', cutY)
        .attr('stroke', '#f8c94855').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');
      g.append('text')
        .attr('x', iw - 2).attr('y', cutY - 3)
        .attr('text-anchor', 'end')
        .attr('font-size', '8px').attr('fill', '#f8c948aa')
        .text(LEVEL_LABELS[granularity]);
    }

    var displayClusters = getDisplayClusters(granularity);
    var activeLeafIds = (selectedId !== null && displayClusters[selectedId] && displayClusters[selectedId].ids)
      ? displayClusters[selectedId].ids : [];

    g.selectAll('path.link')
      .data(root.links()).join('path').attr('class','link')
      .attr('fill','none')
      .attr('stroke', function(d) {
        if (selectedId === null) {
          return d.source.y > cutY ? '#334155' : '#4a6fa5';
        }
        var leafIds = d.target.leaves().map(function(l) { return l.data.id; });
        return leafIds.some(function(id) { return activeLeafIds.indexOf(id) !== -1; })
          ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', function(d) {
        if (selectedId === null) return 1;
        var leafIds = d.target.leaves().map(function(l) { return l.data.id; });
        return leafIds.some(function(id) { return activeLeafIds.indexOf(id) !== -1; }) ? 2 : 0.7;
      })
      .attr('d', function(d) {
        return 'M' + d.source.x + ',' + d.source.y + 'H' + d.target.x + 'V' + d.target.y;
      });

    var leaves = root.leaves();
    g.selectAll('circle.leaf')
      .data(leaves).join('circle').attr('class','leaf')
      .attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; }).attr('r', 3.5)
      .attr('fill', function(d) {
        if (selectedId !== null) {
          return activeLeafIds.indexOf(d.data.id) !== -1 ? '#f8c948' : colorScale(d.data.id);
        }
        return colorScale(d.data.id);
      })
      .attr('stroke-width', 1.5).style('cursor','pointer')
      .on('click', function(event, d) {
        var idx = displayClusters.findIndex(function(c) {
          return c.ids && c.ids.indexOf(d.data.id) !== -1;
        });
        if (idx !== -1) {
          selectedId = selectedId === idx ? null : idx;
          redrawAll();
        }
      });
  }

  // ── Granularity change ────────────────────────────────────────────────────────
  function setGranularity(newLevel) {
    if (newLevel === granularity || isTransitioning) return;
    isTransitioning = true;
    selectedId = null;
    granularity = newLevel;
    if (bubbleEl) drawBubble(bubbleEl, true);
    if (dendroEl) drawDendrogram(dendroEl);
    setTimeout(function() { isTransitioning = false; }, 700);
  }

  function redrawAll() {
    if (bubbleEl) drawBubble(bubbleEl, false);
    if (dendroEl) drawDendrogram(dendroEl);
  }

  onMount(function() {
    redrawAll();
    var ro = new ResizeObserver(redrawAll);
    ro.observe(bubbleEl);
    ro.observe(dendroEl);
    return function() {
      ro.disconnect();
      if (simulation) simulation.stop();
    };
  });
</script>

<style>
  :global(body) { margin:0; background:#0f172a; color:#e2e8f0; font-family:'Inter','Segoe UI',sans-serif; overflow:hidden; }
  .app { display:flex; height:100vh; padding:12px; gap:12px; box-sizing:border-box; }
  .panel { background:#1e293b; border:1px solid #334155; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  .panel-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:9px 14px 7px; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .panel-body { flex:1; overflow:hidden; }
  .left { flex:0 0 62%; }
  .left svg, .right svg { display:block; width:100%; height:100%; }
  .right { flex:1; display:flex; flex-direction:column; gap:12px; }
  .right .panel { flex:1; }
  .list-sub { padding:6px 14px; font-size:11px; color:#94a3b8; border-bottom:1px solid #1e3a5f; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .keyword-list { flex:1; overflow-y:auto; padding:8px 10px; }
  .keyword-list::-webkit-scrollbar { width:4px; }
  .keyword-list::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
  .chip { display:inline-block; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:3px 10px; margin:3px; font-size:11px; color:#94a3b8; transition:all .12s; }
  .chip:hover { background:#1e40af; border-color:#3b82f6; color:#fff; }
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#334155; font-size:12px; gap:6px; }
  .nav { display:flex; gap:6px; padding:8px 14px; background:#0f172a; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .nav a { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#475569; text-decoration:none; padding:4px 10px; border-radius:6px; border:1px solid #334155; transition:all .12s; }
  .nav a:hover { color:#e2e8f0; border-color:#64748b; }
  .nav a.active { color:#f8c948; border-color:#f8c948; }

  .granularity-bar {
    display: flex;
    align-items: center;
    padding: 8px 14px 6px;
    border-bottom: 1px solid #1e3a5f;
    flex-shrink: 0;
    background: #0f172a;
    gap: 8px;
  }
  .gran-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #475569;
    white-space: nowrap;
  }
  .gran-steps {
    display: flex;
    align-items: flex-start;
    flex: 1;
    position: relative;
    padding-top: 7px;
    padding-bottom: 16px;
  }
  .gran-track {
    position: absolute;
    left: 7px;
    right: 7px;
    height: 2px;
    background: #1e3a5f;
    top: 14px;
    pointer-events: none;
    z-index: 0;
    border-radius: 1px;
  }
  .gran-track-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #f8c948);
    transition: width 0.35s ease;
    border-radius: 1px;
  }
  .gran-step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    cursor: pointer;
    gap: 4px;
  }
  .gran-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #334155;
    background: #0f172a;
    transition: all 0.22s ease;
    flex-shrink: 0;
  }
  .gran-step.active .gran-dot {
    background: #f8c948;
    border-color: #f8c948;
    box-shadow: 0 0 8px #f8c94877;
    transform: scale(1.3);
  }
  .gran-step.passed .gran-dot {
    background: #3b82f6;
    border-color: #3b82f6;
  }
  .gran-step:hover .gran-dot {
    border-color: #94a3b8;
  }
  .gran-step-label {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: #475569;
    white-space: nowrap;
    transition: color 0.2s;
  }
  .gran-step.active .gran-step-label { color: #f8c948; }
  .gran-step.passed .gran-step-label { color: #3b82f6; }

  .dendro-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .dendro-svg-wrap {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .dendro-svg-wrap svg {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>

<div class="app">
  <div class="panel left">
    <div class="nav">
      <a href="/">Voronoi</a>
      <a href="/v2">Treemap</a>
      <a href="/v3" class="active">Bubble</a>
    </div>
    <div class="panel-title">Plot Cluster — Bubble Chart</div>
    <div class="panel-body"><svg bind:this={bubbleEl}></svg></div>
  </div>

  <div class="right">
    <div class="panel">
      <div class="panel-title">Agglomerative Clusters</div>
      <div class="dendro-body">
        <div class="granularity-bar">
          <span class="gran-label">Granularity</span>
          <div class="gran-steps">
            <div class="gran-track">
              <div class="gran-track-fill" style="width: {granTrackWidth}%"></div>
            </div>
            {#each LEVEL_LABELS as label, i}
              <div
                class="gran-step {i === granularity ? 'active' : ''} {i < granularity ? 'passed' : ''}"
                on:click={() => setGranularity(i)}
                title="{label}"
              >
                <div class="gran-dot"></div>
                <span class="gran-step-label">{label}</span>
              </div>
            {/each}
          </div>
        </div>
        <div class="dendro-svg-wrap">
          <svg bind:this={dendroEl}></svg>
        </div>
      </div>
    </div>

    <div class="panel" style="flex:0 0 38%;">
      <div class="panel-title">Lista Cluster</div>
      <div class="list-sub">{listTitle}</div>
      <div class="keyword-list">
        {#if displayKws.length > 0}
          {#each displayKws as kw}<span class="chip">{kw}</span>{/each}
        {:else}
          <div class="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Seleziona una bolla
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
