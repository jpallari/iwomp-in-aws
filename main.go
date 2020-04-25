package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ssm"
	git "github.com/go-git/go-git/v5"
	gitPlumbing "github.com/go-git/go-git/v5/plumbing"
	gitTransport "github.com/go-git/go-git/v5/plumbing/transport"
	gitHTTP "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/kelseyhightower/envconfig"
)

type appConfig struct {
	WorkDir     string `default:"."`
	ConfigPath  string `default:"cdk-cd"`
	ProjectName string `required:"true"`
	GitBranch   string `required:"true"`
	Cleanup     bool   `default:"false"`
}

func (c *appConfig) defaultPath() string {
	return fmt.Sprintf("/%s/_default", c.ConfigPath)
}

func (c *appConfig) projectPath() string {
	return fmt.Sprintf("/%s/%s", c.ConfigPath, c.ProjectName)
}

func (c *appConfig) load() error {
	return envconfig.Process("", c)
}

type cdJobConfig struct {
	GitURL        string `json:"gitUrl"`
	GitBranch     string `json:"gitBranch"`
	AuthToken     string `json:"authToken"`
	BasicUsername string `json:"basicUsername"`
	BasicPassword string `json:"basicPassword"`
	DeployDir     string `json:"deployDir"`
}

func (c *cdJobConfig) load(ac *appConfig, sess *session.Session) error {
	ssmSVC := ssm.New(sess)

	// Load defaults first
	{
		defaultPath := ac.defaultPath()
		defaultsOut, err := ssmSVC.GetParameter(&ssm.GetParameterInput{
			Name:           aws.String(defaultPath),
			WithDecryption: aws.Bool(true),
		})
		if err == nil {
			if err := c.loadFromParameter(defaultsOut.Parameter); err != nil {
				log.Printf("failed to load defaults from SSM path %s: %s", defaultPath, err)
			}
		} else {
			log.Printf("failed to fetch defaults from SSM path %s: %s", defaultPath, err)
		}
	}

	// Load the project details second
	projectPath := ac.projectPath()
	projectOut, err := ssmSVC.GetParameter(&ssm.GetParameterInput{
		Name:           aws.String(projectPath),
		WithDecryption: aws.Bool(true),
	})
	if err != nil {
		return fmt.Errorf("failed to fetch from SSM path %s: %s", projectPath, err)
	}
	if err := c.loadFromParameter(projectOut.Parameter); err != nil {
		return fmt.Errorf("failed to load from SSM path %s: %s", projectPath, err)
	}

	// Fill in the gaps
	if c.DeployDir == "" {
		c.DeployDir = "."
	}
	if c.GitBranch == "" {
		c.GitBranch = "master"
	}

	return nil
}

func (c *cdJobConfig) loadFromParameter(parameter *ssm.Parameter) error {
	return json.Unmarshal([]byte(*parameter.Value), c)
}

func (c *cdJobConfig) gitAuth() gitTransport.AuthMethod {
	if c.AuthToken != "" {
		return &gitHTTP.TokenAuth{
			Token: c.AuthToken,
		}
	}
	if c.BasicPassword != "" {
		return &gitHTTP.BasicAuth{
			Username: c.BasicUsername,
			Password: c.BasicPassword,
		}
	}

	return nil
}

func main() {
	if err := mainWithErr(); err != nil {
		log.Fatalf("aws-cdk-cd fail: %s", err)
	}
}

func mainWithErr() error {
	// Load app config
	var appConf appConfig
	if err := appConf.load(); err != nil {
		return err
	}

	// Start AWS session
	sess, err := session.NewSession(&aws.Config{})
	if err != nil {
		return err
	}

	// Load config for the CD job
	var cdJobConf cdJobConfig
	if err := cdJobConf.load(&appConf, sess); err != nil {
		return err
	}

	// Clone repo
	if err := cloneRepository(&appConf, &cdJobConf); err != nil {
		return err
	}

	// Setup env and run CDK
	if err := setupEnv(&cdJobConf); err != nil {
		return err
	}
	if err := runCDK(&appConf, &cdJobConf); err != nil {
		return err
	}

	return nil
}

func cloneRepository(appConf *appConfig, cdJobConf *cdJobConfig) error {
	_, err := git.PlainClone(appConf.WorkDir, false, &git.CloneOptions{
		URL:           cdJobConf.GitURL,
		Auth:          cdJobConf.gitAuth(),
		ReferenceName: gitPlumbing.NewBranchReferenceName(appConf.GitBranch),
		SingleBranch:  true,
		Progress:      os.Stdout,
		Depth:         1,
	})
	return err
}

func setupEnv(cdJobConf *cdJobConfig) error {
	return command(cdJobConf.DeployDir, "npm", "install").Run()
}

func runCDK(appConf *appConfig, cdJobConf *cdJobConfig) error {
	// Changes are only deployed when the given branch matches the project deploy branch
	if appConf.GitBranch == cdJobConf.GitBranch {
		return command(
			cdJobConf.DeployDir,
			"cdk", "deploy", "--require-approval=never", "*",
		).Run()
	}

	// ...otherwise we just print a diff
	return command(cdJobConf.DeployDir, "cdk", "diff", "*").Run()
}

func command(directory string, name string, params ...string) *exec.Cmd {
	cmd := exec.Command(name, params...)
	cmd.Dir = directory
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd
}
